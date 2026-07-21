import localforage from 'localforage'
import type { Companion } from '@/repositories/types'

// 独立的 IndexedDB 实例
const bookStore = localforage.createInstance({ name: 'coread_books' })
const chatStore = localforage.createInstance({ name: 'coread_chat' })
const progressStore = localforage.createInstance({ name: 'coread_progress' })
const bookmarkStore = localforage.createInstance({ name: 'coread_bookmarks' })
const highlightStore = localforage.createInstance({ name: 'coread_highlights' })
const noteStore = localforage.createInstance({ name: 'coread_notes' })
const aiFragmentStore = localforage.createInstance({ name: 'coread_aifragments' })
const customCompanionStore = localforage.createInstance({ name: 'coread_custom_companions' })

// ── 书籍存取 ──
export async function saveBook(bookId: string, content: string): Promise<void> {
  await bookStore.setItem(bookId, content)
}

export async function loadBook(bookId: string): Promise<string | null> {
  return bookStore.getItem<string>(bookId)
}

// ── 聊天会话 (多会话支持) ──
export async function saveChatSessions(
  bookId: string,
  companionId: string,
  sessions: any[],
): Promise<void> {
  await chatStore.setItem(`${bookId}_${companionId}_sessions`, sessions)
}

export async function loadChatSessions(
  bookId: string,
  companionId: string,
): Promise<any[] | null> {
  return chatStore.getItem<any[]>(`${bookId}_${companionId}_sessions`)
}

// ── 阅读进度 ──
export interface ReadingProgress {
  chapter: number
  page: number
  updatedAt: string
}

export async function saveProgress(
  bookId: string,
  progress: ReadingProgress,
): Promise<void> {
  await progressStore.setItem(bookId, progress)
}

export async function loadProgress(
  bookId: string,
): Promise<ReadingProgress | null> {
  return progressStore.getItem<ReadingProgress>(bookId)
}

// ── 书签存取 ──
export interface Bookmark {
  id: string
  bookId: string
  chapterIndex: number
  pageIndex: number
  chapterTitle: string
  excerpt: string
  createdAt: string
}

export async function saveBookmarks(
  bookId: string,
  bookmarks: Bookmark[],
): Promise<void> {
  await bookmarkStore.setItem(bookId, bookmarks)
}

export async function loadBookmarks(
  bookId: string,
): Promise<Bookmark[] | null> {
  return bookmarkStore.getItem<Bookmark[]>(bookId)
}

// ── 高亮 ──
export interface HighlightRecord {
  id: string
  bookId: string
  chapterIndex: number
  pageIndex: number
  quote: string
  createdAt: string
}
export async function saveHighlights(bookId: string, list: HighlightRecord[]): Promise<void> {
  await highlightStore.setItem(bookId, list)
}
export async function loadHighlights(bookId: string): Promise<HighlightRecord[] | null> {
  return highlightStore.getItem<HighlightRecord[]>(bookId)
}

// ── 笔记 ──
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
export async function saveNotes(bookId: string, list: NoteRecord[]): Promise<void> {
  await noteStore.setItem(bookId, list)
}
export async function loadNotes(bookId: string): Promise<NoteRecord[] | null> {
  return noteStore.getItem<NoteRecord[]>(bookId)
}

// ── AI 片段 ──
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
export async function saveAiFragments(bookId: string, list: AiFragmentRecord[]): Promise<void> {
  await aiFragmentStore.setItem(bookId, list)
}
export async function loadAiFragments(bookId: string): Promise<AiFragmentRecord[] | null> {
  return aiFragmentStore.getItem<AiFragmentRecord[]>(bookId)
}

// ── 自定义伴侣 ──
// 类型定义已迁移至 @/repositories/types，此处保留以兼容旧引用
export type { Companion } from '@/repositories/types'

/**
 * @deprecated 已迁移至 repositories/companionRepository，请使用 companionRepo 代替
 */
export async function saveCustomCompanions(list: Companion[]): Promise<void> {
  await customCompanionStore.setItem('custom_companions', list)
}

/**
 * @deprecated 已迁移至 repositories/companionRepository，请使用 companionRepo 代替
 */
export async function loadCustomCompanions(): Promise<Companion[] | null> {
  return customCompanionStore.getItem<Companion[]>('custom_companions')
}
