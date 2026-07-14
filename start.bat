@echo off
echo ==========================================
echo Starting AI Co-Read system via PowerShell...
echo ==========================================
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] PowerShell script exited with error code %errorlevel%.
)
echo.
echo Press any key to exit this window...
pause > nul
