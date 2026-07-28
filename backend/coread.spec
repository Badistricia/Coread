# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for CoRead AI desktop build.

Build from the backend/ directory:
    pyinstaller coread.spec --noconfirm

Output:
    dist/CoRead/          (directory bundle, used by Inno Setup on Windows)
    dist/CoRead.app/      (macOS app bundle, used by create-dmg)
"""

import sys

block_cipher = None

# Data files to bundle alongside the executable
datas = [
    # Backend prompt templates
    ("app/prompts", "app/prompts"),
    # Compiled frontend (must exist before running pyinstaller)
    ("../frontend/dist", "frontend_dist"),
]

# Modules that PyInstaller's static analysis misses
hiddenimports = [
    # uvicorn internals
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    # application modules referenced as strings by uvicorn.run()
    "app.desktop_app",
    "app.api.routes.chat",
    "app.core.config",
    "app.services.llm_service",
    # standard library used at runtime
    "tkinter",
    "tkinter.ttk",
]

a = Analysis(
    ["desktop_main.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Trim unused large packages
        "matplotlib",
        "numpy",
        "pandas",
        "PIL",
        "scipy",
        "IPython",
        "jupyter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CoRead",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    # Hide the console window on Windows; on macOS this has no effect
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="CoRead",
)

# macOS .app bundle (ignored on Windows)
app = BUNDLE(
    coll,
    name="CoRead.app",
    icon=None,
    bundle_identifier="com.coread.app",
    info_plist={
        "CFBundleDisplayName": "CoRead AI",
        "CFBundleShortVersionString": "1.0.0",
        "NSHighResolutionCapable": True,
    },
)
