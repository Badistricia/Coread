# -*- coding: utf-8 -*-
"""LLM 流式调用服务 — 封装 OpenAI 兼容 API 的 SSE 生成器。"""

from typing import Optional
import httpx
from app.core.config import settings


async def stream_chat(
    system: str,
    user: str,
    history: list = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
):
    """向 LLM 发起流式请求，逐行 yield SSE 数据块。

    优先使用前端/客户端传入的 env 参数，若无则回退为 settings 本地配置。
    """
    effective_api_key = api_key.strip() if (api_key and api_key.strip()) else settings.LLM_API_KEY
    effective_base_url = (base_url.strip() if (base_url and base_url.strip()) else settings.LLM_BASE_URL).rstrip("/")
    effective_model = model.strip() if (model and model.strip()) else settings.LLM_MODEL

    messages = [{"role": "system", "content": system}]
    if history:
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user})

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            f"{effective_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {effective_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": effective_model,
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


async def test_llm_connection(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    """测试当前/用户指定的 LLM API 配置连通性与 Key 有效性。"""
    effective_api_key = api_key.strip() if (api_key and api_key.strip()) else settings.LLM_API_KEY
    effective_base_url = (base_url.strip() if (base_url and base_url.strip()) else settings.LLM_BASE_URL).rstrip("/")
    effective_model = model.strip() if (model and model.strip()) else settings.LLM_MODEL

    if not effective_api_key:
        return {"success": False, "message": "API Key 未配置！请填写 API Key 或检查后端 .env"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{effective_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {effective_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": effective_model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 5,
                },
            )
            if resp.status_code == 200:
                return {
                    "success": True,
                    "message": f"连接成功！(模型: {effective_model})",
                    "using_custom_key": bool(api_key and api_key.strip()),
                }
            else:
                error_msg = resp.text
                try:
                    err_json = resp.json()
                    error_msg = err_json.get("error", {}).get("message") or error_msg
                except Exception:
                    pass
                return {
                    "success": False,
                    "message": f"连接失败 [HTTP {resp.status_code}]: {error_msg[:150]}",
                }
    except Exception as e:
        return {"success": False, "message": f"请求异常: {str(e)}"}

