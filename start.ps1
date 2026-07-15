# AI 共读 — 一键启动脚本 (PowerShell)

Write-Host "`n  AI 共读 — 启动中...`n" -ForegroundColor Cyan

# 1. 确定根路径
$scriptRoot = [string]$PSScriptRoot
if (-not $scriptRoot) {
    $scriptRoot = (Get-Location).Path
}

# 2. 检查 .env
$envFile = "$scriptRoot\backend\.env"
$envExample = "$scriptRoot\backend\.env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "  已从 .env.example 创建 backend\.env，请先填入 LLM_API_KEY 再启动！" -ForegroundColor Yellow
    Write-Host "   编辑: backend\.env`n"
    Read-Host "按回车键退出..."
    exit 1
}

# 3. 检查依赖
$frontendModules = "$scriptRoot\frontend\node_modules"
if (-not (Test-Path $frontendModules)) {
    Write-Host "  安装前端依赖..." -ForegroundColor Yellow
    Push-Location "$scriptRoot\frontend"
    npm install
    Pop-Location
}

# 4. 启动后端
Write-Host "  启动后端 (FastAPI :8010)..." -ForegroundColor Green
$backend = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot\backend'; Write-Host 'Backend starting at http://localhost:8010' -ForegroundColor Green; uvicorn app.main:app --reload --port 8010" -PassThru

# 5. 启动前端
Write-Host "  启动前端 (Vite :5174)..." -ForegroundColor Green
$frontend = Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot\frontend'; Write-Host 'Frontend starting at http://localhost:5174' -ForegroundColor Green; npm run dev" -PassThru

Write-Host "`n  前后端均已启动！" -ForegroundColor Cyan
Write-Host "   前端: http://localhost:5174" -ForegroundColor White
Write-Host "   后端: http://localhost:8010" -ForegroundColor White
Write-Host "   API文档: http://localhost:8010/docs`n" -ForegroundColor White
