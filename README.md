# CoRead AI (AI 共读陪读系统)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue](https://img.shields.io/badge/Vue-3.x-brightgreen.svg)](https://vuejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-blue.svg)](https://fastapi.tiangolo.com/)

CoRead AI 是一个基于大语言模型的沉浸式 **“AI 共读陪读” 系统**。支持导入本地大文本 TXT 小说，在双栏与单栏自适应布局中与多性格 AI 伴侣共同阅读、划线讨论、添加正文批注并进行日常陪伴互动。

---

## 💡 核心功能

1. **大文本 TXT 解析与按需动态分页**
   - 支持导入百万字大文本 TXT 小说，自动解析章节目录。
   - 采用按需动态章节分页与免深响应优化，大文件快速载入。

2. **视口与布局自适应重排**
   - 根据屏幕尺寸、字号/行距设置及右侧聊天抽屉开合状态，自适应计算字符容量与排版重排。
   - 包含双栏卡纸排版与多护眼底色。

3. **双场景 AI 伴读交互**
   - **日常闲聊**：可在侧边聊天框中进行日常倾诉与沟通。
   - **正文划线研讨/AI解词**：在正文中划选词句即可弹出工具栏提问或解词，AI 回复附带原文引用卡片。

4. **正文 AI 虚线划线与悬停批注**
   - 讨论产生的批注会在正文中保留温暖的虚线下划线。
   - 鼠标悬停在划线上即可浮现查看伴侣留下的批注小评语。

5. **丰富伴侣库与专属问候 (Onboarding)**
   - **预设伴侣**：内置陆沉、萧逸、齐司礼、查理苏、夏鸣星等多位性格各异的预设伴侣及专属问候语（Onboarding Greeting）。
   - **自定义伴侣工坊**：支持配置伴侣姓名、身份背景、性格标签、语气风格、批注风格、问候语及专属双色主题。

6. **主题皮肤与小夜灯模式 (Night Lamp)**
   - 提供暖金书卷、冷灰极简、奶茶温柔、夜间暗黑等多套护眼主题及伴侣专属配色。
   - 支持小夜灯模式，调暗界面光感，适合深夜舒缓伴读。

7. **阅读统计与多会话管理**
   - **阅读数据统计**：实时统计已读字数、阅读时长、划线批注数与对话互动次数。
   - **多会话记录**：支持不同书籍与伴侣间独立的会话历史、阅读进度恢复与管理。

8. **全本地数据持久化 (IndexedDB)**
   - 阅读进度、书签、划线批注、历史对话和自定义伴侣人设完全存储在浏览器本地 IndexedDB 中，离线数据不丢失。

---

## 📂 项目结构

```text
self-coread/
├── backend/            # FastAPI 后端服务
│   ├── app/
│   │   ├── api/        # 接口路由 (/api/chat, /api/health)
│   │   ├── core/       # 核心配置与环境变量
│   │   ├── prompts/    # 伴侣人设 Prompt 与配置管理
│   │   └── services/   # 大模型流式对话服务
│   ├── requirements.txt # 后端 Python 依赖包列表
│   └── .env.example    # 后端环境变量配置模板
├── frontend/           # Vue 3 + Vite 前端应用
│   ├── src/
│   │   ├── components/ # 聊天框、划线工具栏、阅读统计对话框等组件
│   │   ├── config/     # 伴侣人设预设配置
│   │   ├── stores/     # Pinia 状态管理 (阅读设置、会话、阅读统计等)
│   │   ├── views/      # 核心阅读页面与伴侣工坊页面
│   │   └── style.css   # 全局主题变量与排版样式
│   └── package.json    # 前端 Node 依赖包列表
├── start.ps1           # Windows PowerShell 一键启动脚本
├── start.bat           # Windows CMD 一键启动脚本
└── start.sh            # Linux / macOS 一键启动脚本
```

---

## 🔰 零基础小白新手指南 (Windows & macOS)

### 1. 🛠️ 准备基础环境（只需配置一次）

本项目由**前端**与**后端**两部分组成，需要安装以下两个软件（均为免费开源软件）：

* **① 安装 Node.js (前端运行环境)**
  * **下载**：进入 [Node.js 官网 (nodejs.org)](https://nodejs.org/) 下载 **LTS (长期支持版)**。
  * **安装**：双击下载的安装包（Windows 为 `.msi`，macOS 为 `.pkg`），一路点击“下一步 (Next)”即可。
  * **说明**：现在的 Node.js 安装包会**自动配置环境变量**，安装完成后无需手动进行额外环境变量设置。

* **② 安装 Python (后端运行环境)**
  * **下载**：进入 [Python 官网 (python.org)](https://www.python.org/downloads/) 下载 Python 3.10 或更高的最新版本。
  * **安装 (⚠️ 极其关键)**：
    * **Windows 用户**：在打开安装界面的第一步，**务必勾选最下方的 `"Add python.exe to PATH"`（将 Python 添加到环境变量）**，然后再点击 "Install Now"。
    * **macOS 用户**：直接双击 `.pkg` 按提示安装；或者打开终端运行 `brew install python`。

---

### 2. 📦 依赖包说明 (系统用到的依赖)

一键启动脚本在首次运行系统时会**自动下载并安装**以下依赖包。如需手动安装，具体清单如下：

* **Python 后端依赖包**（记录在 `backend/requirements.txt` 中）：
  * `fastapi` & `uvicorn`：Web 框架与异步高性能服务托管。
  * `httpx` & `sse-starlette`：用于大模型 SSE 流式输出对话。
  * `pydantic` & `python-dotenv`：数据类型校验与 `.env` 配置解析。
  * *手动安装命令*：在 `backend` 目录下运行 `pip install -r requirements.txt`
* **Node.js 前端依赖包**（记录在 `frontend/package.json` 中）：
  * `vue`, `pinia`, `vue-router`：前端核心响应式 UI 框架、状态存储与页面路由。
  * `vite`, `tailwindcss`：前端构建与样式框架。
  * `localforage`：浏览器本地 IndexedDB 离线存储。
  * *手动安装命令*：在 `frontend` 目录下运行 `npm install`

---

### 3. 🔑 配置 API Key

1. 进入项目的 `backend/` 文件夹。
2. 复制 `.env.example` 文件，并在当前目录下粘粘贴重命名为 `.env`。
3. 用记事本（Windows）或文本编辑（macOS）打开 `.env` 文件，填入你的大模型 API Key（支持 DashScope 通义千问或其它兼容 OpenAI 格式的服务）：
   ```env
   DASHSCOPE_API_KEY="your_actual_api_key_here"
   ```

---

### 4. 🚀 系统启动运行步骤

根据你的操作系统选择对应的方法：

#### 🪟 Windows 用户启动指南

* **方法 A（推荐：极速一键启动）**：
  直接在项目根目录下双击 **`start.bat`** 即可。（或者右键选择 `start.ps1` 用 PowerShell 运行）。脚本会自动清理占用端口、安装依赖并并行拉起前后端。

* **方法 B（手动命令行启动）**：
  1. 按 `Win + R` 输入 `cmd` 打开终端，进入 `backend` 目录并运行：
     ```cmd
     cd backend
     pip install -r requirements.txt
     uvicorn app.main:app --reload --port 8010
     ```
  2. 再打开一个新的 CMD 终端，进入 `frontend` 目录并运行：
     ```cmd
     cd frontend
     npm install
     npm run dev
     ```
  3. 打开浏览器访问 `http://localhost:5174` 即可。

#### 🍎 macOS / Linux 用户启动指南

1. **打开终端 (Terminal)**：
   按下快捷键 `Cmd + 空格`，在搜索框输入`终端`或 `Terminal` 并回车。
2. **进入项目目录并授权启动脚本**：
   在终端中输入 `cd `（注意 `cd` 后面留一个空格），然后将解压好的 `self-coread` 项目文件夹**直接拖入终端窗口中**，按下回车。
   接着输入授权命令：
   ```bash
   chmod +x start.sh
   ```
3. **运行启动脚本**：
   ```bash
   ./start.sh
   ```
   *说明：启动脚本会自动创建 Python 虚拟环境 (venv)、自动补齐下载 Node 包与 Python 包，并在后台拉起所有服务。*
4. **访问系统**：
   在浏览器中打开：`http://localhost:5174` (或端口 `5173`)。

---

## 📄 开源协议

本项目采用 **[MIT License](LICENSE)** 开源协议。
