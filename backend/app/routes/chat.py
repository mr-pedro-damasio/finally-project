from fastapi import APIRouter, Request
from pydantic import BaseModel

import app.database as db
from app.chat_service import handle_chat

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


@router.get("/api/chat/history")
async def chat_history():
    return await db.get_chat_history(limit=20)


@router.post("/api/chat")
async def chat(body: ChatRequest, request: Request):
    price_cache = request.app.state.price_cache
    market_source = request.app.state.market_source
    return await handle_chat(body.message, price_cache, market_source=market_source)
