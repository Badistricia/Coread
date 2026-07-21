# Phase 1 Completion Guide

本文档用于指导后续 AI 继续完成 Phase 1 打磨。目标是纠偏当前实现方向，保持现有系统主题和代码风格，做外科手术式修改。

## 总原则

- 不要大范围格式化、重构无关代码。
- 优先复用现有 `Pinia Store + localforage + Vue 3 + Tailwind CSS + Element Plus` 结构。
- Element Plus 只用于成熟控件：Select、Dropdown、Button、Dialog、Tabs、Popconfirm、Tooltip、Input、Form、Upload。不要为了引入组件库重写整套视觉。
- 新功能主题必须跟随现有 CSS 变量，例如 `--color-primary`、`--color-read-bg`、`--color-read-text`、`theme-*` class。
- 角色参考图只参考布局和信息层级，不参考整体黑红主题。
- 不要继续把所有逻辑堆进 `ReaderView.vue`。新增功能优先拆小组件或放 Store。

## 当前提交的问题

最近提交 `d7ab160 feat: integrate Element Plus and enhance chat and reader features` 已经做了部分工作，但与原需求有明显偏差：

- 第 6 点“新增我的角色模块”实际没有完成。
- `ReaderView.vue` 新增过多职责，书签、统计、分页、跳转、阅读设置全部混在同一文件。
- 统计弹窗把聊天消息中的 `quote` 当成高亮/笔记来源，这是临时推导，不是可靠数据模型。
- 书签只保存页码和首段摘录，详情跳转时用 excerpt 查找高亮 DOM，书签本身并不会生成高亮，定位不可靠。
- `readerStore.prevPage()` 仍使用旧分页公式，没有同步单双页和行距设置。
- 切换单双页、字号、行距后，没有统一修正当前页码，可能出现当前页超过总页数。
- 等待气泡仍继承普通聊天气泡的大 padding 和切角，视觉上还会偏大、不自然。
- Element Plus 已引入，但控件使用不统一，阅读工具栏仍混用手写 SVG 和原生 button。
- `package-lock.json` 被 `.gitignore` 忽略，没有随 `package.json` 的 Element Plus 依赖一起纳入提交；后续需要确认团队是否要提交锁文件。
- 根目录未跟踪的 `COREAD_ARCHITECTURE.md` 是生成说明，不要默认纳入功能提交，除非用户确认。

## 推荐完成顺序

### 1. 会话区 UI 和重命名

目标：解决需求 1、2、3。

实现细节：

- 在 `ChatBox.vue` 中保留 Element Plus，但让会话选择、新建、清空、重命名风格统一。
- 会话选择建议使用 `el-select`，如果宽度太窄可改成 `el-dropdown`，显示当前会话名，菜单里列会话。
- 新建、重命名、清空使用图标按钮，配 `el-tooltip`。清空必须用 `ElMessageBox.confirm` 或 `el-popconfirm`，不要再用原生 `confirm()`。
- 重命名输入保留原位编辑即可，Enter 保存，Esc 取消；空名字不保存。
- `chatStore.updateSessionName()` 当前可用，但 `_bookId/_companionId` 参数没用，可以保留签名避免改调用面，不要额外抽象。
- 等待气泡单独处理，不要继承普通气泡的大 padding：
  - loading 状态外层 class 增加 `ai-loading-bubble`。
  - 样式建议：`px-3 py-2 rounded-full w-fit min-w-[44px]`。
  - loading 气泡不要 `rounded-bl-none`，避免底部切平。
  - 三点动画高度控制在 18-22px 内。

验收标准：

- AI 首 token 到达前显示小而自然的三点气泡。
- 会话下拉、新建、清空、重命名不是浏览器原生 UI。
- 重命名后刷新仍保留名称。

### 2. 阅读设置：单双页和行距

目标：解决需求 4。

实现细节：

- 在 `readerStore.ts` 中抽一个内部函数计算当前配置下的页面列表或 pageSize，避免 `currentChapterPages` 和 `prevPage()` 两套公式。
- `prevPage()` 翻到上一章最后一页时必须使用当前 `isDoublePage`、`lineHeight`、`fontSize`、视口宽高、聊天栏开关。
- 新增或复用 `clampCurrentPage()`：
  - 当 `fontSize`、`lineHeight`、`isDoublePage`、`viewportWidth`、`viewportHeight`、`isChatOpen` 改变时，如果 `currentPageIndex >= totalPages`，修正到 `totalPages - 1`。
  - 修正时最小值为 0。
- 单页模式不只是 CSS `columns: 1`，分页字符量也要按单页模式重新计算。
- 行距不要只用“循环按钮”作为最终形态。推荐用 Element Plus 的 `el-slider` 或 `el-segmented`：
  - 简单方案：`el-segmented`，选项 `1.4 / 1.6 / 1.8 / 2.0 / 2.2`。
  - 当前右侧工具栏空间有限，可点击行距按钮打开一个小 popover。
- 右下角页码显示直接读取 `readerStore.totalPages` 和修正后的 `currentPageIndex`，确保联动。

验收标准：

- 单页/双页切换后当前页码不会越界。
- 行距调整后分页数立即变化，翻页正常。
- 从章节第一页按上一页到上一章最后一页时，页数计算正确。

### 3. 右侧工具栏分组

目标：解决需求 5.2 的布局方向。

实现细节：

- 从 `ReaderView.vue` 拆出 `ReaderSideToolbar.vue`。
- 工具栏分三段：
  - 第一段：目录入口。
  - 第二段：功能入口，例如 AI 侧边栏开关、书签/笔记/高亮/AI 片段统计。
  - 第三段：阅读设置，例如单双页、行距、字号、主题色。
- 图标优先用 Element Plus Icons 或已有 lucide/icon 库。不要新增手写 SVG，除非项目里没有对应图标。
- 统计、打卡等更复杂功能先不要耦合进书签弹窗。当前只做阅读记录统计弹窗。

验收标准：

- 右侧工具栏职责清晰。
- 目录、功能、阅读设置视觉分组明确。
- 不影响现有目录弹窗、聊天抽屉开关。

### 4. 书签、笔记、高亮、AI 片段的数据模型

目标：解决需求 5。

建议最小模型：

```ts
export interface BookmarkRecord {
  id: string
  bookId: string
  chapterIndex: number
  pageIndex: number
  chapterTitle: string
  excerpt: string
  createdAt: string
}

export interface HighlightRecord {
  id: string
  bookId: string
  chapterIndex: number
  pageIndex: number
  quote: string
  createdAt: string
}

export interface NoteRecord {
  id: string
  bookId: string
  highlightId?: string
  chapterIndex: number
  pageIndex: number
  quote?: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface AiFragmentRecord {
  id: string
  bookId: string
  companionId: string
  sessionId: string
  chapterIndex: number
  pageIndex: number
  quote: string
  userMessage: string
  aiMessage: string
  createdAt: string
}
```

实现细节：

- 存储仍用 `localforage`，可以沿用 `storage.ts`。
- 不要再从 `chatStore.sessions` 临时扫描生成全部统计。发送划线提问成功后，明确写入 `AiFragmentRecord`。
- 用户只划线不提问时，写入 `HighlightRecord`。
- 用户在划线上写随感时，写入 `NoteRecord`。
- 现有聊天消息里的 `quote/chapterIndex/pageIndex/createdAt` 可以保留，用于聊天展示和兼容旧数据。

验收标准：

- 书签、笔记、高亮、AI 片段数量分别准确。
- 统计弹窗能分别查看详情。
- 点击详情能跳转到章节和页码。
- 从历史位置可一键回到最新阅读进度。

### 5. 书签交互

目标：解决需求 5.1。

实现细节：

- 阅读卡片右上角保留下落式书签。
- 未添加时：默认只露出一点点或半透明，hover 下落。
- 已添加时：固定显示主题色书签。
- 点击当前页：
  - 若未收藏，新增书签。
  - 若已收藏，取消书签。
- 书签 excerpt 用当前页首个非空段落即可，避免复杂 DOM 定位。
- 书签详情跳转只承诺跳到页，不承诺滚到某个高亮，除非对应记录有 `quote`。

验收标准：

- 同一页不会重复添加多个书签。
- 刷新后书签状态仍正确。
- 书签列表删除后，当前页书签状态同步变化。

### 6. 统计弹窗

目标：解决需求 5 的详情查看和跳转。

实现细节：

- 拆出 `ReadingStatsDialog.vue`。
- 使用 `el-dialog + el-tabs`。
- tabs 建议：
  - 书签
  - 高亮
  - 笔记
  - AI 片段
- 每个列表项显示：
  - 章节标题/页码
  - 摘录或内容
  - 创建时间
  - 跳转按钮
  - 删除按钮，删除前确认
- 跳转前调用 `readerStore.recordLatestReadProgress()`，但要避免重复覆盖：
  - 如果当前没有 `latestReadProgress`，记录当前页。
  - 如果已经有，就不要覆盖，保证“回到最新进度”始终回到用户原本阅读处。

验收标准：

- 从统计弹窗跳到旧位置后，顶部出现返回最新进度提示。
- 连续跳多个历史记录后，返回仍回到最初离开的阅读进度。
- 返回后提示消失。

### 7. 我的角色模块

目标：解决需求 6。

现状：

- 前端角色来自 `frontend/src/config/companions.ts`。
- 后端角色来自 `backend/characters.json`。
- 后端 `/api/companions` 已存在，但前端当前没有使用它。
- 后端 prompt 依赖字段包括 `tone`、`reading_style`、`midnight_style`、`call_to_user` 等。

推荐最小方案：

- Phase 1 先做本地自定义角色，不做后端持久化写文件。
- 前端 `companionStore` 合并：
  - 内置角色：来自现有 `companions.ts` 或后端 `/api/companions`。
  - 自定义角色：来自 localforage/localStorage。
- 聊天请求如果选择自定义角色，除 `companion_id` 外再传 `custom_companion` 对象。
- 后端 `ChatRequest` 增加可选 `custom_companion`，如果存在就用它构建 prompt；不存在则走 `characters.json` 内置角色。
- 不要直接从浏览器写 `backend/characters.json`。

前端角色字段建议：

```ts
export interface Companion {
  id: string
  name: string
  title: string
  description: string
  personality: string
  themeClass: string
  accentStart: string
  accentEnd: string
  isCustom?: boolean
  avatar?: string
  tone?: string
  readingStyle?: string
  midnightStyle?: string
  callToUser?: string
}
```

角色页面建议：

- 新增 `CompanionManageView.vue` 或 `MyCompanionsView.vue`。
- 路由路径建议 `/companions`。
- 从阅读页顶部角色切换区旁边加一个“我的角色”入口。
- 页面结构：
  - 顶部：返回、标题“我的角色”。
  - 主区：角色卡片网格，包含内置角色和自定义角色。
  - 卡片：头像/首字、名字、短标题、性格标签、主题色条、选中态。
  - 操作：选择使用、新建、编辑、删除自定义角色。
  - 内置角色只允许查看/复制为自定义，不允许删除。
- 新建/编辑表单：
  - 头像上传或首字头像。
  - 角色名字。
  - 称呼用户。
  - 简短身份/标题。
  - 人设描述。
  - 说话风格。
  - 陪读风格。
  - 深夜提醒风格。
  - 主色/辅助色。
  - 使用模板按钮。
- 模板按钮只填充表单，不自动保存。
- 自定义角色最多 5 个，可按参考图提示。

验收标准：

- 能新增角色并在顶部角色切换中出现。
- 选择自定义角色后，聊天使用对应人设。
- 刷新页面后自定义角色仍存在。
- 删除当前正在使用的自定义角色时，自动切回默认角色。
- 自定义角色拥有自己的聊天会话隔离 key。

## 建议文件拆分

优先新增或调整这些文件：

- `frontend/src/components/ReaderSideToolbar.vue`
- `frontend/src/components/BookmarkRibbon.vue`
- `frontend/src/components/ReadingStatsDialog.vue`
- `frontend/src/views/MyCompanionsView.vue`
- `frontend/src/stores/companionStore.ts`
- `frontend/src/stores/readerStore.ts`
- `frontend/src/stores/readingRecordsStore.ts`
- `frontend/src/utils/storage.ts`
- `frontend/src/router/index.ts`
- `backend/app/api/routes/chat.py`
- `backend/app/prompts/prompt_manager.py`

注意：如果为了简单，`readingRecordsStore.ts` 可以暂缓，先把记录存取函数放在 `storage.ts`，但不要把聚合逻辑继续放大在 `ReaderView.vue`。

## 测试清单

- `npm run build`
- 导入 TXT 后正常加载阅读页。
- 会话新建、切换、重命名、清空均正常。
- AI 回复前 loading 气泡尺寸自然，回复后正常流式显示。
- 单页/双页切换后页码和内容同步。
- 行距调整后页数变化且不会越界。
- 当前页添加/取消书签后刷新仍正确。
- 统计弹窗四类记录为空态和有数据态都正常。
- 从记录跳转到旧位置，再返回最新进度。
- 新增自定义角色，选择后聊天，刷新后仍保留。

## 不建议现在做

- 不要做登录、多端同步、云端角色市场。
- 不要引入新的大型状态管理或 UI 框架。
- 不要把打卡、阅读统计、书签笔记强行塞进同一个复杂弹窗。
- 不要把后端 `characters.json` 做成前端直接可写。
- 不要重写阅读分页算法，只修复当前新增配置导致的不一致。
