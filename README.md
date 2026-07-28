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
│   └── .env.example    # 后端环境变量配置模板
├── frontend/           # Vue 3 + Vite 前端应用
│   ├── src/
│   │   ├── components/ # 聊天框、划线工具栏、阅读统计对话框等组件
│   │   ├── config/     # 伴侣人设预设配置
│   │   ├── stores/     # Pinia 状态管理 (阅读设置、会话、阅读统计等)
│   │   ├── views/      # 核心阅读页面与伴侣工坊页面
│   │   └── style.css   # 全局主题变量与排版样式
├── start.ps1           # Windows PowerShell 一键启动脚本
├── start.bat           # Windows CMD 一键启动脚本
└── start.sh            # Linux / macOS 一键启动脚本
```

---

## ⚡ 快速开始

### 1. 配置后端 API Key
1. 进入 `backend/` 目录。
2. 复制 `.env.example` 文件并重命名为 `.env`。
3. 填入大模型 API Key（支持 DashScope / OpenAI 兼容接口）：
   ```env
   DASHSCOPE_API_KEY="your_api_key_here"
   # 或 OpenAI 兼容格式变量
   ```

### 2. 一键启动

在项目根目录下，根据操作系统运行启动脚本：

- **Windows (PowerShell)**:
  ```powershell
  .\start.ps1
  ```
- **Windows (CMD)**:
  双击或在命令行运行 `start.bat`
- **Linux / macOS**:
  ```bash
  chmod +x start.sh
  ./start.sh
  ```

启动成功后，默认服务地址如下：
- **前端页面**：`http://localhost:5174` (或 `5173`)
- **后端服务**：`http://localhost:8010`
- **API 文档**：`http://localhost:8010/docs`

---

## 📄 开源协议

本项目采用 **[MIT License](LICENSE)** 开源协议。
