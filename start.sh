#!/usr/bin/env bash

# AI 共读 — Ubuntu/Linux 一键启动脚本
set -e

# 颜色控制
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

echo -e "\n${CYAN}==========================================${NC}"
echo -e "${CYAN}      AI 共读 — Linux/Ubuntu 启动器       ${NC}"
echo -e "${CYAN}==========================================${NC}\n"

# 1. 确定工作路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 2. 检查 .env 配置文件
ENV_FILE="$SCRIPT_DIR/backend/.env"
ENV_EXAMPLE="$SCRIPT_DIR/backend/.env.example"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}[!] 未检测到 backend/.env 配置文件，正在创建...${NC}"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo -e "${RED}[WARN] 请先在 backend/.env 中填入你的 LLM_API_KEY 再重新启动！${NC}"
    echo -e "配置文件路径: $ENV_FILE\n"
    exit 1
fi

# 3. 端口占用检测与自动清理函数
kill_port() {
    local port=$1
    echo -e "检查端口 ${YELLOW}$port${NC} 占用状态..."
    
    # 优先尝试使用 lsof 杀死
    if command -v lsof >/dev/null 2>&1; then
        local pids=$(lsof -t -i:$port)
        if [ ! -z "$pids" ]; then
            echo -e "${YELLOW}[!] 发现端口 $port 被进程 $pids 占用，正在强制杀死进程...${NC}"
            kill -9 $pids 2>/dev/null || true
            sleep 1
        fi
    # 其次尝试使用 fuser
    elif command -v fuser >/dev/null 2>&1; then
        if fuser $port/tcp >/dev/null 2>&1; then
            echo -e "${YELLOW}[!] 发现端口 $port 存在占用，正在使用 fuser 清理...${NC}"
            fuser -k -9 $port/tcp >/dev/null 2>&1 || true
            sleep 1
        fi
    fi
}

kill_port 5174
kill_port 8010

# 4. 检查前端依赖并安装
echo -e "\n${GREEN}[1/3] 检查前端 Node.js 环境及依赖...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] 未检测到 Node.js 环境，请先安装 Node.js (推荐 v18+)。${NC}"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}[!] 未发现 frontend/node_modules，正在执行 npm install...${NC}"
    cd "$SCRIPT_DIR/frontend"
    npm install
fi

# 5. 检查后端 Python 虚拟环境及依赖
echo -e "\n${GREEN}[2/3] 检查后端 Python 环境及虚拟环境...${NC}"
if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] 未检测到 Python3 环境，请先安装 python3 及 python3-venv。${NC}"
    exit 1
fi

cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}[!] 正在 backend 创建 Python 虚拟环境 (venv)...${NC}"
    python3 -m venv venv || python -m venv venv || {
        echo -e "${RED}[ERROR] 创建虚拟环境失败。在 Ubuntu 上，你可能需要运行: sudo apt install python3-venv${NC}"
        exit 1
    }
fi

# 激活虚拟环境并安装 requirements
source venv/bin/activate
echo -e "正在更新/安装后端 Python 依赖包..."
pip install --upgrade pip
pip install -r requirements.txt

# 6. 后台启动服务
echo -e "\n${GREEN}[3/3] 正在启动前后端服务...${NC}"

# 启动后端 (FastAPI :8010)
echo -e "  启动后端 (FastAPI 端口 8010)..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8010 > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# 启动前端 (Vite :5174)
echo -e "  启动前端 (Vite 端口 5174)..."
cd "$SCRIPT_DIR/frontend"
nohup npm run dev -- --host 0.0.0.0 > "$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo -e "\n${GREEN}==========================================${NC}"
echo -e "${GREEN}             系统已在后台成功启动！          ${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "  👉 ${CYAN}前端访问地址:${NC} http://localhost:5174"
echo -e "  👉 ${CYAN}后端 API 地址:${NC} http://localhost:8010"
echo -e "  👉 ${CYAN}API 交互文档:${NC} http://localhost:8010/docs"
echo -e "------------------------------------------"
echo -e "  * 前端后台进程 PID: $FRONTEND_PID (日志: frontend.log)"
echo -e "  * 后端后台进程 PID: $BACKEND_PID (日志: backend.log)"
echo -e "  * 如需关闭服务，请运行: kill $FRONTEND_PID $BACKEND_PID"
echo -e "==========================================\n"
