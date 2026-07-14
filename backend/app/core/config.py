import os
from dotenv import load_dotenv

# 加载 .env 环境变量
load_dotenv()


class Settings:
    APP_NAME: str = "AI 共读 API"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # LLM
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o")

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]


settings = Settings()
