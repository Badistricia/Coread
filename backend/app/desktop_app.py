# -*- coding: utf-8 -*-
"""
Desktop mode FastAPI application.
Differs from main.py in that it also serves the compiled frontend
static files so no separate Node dev server is needed.
"""
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.routes import chat

app = FastAPI(title="CoRead API", version="0.1.0")

# Desktop mode: frontend is served from the same origin, so wildcard is fine.
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


# ------------------------------------------------------------------
# Static file serving (frontend dist)
# ------------------------------------------------------------------
if getattr(sys, "frozen", False):
    # Running inside a PyInstaller bundle: files are extracted to _MEIPASS
    _static_root = os.path.join(sys._MEIPASS, "frontend_dist")  # type: ignore[attr-defined]
else:
    # Development fallback: look for frontend/dist relative to repo root
    _repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _static_root = os.path.join(_repo_root, "frontend", "dist")

if os.path.isdir(_static_root):
    _assets_dir = os.path.join(_static_root, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/")
    async def _serve_index():
        return FileResponse(os.path.join(_static_root, "index.html"))

    @app.get("/{full_path:path}")
    async def _serve_spa(full_path: str):
        # Serve a real file if it exists, otherwise fall back to index.html (SPA routing)
        candidate = os.path.join(_static_root, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_static_root, "index.html"))
