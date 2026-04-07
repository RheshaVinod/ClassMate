from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import base64
from typing import Optional
from fastapi import UploadFile, File, Form

app = FastAPI()

# Allow React frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "gemma4:e4b"

def get_system_prompt(language: str = "English") -> str:
    return f"""You are ClassMate, a warm and encouraging Socratic tutor for students in under-resourced schools.
You must ALWAYS respond in {language}. Even if the student writes in a different language, your response must be in {language}.
Your rules:
- NEVER give the answer directly
- Always respond with ONE short guiding question
- Keep language simple, friendly, and age-appropriate
- If the student is frustrated, acknowledge their feeling first
- Maximum 2 sentences in your response
- Always end with a question mark"""



class ChatResponse(BaseModel):
    reply: str

class ChatMessage(BaseModel):
    message: str
    history: list = []
    language: str = "English"   # new field

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
            "options": {
                "temperature": 0.7,
                "num_predict": 150,
            }
        })

    data = response.json()
    reply = data["message"].get("content", "")
    if not reply.strip():
        reply = data["message"].get("thinking", "Let me think...")

    return ChatResponse(reply=reply)


@app.post("/chat-with-image", response_model=ChatResponse)
async def chat_with_image(
    message: str = Form(default="Help me with this problem"),
    language: str = Form(default="English"),   # new field
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
            "options": {
                "temperature": 0.7,
                "num_predict": 150,
            }
        })

    data = response.json()
    if "error" in data:
        return ChatResponse(reply=f"Vision error: {data['error']}")

    reply = data["message"].get("content", "")
    if not reply.strip():
        reply = data["message"].get("thinking", "Let me look at that...")

    return ChatResponse(reply=reply)

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}