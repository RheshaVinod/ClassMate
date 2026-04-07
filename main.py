from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import base64
import aiosqlite
import json
import os
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
MODEL = "gemma4:e4b"
DB_PATH = "classmate.db"

def get_system_prompt(language: str = "English") -> str:
    return f"""You are ClassMate, a warm and encouraging Socratic tutor for students in under-resourced schools.
You must ALWAYS respond in {language}.
Your rules:
- NEVER give the answer directly
- Always respond with ONE short guiding question
- Keep language simple, friendly, and age-appropriate
- If the student is frustrated, acknowledge their feeling first
- Maximum 2 sentences in your response
- Always end with a question mark"""

# ── Database setup ──────────────────────────────────────────
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_name TEXT NOT NULL,
                subject TEXT,
                message TEXT NOT NULL,
                reply TEXT NOT NULL,
                language TEXT DEFAULT 'English',
                understood INTEGER DEFAULT 0,
                timestamp TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS concepts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_name TEXT NOT NULL,
                concept TEXT NOT NULL,
                struggle_count INTEGER DEFAULT 1,
                understood_count INTEGER DEFAULT 0,
                last_seen TEXT NOT NULL
            )
        """)
        await db.commit()

@app.on_event("startup")
async def startup():
    await init_db()

# ── Helpers ──────────────────────────────────────────────────
def detect_subject(message: str) -> str:
    message = message.lower()
    if any(w in message for w in ["fraction", "multiply", "divide", "equation", "algebra", "geometry", "number", "calculate", "math", "plus", "minus"]):
        return "Math"
    if any(w in message for w in ["photosynthesis", "cell", "gravity", "atom", "biology", "chemistry", "physics", "science", "energy"]):
        return "Science"
    if any(w in message for w in ["history", "war", "revolution", "president", "country", "ancient", "century"]):
        return "History"
    if any(w in message for w in ["essay", "poem", "metaphor", "grammar", "write", "story", "reading", "english", "literature"]):
        return "English"
    return "General"

def extract_concept(message: str) -> str:
    # Simple concept extraction — take first 5 words as concept
    words = message.strip().split()[:5]
    return " ".join(words).capitalize()

async def save_interaction(student_name: str, message: str, reply: str, language: str):
    subject = detect_subject(message)
    concept = extract_concept(message)
    timestamp = datetime.now().isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        # Save session
        await db.execute("""
            INSERT INTO sessions (student_name, subject, message, reply, language, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (student_name, subject, message, reply, language, timestamp))

        # Update concept tracker
        async with db.execute(
            "SELECT id, struggle_count FROM concepts WHERE student_name=? AND concept=?",
            (student_name, concept)
        ) as cursor:
            existing = await cursor.fetchone()

        if existing:
            await db.execute(
                "UPDATE concepts SET struggle_count=?, last_seen=? WHERE id=?",
                (existing[1] + 1, timestamp, existing[0])
            )
        else:
            await db.execute("""
                INSERT INTO concepts (student_name, concept, struggle_count, last_seen)
                VALUES (?, ?, 1, ?)
            """, (student_name, concept, timestamp))

        await db.commit()

# ── Models ────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    message: str
    history: list = []
    language: str = "English"
    student_name: str = "Student"

class ChatResponse(BaseModel):
    reply: str

# ── Chat endpoint ─────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatMessage):
    messages = [{"role": "system", "content": get_system_prompt(body.language)}]

    for turn in body.history:
        messages.append(turn)

    messages.append({"role": "user", "content": body.message})

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "messages": messages,
            "stream": False,
            "think": False,
            "options": {"temperature": 0.7, "num_predict": 150}
        })

    data = response.json()
    reply = data["message"].get("content", "")
    if not reply.strip():
        reply = data["message"].get("thinking", "Let me think...")

    # Save to database
    await save_interaction(body.student_name, body.message, reply, body.language)

    return ChatResponse(reply=reply)

# ── Vision endpoint ───────────────────────────────────────────
@app.post("/chat-with-image", response_model=ChatResponse)
async def chat_with_image(
    message: str = Form(default="Help me with this problem"),
    language: str = Form(default="English"),
    student_name: str = Form(default="Student"),
    file: UploadFile = File(...)
):
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    messages = [
        {"role": "system", "content": get_system_prompt(language)},
        {
            "role": "user",
            "content": message,
            "images": [image_b64]
        }
    ]

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "messages": messages,
            "stream": False,
            "think": False,
            "options": {"temperature": 0.7, "num_predict": 150}
        })

    data = response.json()
    if "error" in data:
        return ChatResponse(reply=f"Vision error: {data['error']}")

    reply = data["message"].get("content", "")
    if not reply.strip():
        reply = data["message"].get("thinking", "Let me look at that...")

    await save_interaction(student_name, message, reply, language)
    return ChatResponse(reply=reply)

# ── Teacher dashboard endpoints ───────────────────────────────
@app.get("/dashboard/overview")
async def dashboard_overview():
    async with aiosqlite.connect(DB_PATH) as db:
        # Total students
        async with db.execute("SELECT COUNT(DISTINCT student_name) FROM sessions") as c:
            total_students = (await c.fetchone())[0]

        # Total sessions
        async with db.execute("SELECT COUNT(*) FROM sessions") as c:
            total_sessions = (await c.fetchone())[0]

        # Subject breakdown
        async with db.execute("""
            SELECT subject, COUNT(*) as count
            FROM sessions GROUP BY subject ORDER BY count DESC
        """) as c:
            subjects = [{"subject": r[0], "count": r[1]} for r in await c.fetchall()]

        # Top struggling concepts across all students
        async with db.execute("""
            SELECT concept, SUM(struggle_count) as total
            FROM concepts
            GROUP BY concept
            ORDER BY total DESC LIMIT 10
        """) as c:
            top_struggles = [{"concept": r[0], "count": r[1]} for r in await c.fetchall()]

        # Language breakdown
        async with db.execute("""
            SELECT language, COUNT(*) as count
            FROM sessions GROUP BY language ORDER BY count DESC
        """) as c:
            languages = [{"language": r[0], "count": r[1]} for r in await c.fetchall()]

        # Recent activity
        async with db.execute("""
            SELECT student_name, subject, message, timestamp
            FROM sessions ORDER BY timestamp DESC LIMIT 10
        """) as c:
            recent = [
                {"student": r[0], "subject": r[1], "message": r[2][:60], "time": r[3][:16]}
                for r in await c.fetchall()
            ]

    return {
        "total_students": total_students,
        "total_sessions": total_sessions,
        "subjects": subjects,
        "top_struggles": top_struggles,
        "languages": languages,
        "recent": recent
    }

@app.get("/dashboard/student/{name}")
async def student_detail(name: str):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT concept, struggle_count, last_seen
            FROM concepts WHERE student_name=?
            ORDER BY struggle_count DESC
        """, (name,)) as c:
            concepts = [
                {"concept": r[0], "struggles": r[1], "last_seen": r[2][:10]}
                for r in await c.fetchall()
            ]

        async with db.execute("""
            SELECT subject, message, reply, timestamp
            FROM sessions WHERE student_name=?
            ORDER BY timestamp DESC LIMIT 20
        """, (name,)) as c:
            sessions = [
                {"subject": r[0], "message": r[1], "reply": r[2], "time": r[3][:16]}
                for r in await c.fetchall()
            ]

    return {"student": name, "concepts": concepts, "sessions": sessions}

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}