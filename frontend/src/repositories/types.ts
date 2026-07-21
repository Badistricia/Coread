/**
 * CoRead 数据仓库类型定义
 *
 * 本文件是全部持久化数据的 Schema 定义，也是未来 SQL 迁移时的表结构参考。
 *
 * SQL 迁移映射（以 PostgreSQL 为例）：
 *   Companion        → companions 表
 *   BookMeta         → books 表
 *   ReadingProgress  → reading_progress 表（book_id FK）
 *   Bookmark         → bookmarks 表（book_id FK）
 *   HighlightRecord  → highlights 表（book_id FK）
 *   NoteRecord       → notes 表（book_id + highlight_id FK）
 *   AiFragmentRecord → ai_fragments 表（book_id + companion_id FK）
 *   ChatSession      → chat_sessions 表（book_id + companion_id 复合键）
 *   ChatMessage      → chat_messages 表（session_id FK）
 */

// ═══════════════════════════════════════════
// 角色 / Companion
// ═══════════════════════════════════════════

export interface Companion {
  id: string // 主键。内置角色无前缀，自定义角色以 'custom_' 开头
  name: string // 角色名，如 "陆沉"
  title: string // 身份名号，如 "万甄集团 CEO"
  description: string // 人设背景描述 — 用于 System Prompt「角色背景」
  personality: string // 性格标签，逗号分隔，如 "成熟, 克制, 引经据典"
  themeClass: string // CSS 主题 class，如 "theme-luchen"
  accentStart: string // 主题渐变色起始，如 "#8b2635"
  accentEnd: string // 主题渐变色结束，如 "#c4956a"
  isCustom?: boolean // 是否为自定义角色
  /** @deprecated 预留字段，当前前端/后端均未消费 */
  avatar?: string
  tone?: string // AI 说话语气描述
  readingStyle?: string // 读书批注风格
  midnightStyle?: string // 深夜问候风格
  callToUser?: string // 如何称呼用户，如 "兔子"、"未婚妻"
}

// ═══════════════════════════════════════════
// 书籍
// ═══════════════════════════════════════════

export interface BookMeta {
  id: string // 主键
  title: string
  totalChapters: number
}

// ═══════════════════════════════════════════
// 阅读进度
// ═══════════════════════════════════════════

export interface ReadingProgress {
  chapter: number // 0-based
  page: number // 0-based
  updatedAt: string // ISO datetime
}

// ═══════════════════════════════════════════
// 书签
// ═══════════════════════════════════════════

export interface Bookmark {
  id: string // 主键
  bookId: string // FK → books
  chapterIndex: number
  pageIndex: number
  chapterTitle: string
  excerpt: string
  createdAt: string
}

// ═══════════════════════════════════════════
// 高亮
// ═══════════════════════════════════════════

export interface HighlightRecord {
  id: string // 主键
  bookId: string // FK → books
  chapterIndex: number
  pageIndex: number
  quote: string
  createdAt: string
}

// ═══════════════════════════════════════════
// 笔记
// ═══════════════════════════════════════════

export interface NoteRecord {
  id: string // 主键
  bookId: string // FK → books
  highlightId?: string // FK → highlights（可选）
  chapterIndex: number
  pageIndex: number
  quote?: string
  content: string
  createdAt: string
  updatedAt: string
}

// ═══════════════════════════════════════════
// AI 对话片段
// ═══════════════════════════════════════════

export interface AiFragmentRecord {
  id: string // 主键
  bookId: string // FK → books
  companionId: string // FK → companions
  sessionId: string // FK → chat_sessions
  chapterIndex: number
  pageIndex: number
  quote: string
  userMessage: string
  aiMessage: string
  createdAt: string
}

// ═══════════════════════════════════════════
// 聊天
// ═══════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  quote?: string
  isStreaming?: boolean
  chapterIndex?: number
  pageIndex?: number
  createdAt?: string
}

export interface ChatSession {
  id: string // 主键
  name: string
  messages: ChatMessage[]
  createdAt: string
}
