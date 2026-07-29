#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""CoRead AI — Desktop Entry Point"""
import json
import logging
import os
import socket
import subprocess
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


class _DummyWriter:
    def write(self, buf: str) -> None:
        pass

    def flush(self) -> None:
        pass


if sys.stdout is None:
    sys.stdout = _DummyWriter()  # type: ignore[assignment]
if sys.stderr is None:
    sys.stderr = _DummyWriter()  # type: ignore[assignment]


# ── Logging ────────────────────────────────────────────────────────────────────


def _setup_logging() -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    handlers: list[logging.Handler] = [
        logging.FileHandler(LOG_FILE, encoding="utf-8", mode="w")
    ]
    if sys.stdout is not None and not isinstance(sys.stdout, _DummyWriter):
        handlers.append(logging.StreamHandler(sys.stdout))

    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=handlers,
    )

    def _handle_exception(exc_type, exc_value, exc_traceback):
        log.critical("Unhandled main thread exception:", exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = _handle_exception

    if hasattr(threading, "excepthook"):
        def _thread_exception(args):
            log.critical(
                f"Unhandled thread exception in {args.thread.name}:",
                exc_info=(args.exc_type, args.exc_value, args.exc_traceback),
            )
        threading.excepthook = _thread_exception


log = logging.getLogger("coread")


# ── Config ─────────────────────────────────────────────────────────────────────


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


# ── Kill stale process on port ─────────────────────────────────────────────────


def _kill_port(port: int) -> None:
    """Kill whatever process is listening on the given port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", port)) != 0:
            log.info(f"Port {port} is free.")
            return

    log.warning(f"Port {port} is already in use — killing stale process.")
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True, text=True, errors="ignore"
            )
            pids = set()
            for line in result.stdout.splitlines():
                line_str = line.strip()
                if "LISTEN" in line_str:
                    parts = line_str.split()
                    if len(parts) >= 5:
                        local_addr = parts[1]
                        if local_addr.endswith(f":{port}"):
                            pid = parts[-1]
                            if pid.isdigit() and int(pid) > 0 and int(pid) != os.getpid():
                                pids.add(pid)
            for pid in pids:
                log.info(f"Killing PID {pid} on port {port}")
                subprocess.run(["taskkill", "/F", "/T", "/PID", pid], capture_output=True)
        else:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True, text=True,
            )
            import signal
            for pid_str in result.stdout.strip().splitlines():
                if pid_str.isdigit() and int(pid_str) != os.getpid():
                    os.kill(int(pid_str), signal.SIGKILL)
                    log.info(f"Killed PID {pid_str} on port {port}")
    except Exception as e:
        log.warning(f"Failed to kill process on port {port}: {e}")

    # Wait for port to be released
    deadline = time.time() + 5.0
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                log.info(f"Port {port} confirmed free.")
                return
        time.sleep(0.3)
    log.warning(f"Port {port} could not be freed after timeout.")


# ── First-run dialog ───────────────────────────────────────────────────────────


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
        font=("Segoe UI", 9), foreground="#666666",
    ).grid(row=1, column=0, columnspan=2, sticky="w", pady=(4, 20))

    def _row(label: str, row: int, default: str = "", show: str = "") -> tk.StringVar:
        ttk.Label(outer, text=label, font=("Segoe UI", 10)).grid(
            row=row, column=0, sticky="w", pady=6
        )
        var = tk.StringVar(value=default)
        ttk.Entry(outer, textvariable=var, width=38, show=show).grid(
            row=row, column=1, sticky="ew", padx=(12, 0), pady=6
        )
        return var

    api_key_var = _row("LLM API Key", 2, show="*")
    base_url_var = _row("API Base URL", 3, "https://dashscope.aliyuncs.com/compatible-mode/v1")
    model_var = _row("Model 名称", 4, "qwen-plus")

    ttk.Label(
        outer, text="支持通义千问、OpenAI 及其它兼容 OpenAI 格式的接口",
        font=("Segoe UI", 8), foreground="#999999",
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

    return None if result["skipped"] else result["config"]


# ── Tray icon ──────────────────────────────────────────────────────────────────


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


def _run_tray(on_open_fn, on_log_fn, on_quit_fn) -> None:
    import pystray
    img = _make_tray_image()
    icon = pystray.Icon(
        "CoRead AI", img, "CoRead AI — 正在运行",
        menu=pystray.Menu(
            pystray.MenuItem("打开 CoRead AI", on_open_fn, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("查看启动日志", on_log_fn),
            pystray.MenuItem("退出", on_quit_fn),
        ),
    )
    icon.run()


def _run_taskbar_fallback(on_open_fn, on_quit_fn) -> None:
    """Fallback window when pystray is unavailable."""
    root = tk.Tk()
    root.title("CoRead AI")
    root.geometry("220x70")
    root.resizable(False, False)
    # Keep on top so it's visible
    root.attributes("-topmost", True)
    root.protocol("WM_DELETE_WINDOW", lambda: None)  # Disable close button

    frame = ttk.Frame(root, padding=12)
    frame.pack(fill=tk.BOTH, expand=True)
    ttk.Label(frame, text="CoRead AI 正在运行", font=("Segoe UI", 9)).pack(pady=(0, 6))
    btn_row = ttk.Frame(frame)
    btn_row.pack()
    ttk.Button(btn_row, text="打开", command=on_open_fn, width=8).pack(side=tk.LEFT, padx=4)
    ttk.Button(btn_row, text="退出", command=on_quit_fn, width=8).pack(side=tk.LEFT, padx=4)
    root.mainloop()


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
        from app.desktop_app import app
        log.info(f"Starting uvicorn with desktop_app instance on 127.0.0.1:{PORT}")
        config = uvicorn.Config(
            app=app,
            host="127.0.0.1",
            port=PORT,
            log_level="info",
            log_config=None,
        )
        server = uvicorn.Server(config)
        server.install_signal_handlers = lambda: None
        server.run()
    except Exception as e:
        log.exception(f"Server crashed: {e}")


def _wait_for_server(timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            req = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=1)
            if req.status == 200:
                data = json.loads(req.read().decode("utf-8"))
                if data.get("status") == "ok" and data.get("app") == "coread":
                    log.info("Server is ready.")
                    return True
        except Exception:
            pass
        time.sleep(0.4)
    log.error("Server did not become ready within timeout.")
    return False


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    _setup_logging()
    log.info("=" * 60)
    log.info("CoRead AI starting up")
    log.info(f"Python: {sys.version}")
    log.info(f"Frozen (PyInstaller): {getattr(sys, 'frozen', False)}")
    if getattr(sys, "frozen", False):
        log.info(f"sys.executable : {sys.executable}")
        log.info(f"sys._MEIPASS   : {getattr(sys, '_MEIPASS', 'N/A')}")
        log.info(f"exe dir        : {os.path.dirname(sys.executable)}")
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

    # Kill any stale server from a previous run before binding our port
    _kill_port(PORT)

    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    ready = _wait_for_server()
    log.info(f"Server ready: {ready}")

    webbrowser.open(f"http://127.0.0.1:{PORT}")
    log.info(f"Browser opened: http://127.0.0.1:{PORT}")

    def on_open(*_):
        webbrowser.open(f"http://127.0.0.1:{PORT}")

    def on_log(*_):
        try:
            if sys.platform == "win32":
                os.startfile(str(LOG_FILE))
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(LOG_FILE)])
            else:
                subprocess.Popen(["xdg-open", str(LOG_FILE)])
        except Exception as e:
            log.error(f"Failed to open log file: {e}")

    def on_quit(*_):
        log.info("User quit from tray/window")
        os._exit(0)

    # Try pystray first; fall back to a plain tkinter window if it fails
    log.info("Starting system tray icon (pystray)")
    try:
        _run_tray(on_open, on_log, on_quit)
    except Exception as e:
        log.exception(f"pystray failed: {e}")
        log.info("Falling back to tkinter status window")
        try:
            _run_taskbar_fallback(on_open, on_quit)
        except Exception as e2:
            log.exception(f"Taskbar fallback also failed: {e2}")
            server_thread.join()


if __name__ == "__main__":
    main()
