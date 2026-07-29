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
    return {"status": "ok", "app": "coread"}


# ── Static file serving ────────────────────────────────────────────────────────


def _find_static_root() -> str | None:
    import logging
    log = logging.getLogger("coread.desktop_app")

    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        meipass = getattr(sys, "_MEIPASS", exe_dir)
        candidates = [
            os.path.join(meipass, "frontend_dist"),
            os.path.join(exe_dir, "frontend_dist"),
            os.path.join(exe_dir, "_internal", "frontend_dist"),
        ]
        log.info(f"[desktop_app] frozen=True, exe_dir={exe_dir}, _MEIPASS={meipass}")
    else:
        repo_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        candidates = [os.path.join(repo_root, "frontend", "dist")]
        log.info(f"[desktop_app] frozen=False, repo_root={repo_root}")

    for path in candidates:
        has_index = os.path.isfile(os.path.join(path, "index.html"))
        log.info(f"[desktop_app] candidate: {path} -> has_index={has_index}")
        if has_index:
            log.info(f"[desktop_app] using static root: {path}")
            return path

    log.error(f"[desktop_app] frontend_dist NOT FOUND. Tried: {candidates}")
    return None



_static_root = _find_static_root()

if _static_root:
    app.mount("/", StaticFiles(directory=_static_root, html=True), name="static")
else:
    @app.get("/")
    async def _no_frontend():
        return {
            "error": "frontend_dist not found",
            "hint": "Run `npm run build` in the frontend directory first.",
        }
