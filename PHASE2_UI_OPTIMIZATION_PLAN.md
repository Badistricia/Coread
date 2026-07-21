# Phase 2 UI Optimization Plan

本文档用于承接当前 Phase 1 修改后的二期 UI 优化。先列已确认错误/风险，再给出 UI 优化方向和实现细节。

## 已确认状态

- 已执行 `npm run build`，构建通过。
- 已用浏览器打开 `http://127.0.0.1:5173/`，导入 `novelTempDir/《飞鸟集》共读测试.txt` 后阅读页可正常打开。
- 已检查会话下拉、右侧工具栏、统计弹窗、角色管理页、新建角色弹窗。
- 目前没有首页/阅读页初始化级别的控制台错误。

## 必须先修的错误/风险

### 1. 统计弹窗内部使用了错误的 `defineModel`

位置：`frontend/src/components/ReadingStatsDialog.vue`

当前 `handleNavigate()` 内部调用：

```ts
const showChatDrawer = defineModel<boolean>('showChatDrawer')
```

问题：

- `defineModel` 是 `<script setup>` 编译宏，不应放在普通函数体内。
- 当前组件并没有声明 `showChatDrawer` model，也没有从父组件接收该值。
- 构建能过，但点击 AI 片段/笔记跳转并试图展开聊天栏时，这段逻辑不可靠。

建议：

- 删除函数体内 `defineModel`。
- 改为事件上抛：`emit('openChatDrawer')`。
- 父组件 `ReaderView.vue` 接收后设置 `showChatDrawer = true`。

### 2. 高亮、笔记、AI 片段写入时机不对

位置：`frontend/src/stores/chatStore.ts`

当前在发起请求前就写入 Highlight/Note：

```ts
if (quoteText) {
  recordsStore.addHighlight(...)
  recordsStore.addNote(...)
}
```

问题：

- 用户只是划线提问，也会被自动记为“高亮”和“笔记”，语义混乱。
- 网络请求失败时，高亮/笔记仍然已经保存。
- `addHighlight/addNote/addAiFragment` 没有 `await`，失败不会被感知。
- `finally` 中即使 SSE 失败，也会把兜底错误文案保存成 AI 研讨片段。

建议：

- 只有用户明确点击“高亮”时写 `HighlightRecord`。
- 只有用户明确点击“记笔记”或提交笔记表单时写 `NoteRecord`。
- AI 片段只在 AI 回复成功且内容不是错误兜底文案时写入。
- 所有记录写入都要 `await`，至少在控制台记录失败。

### 3. 顶部角色切换没有包含自定义角色

位置：`frontend/src/views/ReaderView.vue`

当前顶部仍遍历：

```vue
v-for="c in companionStore.companions"
```

问题：

- 自定义角色保存后，在“我的角色”页能看到，但阅读页顶部不能直接切换到自定义角色。

建议：

- 改为遍历 `companionStore.allCompanions`。
- 自定义角色数量多时，不要无限撑开顶部栏；改成“当前角色按钮 + 下拉菜单”。

### 4. 角色 Store 异步加载存在短暂空态风险

位置：`frontend/src/stores/companionStore.ts`

问题：

- Store 初始化时直接调用 `loadCustom()`，但没有显式 loading/ready 状态。
- 如果 `localStorage` 里保存的是自定义角色 id，刷新瞬间 `currentCompanion` 会先回退到第一个内置角色，加载完才恢复。

建议：

- 增加 `isLoaded`。
- 在 App/Reader 初始化时 `await companionStore.loadCustom()`。
- 如果当前 id 不存在，加载完成后再回退默认角色。

### 5. 会话管理 UI 仍偏“组件库默认”

位置：`frontend/src/components/ChatBox.vue`

问题：

- `el-select` 宽度只有 `w-28`，中文会话名稍长就截断，展开浮层像原始 Element Plus。
- 重命名、新建、清空三个 24px 圆形按钮挤在一起，视觉噪声高。
- 清空按钮红色过抢，在聊天头部显得危险操作常驻。

建议：

- 把会话区改成一个完整的 `SessionManager` 组件。
- 默认只显示“当前会话名 + 下拉箭头”，新建/重命名/清空放下拉菜单或更多菜单。
- 危险操作放在菜单底部，二次确认，不常驻红色图标。

## 二期 UI 总方向

目标不是“大改主题”，而是把现在的功能拼装感收束成统一的阅读产品体验。

关键词：

- 安静
- 轻量
- 有层级
- 少按钮常驻
- 重要操作清晰
- 危险操作收起
- 阅读区域优先

不要做：

- 不要新增大面积渐变背景。
- 不要把所有功能都做成卡片。
- 不要继续堆很多小圆形按钮。
- 不要让 Element Plus 默认样式直接裸露在核心界面。

## UI 优化模块

### 1. 会话管理重做

目标：解决当前最明显的“原始下拉 + 挤按钮”问题。

推荐布局：

```text
角色头像  角色名/身份                 当前会话 v
                                  更多 ...
```

点击“当前会话”打开自定义下拉：

```text
当前会话
最近会话列表
  会话 1        14:20
  会话 2        昨天

新建会话
重命名当前会话
清空当前会话
```

实现细节：

- 新增 `frontend/src/components/SessionManager.vue`。
- 用 `el-dropdown`，不要继续用窄 `el-select`。
- 下拉面板宽度建议 `220px`，列表项支持截断和 title。
- 当前会话名最多一行，超出省略。
- 新建和重命名可用 `ElMessageBox.prompt`，先不做复杂内联编辑。
- 清空用 `ElMessageBox.confirm`。
- 删除/清空这种危险动作只在菜单里出现，不在头部常驻红色按钮。

验收：

- 会话头部不拥挤。
- 10 个会话也能滚动选择。
- 长会话名不会撑爆布局。

### 2. 聊天输入区优化

问题：

- 输入框和发送按钮仍是普通表单组合。
- 发送按钮过大且文字态较重。
- 引用原文条与输入区视觉连接弱。

方案：

- 输入区做成一个统一 composer 容器。
- 引用条放在 composer 顶部，作为同一输入框的一部分。
- 发送按钮改 icon button，禁用态清晰。
- `回复中` 不挤占按钮宽度，改为按钮内 loading icon 或禁用态。

实现细节：

- 使用 `el-button` 的 `loading` 或 Element Plus icon。
- 输入框保留 textarea，自适应高度。
- 引用条右侧关闭按钮用 icon，不用文字 `✕`。

验收：

- 普通输入、引用输入、回复中三种状态高度稳定。
- 输入区不会因为文字变化跳动。

### 3. 右侧工具栏重做

问题：

- 当前工具栏贴在阅读卡片右边，像一根外挂按钮条。
- 图标含义不够直观，没有 aria/title 静态属性，自动化和可访问性都差。
- “双页”“L:1.6”“A+”“A-”混在 icon 区，视觉不统一。

方案：

- 工具栏改成“浮动阅读设置条”，分为两个层级：
  - 常驻：目录、聊天、记录、角色。
  - 点击设置后展开：字号、行距、单双页、主题。
- 常驻按钮只放图标，不放 `双页/L:1.6/A+` 这类文字。
- 设置类信息放 popover 面板。

实现细节：

- 保留 `ReaderSideToolbar.vue`，但拆出 `ReadingSettingsPopover.vue`。
- 每个按钮补 `aria-label` 和 `title`。
- 当前激活态统一用 `theme-bg-primary-light + color-primary`。
- 字号用 `el-input-number` 或 `el-slider`，行距用 `el-segmented`。
- 主题色按钮放进设置 popover，不再常驻 5 个小点。

验收：

- 阅读页常驻工具不超过 4 个按钮。
- 设置项展开后能明确看出当前值。
- 工具栏不遮挡书签、页脚和正文。

### 4. 统计弹窗视觉升级

问题：

- 现在弹窗像默认 Element Plus Tabs。
- 空态太空，用户不知道下一步能做什么。
- 书签/高亮/笔记/AI 片段列表样式没有形成阅读产品感。

方案：

- 统计弹窗改成“左侧分类 + 右侧列表详情”的结构，或保留 Tabs 但重写 tab header。
- 空态加入小图标和一个主行动作说明，但不要大段教程。
- 列表项使用统一 RecordItem。

实现细节：

- 新增 `ReadingRecordItem.vue`。
- 每条记录显示：
  - 类型 icon
  - 章节/页码
  - 内容摘要
  - 时间
  - 跳转/删除操作
- 删除按钮只 hover 时显示。
- 详情内容超过 3 行折叠，点击展开。

验收：

- 空态不显得像空白弹窗。
- 有 20 条记录时可扫描。
- 操作区不抢内容主体。

### 5. 我的角色页重做视觉层级

问题：

- 当前角色页是后台管理风格，和参考图的“创建陪读角色”情绪差距较大。
- 卡片缺少头像焦点和角色氛围。
- 新建表单是普通 Dialog，没有头像上传/预览核心。

方案：

- 角色页第一屏做成“角色选择/管理”页面，不是后台列表。
- 卡片更接近参考图：头像/首字在上方，角色名居中或半居中，性格标签明显，底部主题色条。
- 新建角色做成独立页面或大弹窗，突出头像、名字、人设。

实现细节：

- `MyCompanionsView.vue` 保持路由。
- 卡片宽度固定，推荐 `220-260px`。
- 每张卡片有：
  - 顶部氛围区，使用角色渐变色低透明背景。
  - 圆形头像/首字。
  - 名字、身份、3 个性格 tag。
  - 选中勾选角标。
  - 底部主色条。
- 自定义角色操作收进右上角更多菜单。
- 新建角色按钮放在卡片网格最后一张“新增卡片”，不要只放右上角按钮。

新建/编辑表单：

- 顶部头像/首字预览。
- 表单分两段：
  - 基础资料：名字、称呼、身份、关键词。
  - 人设 Prompt：说话语气、陪读风格、深夜提醒。
- 色彩选择放右侧或底部预览区，不要占据表单主流程。
- 提供“使用模板”按钮，但模板只填充，不保存。

验收：

- 角色页第一眼能看出“选角色”，不是“管理后台”。
- 新建角色流程能看到实时卡片预览。
- 内置/自定义状态清晰但不喧宾夺主。

### 6. 全局按钮体系收束

问题：

- 现在同时存在原生 button、Element Button、文字按钮、圆形 icon button、A+/A- 文本按钮，统一性不足。

方案：

- 定义三类按钮规范：
  - Primary：主要提交，例如保存、发送、导入。
  - Ghost/Icon：阅读页工具、轻操作。
  - Danger：删除、清空，只出现在菜单或确认弹窗中。

实现细节：

- 在 `style.css` 增加少量 class：
  - `.coread-icon-btn`
  - `.coread-primary-btn`
  - `.coread-danger-menu-item`
  - `.coread-toolbar-panel`
- 只加必要 class，不重写 Element Plus 全部主题。
- 所有 icon button 尺寸统一：32px 或 36px，不混 22/24/36。

验收：

- 同一页面中同级按钮尺寸一致。
- 危险操作不常驻高亮。
- hover/active/focus 态一致。

## 推荐执行顺序

1. 修 `ReadingStatsDialog.vue` 的 `defineModel` 和跳转展开聊天逻辑。
2. 修 `chatStore.ts` 记录写入时机，避免失败请求污染记录。
3. 顶部角色切换改为支持自定义角色，或者收成角色下拉。
4. 重做 `SessionManager.vue`，替换 ChatBox 头部会话管理。
5. 重做右侧工具栏，把阅读设置收进 popover。
6. 优化统计弹窗和记录列表。
7. 重做我的角色页卡片和新建表单视觉。
8. 最后统一按钮 class 和 Element Plus 局部主题覆盖。

## 验证清单

- `npm run build`
- 刷新后自定义角色不会短暂错选。
- 自定义角色能在阅读页直接切换。
- 会话名长、会话数量多时下拉仍可用。
- 清空会话只在二次确认后发生。
- SSE 失败不会生成 AI 片段记录。
- 只划线提问不会自动污染“高亮/笔记”列表，除非用户明确保存。
- 右侧工具栏常驻按钮不超过 4 个。
- 统计弹窗空态、有数据态、删除、跳转都正常。
- 角色页移动端和 1440px 桌面宽度都无重叠。
