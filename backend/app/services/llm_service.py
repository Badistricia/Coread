"""LLM 流式调用服务 — 封装 OpenAI 兼容 API 的 SSE 生成器。"""

import httpx
from app.core.config import settings


async def stream_chat(system: str, user: str, history: list = None):
    """向 LLM 发起流式请求，逐行 yield SSE 数据块。

    使用 httpx 异步流式客户端，兼容 OpenAI 格式的 chat/completions 端点。
    每遇到一个 data: 行即 yield，遇到 [DONE] 终止。
    """
    messages = [{"role": "system", "content": system}]
    if history:
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user})

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            f"{settings.LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": messages,
                "stream": True,
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    yield f"data: {data}\n\n"
