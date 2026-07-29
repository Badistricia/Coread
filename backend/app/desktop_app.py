# -*- coding: utf-8 -*-
"""
Desktop mode FastAPI application.
Serves the compiled Vue frontend static files + all API routes.
"""
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import chat

app = FastAPI(title="CoRead API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Static file serving ────────────────────────────────────────────────────────


def _find_static_root() -> str | None:
    """
    Locate the compiled frontend dist directory.
    PyInstaller (onedir) extracts data files into sys._MEIPASS.
    We try multiple candidate paths to be resilient across PyInstaller versions.
    """
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        meipass = getattr(sys, "_MEIPASS", exe_dir)
        candidates = [
            os.path.join(meipass, "frontend_dist"),
            os.path.join(exe_dir, "frontend_dist"),
            os.path.join(exe_dir, "_internal", "frontend_dist"),
        ]
    else:
        # Development fallback
        repo_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        candidates = [os.path.join(repo_root, "frontend", "dist")]

    for path in candidates:
        if os.path.isdir(path):
            return path
    return None


_static_root = _find_static_root()

if _static_root:
    # Mount /assets so hashed filenames (JS/CSS) are served with correct headers
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
else:
    # Fallback: tell user what's wrong instead of a cryptic 404
    @app.get("/")
    async def _no_frontend():
        return {
            "error": "frontend_dist not found",
            "hint": "Run `npm run build` in the frontend directory first.",
        }
