import localforage from 'localforage'

// 独立的 IndexedDB 实例
const bookStore = localforage.createInstance({ name: 'coread_books' })
const chatStore = localforage.createInstance({ name: 'coread_chat' })
const progressStore = localforage.createInstance({ name: 'coread_progress' })
const bookmarkStore = localforage.createInstance({ name: 'coread_bookmarks' })

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
