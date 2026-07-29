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
    return {"status": "ok"}


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
        if os.path.isdir(path):
            return path
    return None


_static_root = _find_static_root()

if _static_root:
    _assets_dir = os.path.join(_static_root, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/")
    async def _serve_index():
        return FileResponse(os.path.join(_static_root, "index.html"))

    @app.get("/{full_path:path}")
    async def _serve_spa(full_path: str):
        candidate = os.path.join(_static_root, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_static_root, "index.html"))
