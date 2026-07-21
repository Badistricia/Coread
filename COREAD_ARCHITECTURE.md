# CoRead AI 共读系统技术架构与实现说明书 (Phase 1)

本项目致力于打造一个**“高陪伴感、强沉浸式”的乙游向 AI 小说共读网页应用**。在 Phase 1 阶段，我们成功克服了动态字数物理分页、文本截断、高频换行吞字、历史记录定位、多会话重命名以及专属视觉主题适配等技术挑战。

本篇文档将为您梳理系统的核心研发目标、关键技术选型、算法模型及各项体验方案的实现细节。

---

## 🎯 1. 研发目标与系统定位

1. **强情绪价值陪伴**：系统通过陆沉、萧逸等男主的专属设定，提供不仅限于“阅读辅助”的灵魂对话。男主会根据用户的阅读区间、阅读时长以及现实时间（如深夜提醒休息）给予针对性的反馈。
2. **轻量实体卡纸体验**：小说阅读区模仿“微信读书”的精装实体书卡片风格。要求排版极度严谨，不能出现滚动条，也不能因为屏幕拉伸、字号行距变化而导致排版混乱。
3. **零门槛低成本单机模式**：Phase 1 采用纯前端 IndexedDB 进行书籍大文本暂存、多会话对话流和阅读进度的本地自动深度持久化，免除用户登录体系的摩擦。

---

## 🛠️ 2. 关键技术选型与底层架构

### 2.1 框架与布局系统
* **核心框架**：Vue 3 + Vite + TypeScript，轻量高效。
* **样式系统**：Tailwind CSS v4 作为核心基础，配合 Vanilla CSS 自定义男主专属主题变量。
* **UI 组件库**：正式引入 `Element Plus`。在此基础上，我们通过 CSS 对 Dialog、Tabs、Inputs 等组件进行了深度定制（Reskin），去除了原生死板的工业化线条，使其完美融入 CoRead 的宣纸/暗黑的主题色调。

### 2.2 存储方案 (IndexedDB)
* ** localforage 库包装**：
  * `coread_books`：用于存储导入的 TXT 小说全量字符串，突破 LocalStorage 的 5MB 空间极限。
  * `coread_chat`：用于存储多会话聊天记录。
  * `coread_progress`：保存每本书下用户的 `chapterIndex` 与 `pageIndex`。
  * `coread_bookmarks`：保存用户添加的书签列表。

---

## 📐 3. 核心算法与特色机制

### 3.1 智能段落密度感知的防溢出分页算法
传统的字数分页容易在**短对话密集（换行极多）**的章节中，因为段落外边距（Margin）的累积撑爆容器高度，导致卡片下方的文字被 `overflow-hidden` 隐形“吞字”。
CoRead 采用了一套**动态安全系数估算公式**：

1. **计算段落密度**：
   $$\text{AvgParagraphLength} = \frac{\text{当前章节总字符数}}{\text{当前章节非空段落总数}}$$
2. **动态安全系数 ($\text{safetyFactor}$)**：
   * $\text{AvgParagraphLength} < 40$（短句/对话极密）：$\text{safetyFactor} = 0.40$
   * $\text{AvgParagraphLength} < 80$（中等密度对话）：$\text{safetyFactor} = 0.46$
   * $\text{AvgParagraphLength} < 120$（常规故事叙述）：$\text{safetyFactor} = 0.52$
   * 否则（大段落阐述）：$\text{safetyFactor} = 0.58$
3. **计算单页字符量 ($\text{PageSize}$)**：
   $$\text{PageSize} = \frac{\text{safetyFactor} \times (\text{可用渲染宽度} \times \text{可用渲染高度})}{\text{fontSize}^2 \times \text{lineHeight}}$$
   *(单页字符限制在 300 到 1500 字之间。通过引入 `isDoublePage` 和 `lineHeight` 状态变量，在用户切换单/双页或调整行距时，分页列表将即时重算刷新。)*

### 3.2 批注模糊定位与平滑滚动闪烁机制
为了解决用户点击统计面板中历史“高亮/随感/AI 片段”跳转到对应章节后无法精确找到句子的问题，我们设计了**精准 DOM 定位定位器**：

1. **位置时间戳绑定**：在 `chatStore` 流式交互中，所有的 `ChatMessage` 都会被打上对应的 `chapterIndex`、`pageIndex` 物理坐标以及 `quote`（划线原文）。
2. **滚动聚焦与动画闪烁**：
   * 点击历史项时，先将 `quote` 保存到 store 的 `pendingScrollQuote` 中并完成章节/页码跳转。
   * 页面组件在完成渲染后的 `nextTick` 中，自动检索当前页的 DOM 树：
     ```typescript
     const marks = document.querySelectorAll('.user-highlight-mark, .ai-annotation-mark')
     // 寻找 innerText 包含 pendingScrollQuote 的节点
     ```
   * 检索到节点后，执行：
     ```typescript
     targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
     targetElement.classList.add('highlight-flash')
     ```
   * 元素将随之进行 **3 次呼吸放大闪烁动效**（通过 CSS 变量和 BoxShadow 呼吸缩放），引导用户视线。

### 3.3 进度偏离返回机制 (latestReadProgress)
* 当用户点击书签、笔记定位到几十章前的历史位置去查阅时，系统会自动记录下跳转前的最新进度快照。
* 一旦当前所处进度偏离了快照，阅读器顶部将自动滑出一个毛玻璃质感的横条：**“您刚才阅读到：第 X 章第 Y 页 [回到最新进度 ↺]”**，点击即可一键切回，并自动销毁快照，保障阅读心智不迷失。

---

## 🎨 4. 精细化体验打磨 (Phase 1 Polishing)

| 痛点问题 | 修复与升级方案 | 视觉与交互成效 |
| :--- | :--- | :--- |
| **对话等待气泡肥大** | 去除了块级默认宽度，重构为 `w-fit clear-both` 自适应 | 气泡紧凑，宽度完美贴合文本或动效，不再肥大突兀。 |
| **吐字中光标乱跳** | 移除了打字机末尾的闪烁 `▋` 伪元素字符，流式直出 | 吐字效果如清泉流畅，无怪异竖线，阅读过程非常干净。 |
| **会话重命名不便** | 使用 `el-input` 原位编辑，并增设实体「确认」和「取消」按钮 | 可键盘回车保存、ESC取消，也可鼠标直观点击，彻底规避失焦冲突。 |
| **书签过于短小** | 重构书签 SVG，拉长高度到 `h-14`，偏移量调整为 `-translate-y-8` | 挂梢更含蓄，hover 下落坠入幅度更深，体验更为灵动。 |
| **统计弹窗死板** | 重写 Element Plus 的样式，Dialog 全面融入莫兰迪和男主背景色 | 弹窗扩展至 `800px`，卡片带磨砂浮雕阴影和跳转特效。 |

---

## 🚀 5. 后续研发建议 (Phase 2)
1. **防剧透摘要库**：在导入书籍时异步调用轻量级模型，按章节存入大纲，根据阅读进度动态喂给 LLM。
2. **WebSocket 主动推送**：在用户长时间停留、深夜翻页等场景，由后端向前端推送伴侣的主动关怀。
3. **自定义伴侣头像与更多莫兰迪色系定制表单**。
