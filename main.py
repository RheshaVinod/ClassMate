from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import base64
from typing import Optional

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

SYSTEM_PROMPT = """You are ClassMate, a warm and encouraging Socratic tutor 
for students in under-resourced schools. Your rules:
- NEVER give the answer directly
- Always respond with ONE guiding question
- Keep language simple and friendly
- If the student is frustrated, acknowledge it before asking
- Maximum 2 sentences in your response"""

class ChatMessage(BaseModel):
    message: str
    history: list = []

class ChatResponse(BaseModel):
    reply: str

@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatMessage):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    for turn in body.history:
        messages.append(turn)
    
    messages.append({"role": "user", "content": body.message})
    
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 150,
               
            },
            "think": False
        })
    
    data = response.json()
    
    # Debug line — add this temporarily
    print("RAW OLLAMA RESPONSE:", data)
    
    reply = data["message"]["content"]
    
    if not reply.strip():
        # Fallback to thinking if content is empty
        reply = data["message"].get("thinking", "I'm thinking...")
    
    return ChatResponse(reply=reply)
    


@app.post("/chat-with-image", response_model=ChatResponse)
async def chat_with_image(
    message: str,
    file: UploadFile = File(...)
):
    # Read and encode the image (homework photo)
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": message or "Help me with this problem",
            "images": [image_b64]   # Gemma 4 multimodal
        }
    ]
    
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.7, "num_predict": 150}
        })
    
    data = response.json()
    reply = data["message"]["content"]
    
    return ChatResponse(reply=reply)

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}