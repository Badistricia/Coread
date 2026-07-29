# -*- coding: utf-8 -*-
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import chat
from app.core.config import settings

app = FastAPI(title="CoRead API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if not getattr(sys, "frozen", False) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "coread"}


# ── Static file serving for SPA frontend ──────────────────────────────────────


def _find_static_root() -> str | None:
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        meipass = getattr(sys, "_MEIPASS", exe_dir)
        candidates = [
            os.path.join(meipass, "frontend_dist"),
            os.path.join(exe_dir, "frontend_dist"),
            os.path.join(exe_dir, "_internal", "frontend_dist"),
        ]
    else:
        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        candidates = [os.path.join(repo_root, "frontend", "dist")]

    for path in candidates:
        if os.path.isfile(os.path.join(path, "index.html")):
            return path
    return None


_static_root = _find_static_root()

if _static_root:
    app.mount("/", StaticFiles(directory=_static_root, html=True), name="static")
