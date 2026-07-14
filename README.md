# CoRead AI (AI 共读陪读)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue](https://img.shields.io/badge/Vue-3.x-brightgreen.svg)](https://vuejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-blue.svg)](https://fastapi.tiangolo.com/)

一个基于大语言模型、高度定制化的沉浸式**“AI 共读陪读”系统**。本系统完美模拟了两位读者面对面坐在书桌前、共同品读一本书的亲密陪伴氛围。支持导入任意大文本 TXT 小说，与极具性格张力的伴侣（如陆沉、萧逸等）展开多轮深度伴读。

---

## 🌟 核心亮点与特色功能

1. **秒级载入与动态懒分页 (Instant load & Lazy Pagination)**
   - 彻底摒弃传统预分页带来的大文件导入卡死问题，采用**按需动态章节分页**。
   - 配合 Vue 3 `markRaw` 免去大段静态文字的深响应 Proxy 代理，百万字小说可在毫秒级瞬时载入，内存占用降低 95%！

2. **视口缩放与聊天开合自适应重排 (Fluid Responsive Layout)**
   - 严格限定最外层视口高度，绝不产生浏览器全局滚动条。
   - 双栏阅读卡片字符容量实时与**屏幕宽高缩放（Page Zoom）、右侧聊天抽屉折叠/展开状态**强绑定，自适应动态重算，确保任何分辨率下均完美展示，绝不溢出或截断。

3. **对话场景完美分离与简短口语流 (Context Separation & Brevity)**
   - **日常闲聊 (General Chat)**：右侧直接交谈，支持无拘无束的心情倾诉，AI 绝不生硬提起书本，也严禁输出批注。
   - **划线讨论 (Quote Discussion)**：划词悬浮泡一键提问，AI 针对选中文段发表独特品鉴，聊天气泡顶部附带高保真“引用原文卡片”。
   - **发言节奏**：单次发言强制在 **3句话、80字以内**，回归真实的日常聊天，拒绝死板教条的长篇书评。

4. **正文 AI 虚线划线批注联动 (Inline Annotations Underlining)**
   - AI 在伴读研讨中产生的批注，会在书页正文中**自动画上温暖的虚线下划线**。
   - 鼠标悬停在划线上，即可浮现查看 AI 留下的小评语，真正实现“纸上留墨”的共读体验。

5. **伴侣专属调色皮肤 (Exclusive Theme Schemes)**
   - 包含四套精心调校的护眼通用底色：**暖金书卷 (A)、冷灰极简 (B)、奶茶温柔 (C)、夜间暗黑 (D)**。
   - 提供**动态专属配色圆钮**，随男主身份动态变幻渐变色：
     - **陆沉专属 · 幻惑之瞳**：外部深红木色背景 + 高对比米白卡片 + AI 深酒红气泡。
     - **萧逸专属 · 极速之耀**：外部极深赛道暗蓝背景 + 冰川冷白卡片 + AI 赛道蓝气泡 + 霓虹青高亮。
     - 同时支持齐司礼（墨玉绿）、查理苏（皇家紫）、夏鸣星（骄阳橘）三位男主的专属皮肤。
   - 外部文字（Header 标题、未选中伴侣按钮等）采用高对比度自适应色，彻底修复了深色专属主题下字迹看不清的问题。

6. **全自动 Proxy 净化会话持久化 (Auto-Saving)**
   - 接入 Pinia Store 深度响应式 Watch 自动存盘器。
   - 在写入 IndexedDB 时，自动进行 `JSON` 净化剥离 Proxy 代理外壳，实现 100% 写入成功率，无论是强刷页面还是中断输入，历史聊天和阅读进度全部完美复原。

---

## 📂 项目结构

```text
self-coread/
├── backend/            # FastAPI 后端服务
│   ├── app/
│   │   ├── api/        # 接口路由 (/api/chat, /api/companions)
│   │   ├── prompts/    # 伴侣人设配置及 System Prompt 管理
│   │   └── services/   # 大模型流式 SSE 对话对接
│   └── .env.example    # 后端环境变量示例
├── frontend/           # Vue 3 移动/桌面自适应前端
│   ├── src/
│   │   ├── components/ # 聊天框、划线悬浮工具栏
│   │   ├── stores/     # Pinia 状态管理 (会话、阅读配置、视口尺寸)
│   │   ├── views/      # 核心共读面板
│   │   └── style.css   # 全套主题变量与排版样式
└── start.bat           # Windows 一键极速开发启动服务
```

---

## ⚡ 快速开始 (Getting Started)

本项目专门编写了极速启动脚本，您无需手动在两个终端分别敲击命令。

### 1. 配置 API Key
1. 进入 `backend/` 目录。
2. 复制 `.env.example` 并重命名为 `.env`。
3. 在其中填写您的 API 大模型 Key（支持通用 OpenAI 格式或其它兼容服务）：
   ```env
   DASHSCOPE_API_KEY="your_api_key_here"
   # 或其它大模型配置变量
   ```

### 2. 一键启动
在项目根目录下，直接双击运行：
👉 **[start.bat](file:///c:/Self/Project/github/self-coread/start.bat)**

脚本会自动初始化依赖，并行拉起 FastAPI 后端（端口 `8000`）与 Vite 前端（端口 `5173`），并在默认浏览器中自动打开 `http://localhost:5173`，您可以即刻开始您的 AI 陪读共读体验！

---

## 📄 开源协议 (License)

本项目采用 **[MIT License](file:///c:/Self/Project/github/self-coread/LICENSE)** 开源协议。
详情请参阅项目根目录下的 [LICENSE](file:///c:/Self/Project/github/self-coread/LICENSE) 文件。
