# CoRead — 一键启动脚本 (PowerShell)
# -*- coding: utf-8 -*-

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING     = "UTF-8"
$env:PYTHONUTF8           = "1"
chcp 65001 > $null

Write-Host "`n  CoRead — 启动中...`n" -ForegroundColor Cyan

# 1. 确定根路径
$scriptRoot = [string]$PSScriptRoot
if (-not $scriptRoot) {
    $scriptRoot = (Get-Location).Path
}

# 2. 检查 .env
$envFile     = Join-Path $scriptRoot "backend\.env"
$envExample  = Join-Path $scriptRoot "backend\.env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "  已从 .env.example 创建 backend\.env，请先填入 LLM_API_KEY 再启动！" -ForegroundColor Yellow
    Write-Host "   编辑: backend\.env`n"
    Read-Host "按回车键退出..."
    exit 1
}

# 3. 检查依赖
$frontendModules = Join-Path $scriptRoot "frontend\node_modules"
if (-not (Test-Path $frontendModules)) {
    Write-Host "  安装前端依赖..." -ForegroundColor Yellow
    Push-Location (Join-Path $scriptRoot "frontend")
    npm.cmd install
    Pop-Location
}

# 3.1 兜底修补：检测是否缺失 rolldown Windows 原生绑定包
#     (npm optionalDependencies bug: https://github.com/npm/cli/issues/4828)
$rolldownBinding = Join-Path $scriptRoot "frontend\node_modules\@rolldown\binding-win32-x64-msvc\rolldown-binding.win32-x64-msvc.node"
if (-not (Test-Path $rolldownBinding)) {
    Write-Host "  [!] 检测到缺失 Rolldown Windows 原生绑定包 (@rolldown/binding-win32-x64-msvc)，正在自动修补..." -ForegroundColor Yellow
    Push-Location (Join-Path $scriptRoot "frontend")
    npm.cmd install @rolldown/binding-win32-x64-msvc --no-save 2>&1 | Out-Null
    if (-not (Test-Path $rolldownBinding)) {
        Write-Host "  [!] 首次修补未命中，正在尝试使用国内镜像源进行二次修补..." -ForegroundColor DarkYellow
        npm.cmd install @rolldown/binding-win32-x64-msvc --no-save --registry=https://registry.npmmirror.com 2>&1 | Out-Null
    }
    if (Test-Path $rolldownBinding) {
        Write-Host "      [OK] Rolldown Windows 原生绑定包已补齐。" -ForegroundColor Green
    } else {
        Write-Host "      [FAIL] 自动修补失败，请手动运行： cd frontend ; npm i @rolldown/binding-win32-x64-msvc --no-save" -ForegroundColor Red
    }
    Pop-Location
}

# 4. 启动后端 (在新的 PowerShell 窗口中运行)
Write-Host "  启动后端 (FastAPI :8010)..." -ForegroundColor Green
$backendDir  = Join-Path $scriptRoot "backend"
$backendArgs = @(
    "-NoExit",
    "-Command",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
    "[Console]::InputEncoding  = [System.Text.Encoding]::UTF8; " +
    "`$OutputEncoding           = [System.Text.Encoding]::UTF8; " +
    "`$env:PYTHONIOENCODING     = 'UTF-8'; " +
    "`$env:PYTHONUTF8           = '1'; " +
    "chcp 65001 > `$null; " +
    "Set-Location '$backendDir'; " +
    "Write-Host 'Backend starting at http://localhost:8010' -ForegroundColor Green; " +
    "uvicorn app.main:app --reload --port 8010"
)
$backend = Start-Process -FilePath "powershell" -ArgumentList $backendArgs -PassThru

# 5. 启动前端 (在新的 PowerShell 窗口中运行)
Write-Host "  启动前端 (Vite :5174)..." -ForegroundColor Green
$frontendDir  = Join-Path $scriptRoot "frontend"
$frontendArgs = @(
    "-NoExit",
    "-Command",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
    "[Console]::InputEncoding  = [System.Text.Encoding]::UTF8; " +
    "`$OutputEncoding           = [System.Text.Encoding]::UTF8; " +
    "chcp 65001 > `$null; " +
    "Set-Location '$frontendDir'; " +
    "Write-Host 'Frontend starting at http://localhost:5174' -ForegroundColor Green; " +
    "npm.cmd run dev"
)
$frontend = Start-Process -FilePath "powershell" -ArgumentList $frontendArgs -PassThru

Write-Host "`n  前后端均已启动！" -ForegroundColor Cyan
Write-Host "   前端:   http://localhost:5174" -ForegroundColor White
Write-Host "   后端:   http://localhost:8010" -ForegroundColor White
Write-Host "   API文档: http://localhost:8010/docs`n" -ForegroundColor White
