# -*- coding: utf-8 -*-
"""聊天路由 — POST /api/chat

接收前端 ChatRequest，组装 Prompt，流式返回 LLM 回复。
Phase 1：无数据库、无章节摘要，防剧透降级。
"""

from typing import Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.prompts.prompt_manager import get_system_prompt, get_user_message
from app.services.llm_service import stream_chat, test_llm_connection

from app.prompts.character_config import get_all_characters

router = APIRouter(tags=["chat"])


@router.get("/companions")
async def get_companions():
    return get_all_characters()


class ChatMessage(BaseModel):
    role: str
    content: str


class EnvConfigRequest(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    context_text: str
    chapter_text: str = ""
    current_local_time: str
    daily_read_minutes: int
    current_chapter: int
    book_title: str = ""
    companion_id: str = "luchen"
    history: list[ChatMessage] = []
    quote: str = ""  # 用户选中的划线原文
    custom_companion: Optional[dict] = None
    scene: str = ""
    book_type: str = "default"
    manager_prompt: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


@router.post("/chat/test-config")
async def test_config(req: EnvConfigRequest):
    return await test_llm_connection(
        api_key=req.api_key,
        base_url=req.base_url,
        model=req.model,
    )


@router.post("/chat")
async def chat(req: ChatRequest):
    # Phase 1: chapter_summaries 为空 → 自动触发降级约束
    system = get_system_prompt(
        companion_id=req.companion_id,
        current_local_time=req.current_local_time,
        daily_read_minutes=req.daily_read_minutes,
        book_title=req.book_title,
        current_chapter=req.current_chapter,
        chapter_summaries="",
        quote=req.quote,
        custom_companion=req.custom_companion,
        scene=req.scene,
        book_type=req.book_type,
        manager_prompt=req.manager_prompt,
    )
    user = get_user_message(
        companion_id=req.companion_id,
        context_text=req.context_text,
        chapter_text=req.chapter_text,
        message=req.message,
        quote=req.quote,
        scene=req.scene,
        book_type=req.book_type,
    )

    return StreamingResponse(
        stream_chat(
            system,
            user,
            history=req.history,
            api_key=req.api_key,
            base_url=req.base_url,
            model=req.model,
        ),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

