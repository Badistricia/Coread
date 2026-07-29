#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CoRead AI — Desktop Entry Point (with file logging for diagnostics)
"""
import json
import logging
import os
import sys
import threading
import time
import tkinter as tk
import urllib.request
import webbrowser
from pathlib import Path
from tkinter import ttk

PORT = 8010
CONFIG_FILE = Path.home() / ".coread" / "config.json"
LOG_FILE = Path.home() / ".coread" / "coread.log"


# ── Logging setup ──────────────────────────────────────────────────────────────


def _setup_logging() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8", mode="w"),
            logging.StreamHandler(sys.stdout),
        ],
    )


log = logging.getLogger("coread")


# ── Config helpers ─────────────────────────────────────────────────────────────


def load_config() -> dict | None:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log.warning(f"Failed to load config: {e}")
            return None
    return None


def save_config(data: dict) -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── First-run dialog (tkinter) ─────────────────────────────────────────────────


def show_first_run_dialog() -> dict | None:
    result: dict = {"skipped": False, "config": {}}

    root = tk.Tk()
    root.title("CoRead AI — 首次配置")
    root.resizable(False, False)

    w, h = 500, 360
    sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
    root.geometry(f"{w}x{h}+{(sw - w) // 2}+{(sh - h) // 2}")

    outer = ttk.Frame(root, padding=28)
    outer.pack(fill=tk.BOTH, expand=True)

    ttk.Label(outer, text="CoRead AI", font=("Segoe UI", 16, "bold")).grid(
        row=0, column=0, columnspan=2, sticky="w"
    )
    ttk.Label(
        outer,
        text="配置 LLM API 以启用 AI 对话（留空则稍后在应用内通过设置按钮配置）",
        font=("Segoe UI", 9),
        foreground="#666666",
    ).grid(row=1, column=0, columnspan=2, sticky="w", pady=(4, 20))

    def _row(label: str, row: int, default: str = "", show: str = "") -> tk.StringVar:
        ttk.Label(outer, text=label, font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=6
        )
        var = tk.StringVar(value=default)
        entry = ttk.Entry(outer, textvariable=var, width=38, show=show)
        entry.grid(row=row, column=1, sticky="ew", padx=(12, 0), pady=6)
        return var

    api_key_var = _row("LLM API Key", 2, show="*")
    base_url_var = _row("API Base URL", 3, "https://dashscope.aliyuncs.com/compatible-mode/v1")
    model_var = _row("Model 名称", 4, "qwen-plus")

    ttk.Label(
        outer,
        text="支持通义千问、OpenAI 及其它兼容 OpenAI 格式的接口",
        font=("Segoe UI", 8),
        foreground="#999999",
    ).grid(row=5, column=0, columnspan=2, sticky="w", pady=(2, 20))

    outer.columnconfigure(1, weight=1)

    def on_confirm() -> None:
        result["config"] = {
            "api_key": api_key_var.get().strip(),
            "base_url": base_url_var.get().strip(),
            "model": model_var.get().strip(),
        }
        root.destroy()

    def on_skip() -> None:
        result["skipped"] = True
        root.destroy()

    btn_frame = ttk.Frame(outer)
    btn_frame.grid(row=6, column=0, columnspan=2, sticky="e")
    ttk.Button(btn_frame, text="跳过，稍后在应用内配置", command=on_skip).pack(side=tk.LEFT, padx=(0, 10))
    ttk.Button(btn_frame, text="确认启动", command=on_confirm).pack(side=tk.LEFT)

    root.mainloop()

    if result["skipped"]:
        return None
    return result["config"]


# ── System tray icon ───────────────────────────────────────────────────────────


def _make_tray_image():
    from PIL import Image, ImageDraw

    size = 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=28, fill=(99, 102, 241))
    draw.rectangle([22, 28, 58, 100], fill="white")
    draw.rectangle([62, 28, 98, 100], fill="white")
    draw.rectangle([57, 24, 63, 104], fill=(180, 184, 245))
    for y in range(40, 90, 10):
        draw.line([(28, y), (52, y)], fill=(200, 200, 220), width=2)
        draw.line([(68, y), (92, y)], fill=(200, 200, 220), width=2)
    return img


def run_tray(on_open_fn, on_log_fn, on_quit_fn):
    import pystray

    img = _make_tray_image()
    icon = pystray.Icon(
        "CoRead AI",
        img,
        "CoRead AI — 正在运行",
        menu=pystray.Menu(
            pystray.MenuItem("打开 CoRead AI", on_open_fn, default=True),
            pystray.MenuItem(pystray.Menu.SEPARATOR),
            pystray.MenuItem("查看启动日志", on_log_fn),
            pystray.MenuItem("退出", on_quit_fn),
        ),
    )
    icon.run()


# ── Server ─────────────────────────────────────────────────────────────────────


def _apply_env(config: dict) -> None:
    if config.get("api_key"):
        os.environ["LLM_API_KEY"] = config["api_key"]
    if config.get("base_url"):
        os.environ["LLM_BASE_URL"] = config["base_url"]
    if config.get("model"):
        os.environ["LLM_MODEL"] = config["model"]


def _start_server() -> None:
    try:
        import uvicorn
        log.info(f"Starting uvicorn on 127.0.0.1:{PORT}")
        uvicorn.run("app.desktop_app:app", host="127.0.0.1", port=PORT, log_level="info")
    except Exception as e:
        log.exception(f"Server failed to start: {e}")


def _wait_for_server(timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=1)
            log.info("Server is ready.")
            return True
        except Exception:
            time.sleep(0.4)
    log.error("Server did not become ready within timeout.")
    return False


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    _setup_logging()

    log.info("=" * 60)
    log.info(f"CoRead AI starting up")
    log.info(f"Python: {sys.version}")
    log.info(f"Frozen (PyInstaller): {getattr(sys, 'frozen', False)}")
    if getattr(sys, "frozen", False):
        log.info(f"sys.executable: {sys.executable}")
        log.info(f"sys._MEIPASS:   {getattr(sys, '_MEIPASS', 'N/A')}")
        log.info(f"exe dir:        {os.path.dirname(sys.executable)}")
        sys.path.insert(0, sys._MEIPASS)  # type: ignore[attr-defined]
    log.info(f"Log file: {LOG_FILE}")
    log.info("=" * 60)

    config = load_config()
    log.info(f"Config loaded: {bool(config)}")

    if config is None:
        log.info("First run — showing config dialog")
        new_config = show_first_run_dialog()
        if new_config is not None:
            save_config(new_config)
            config = new_config
            log.info("Config saved from first-run dialog")
        else:
            log.info("User skipped first-run dialog")

    if config:
        _apply_env(config)
        log.info("Env vars applied from config")

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    ready = _wait_for_server()
    log.info(f"Server ready: {ready}")

    webbrowser.open(f"http://127.0.0.1:{PORT}")
    log.info(f"Browser opened: http://127.0.0.1:{PORT}")

    def on_open(icon, item):
        webbrowser.open(f"http://127.0.0.1:{PORT}")

    def on_log(icon, item):
        # Open the log file in the system default text editor
        import subprocess
        try:
            if sys.platform == "win32":
                os.startfile(str(LOG_FILE))
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(LOG_FILE)])
            else:
                subprocess.Popen(["xdg-open", str(LOG_FILE)])
        except Exception as e:
            log.error(f"Failed to open log file: {e}")

    def on_quit(icon, item):
        log.info("User quit from tray")
        icon.stop()
        os._exit(0)

    try:
        log.info("Starting system tray icon")
        run_tray(on_open, on_log, on_quit)
    except Exception as e:
        log.exception(f"Tray icon failed: {e}")
        server_thread.join()


if __name__ == "__main__":
    main()
