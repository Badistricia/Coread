import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  type Bookmark,
  type HighlightRecord,
  type NoteRecord,
  type AiFragmentRecord,
  saveBookmarks,
  loadBookmarks,
  saveHighlights,
  loadHighlights,
  saveNotes,
  loadNotes,
  saveAiFragments,
  loadAiFragments
} from '@/utils/storage'

export const useReadingRecordsStore = defineStore('readingRecords', () => {
  const currentBookId = ref('')

  const bookmarks = ref<Bookmark[]>([])
  const highlights = ref<HighlightRecord[]>([])
  const notes = ref<NoteRecord[]>([])
  const aiFragments = ref<AiFragmentRecord[]>([])

  function resolveBookId(recordBookId?: string) {
    return recordBookId || currentBookId.value
  }

  // ── 初始化加载所有记录 ──
  async function initRecords(bookId: string) {
    currentBookId.value = bookId
    
    const [bList, hList, nList, fList] = await Promise.all([
      loadBookmarks(bookId),
      loadHighlights(bookId),
      loadNotes(bookId),
      loadAiFragments(bookId)
    ])

    if (currentBookId.value !== bookId) return

    bookmarks.value = bList || []
    highlights.value = hList || []
    notes.value = nList || []
    aiFragments.value = fList || []
  }

  // ── 书签操作 ──
  async function addBookmark(b: Bookmark) {
    const bookId = resolveBookId(b.bookId)
    if (!bookId) return
    currentBookId.value = bookId

    if (bookmarks.value.some(x => x.bookId === bookId && x.chapterIndex === b.chapterIndex && x.pageIndex === b.pageIndex)) {
      return // 防重复同一页
    }
    const next = [...bookmarks.value, b]
    bookmarks.value = next
    await saveBookmarks(bookId, next.filter(x => x.bookId === bookId))
  }

  async function removeBookmark(id: string) {
    const target = bookmarks.value.find(x => x.id === id)
    const bookId = resolveBookId(target?.bookId)
    if (!bookId) return
    const next = bookmarks.value.filter(x => x.id !== id)
    bookmarks.value = next
    await saveBookmarks(bookId, next.filter(x => x.bookId === bookId))
  }

  // ── 高亮操作 ──
  async function addHighlight(h: HighlightRecord) {
    const bookId = resolveBookId(h.bookId)
    if (!bookId) return
    currentBookId.value = bookId
    const next = [...highlights.value, h]
    highlights.value = next
    await saveHighlights(bookId, next.filter(x => x.bookId === bookId))
  }

  async function removeHighlight(id: string) {
    const target = highlights.value.find(x => x.id === id)
    const bookId = resolveBookId(target?.bookId)
    if (!bookId) return
    const next = highlights.value.filter(x => x.id !== id)
    highlights.value = next
    await saveHighlights(bookId, next.filter(x => x.bookId === bookId))
  }

  // ── 随笔笔记操作 ──
  async function addNote(n: NoteRecord) {
    const bookId = resolveBookId(n.bookId)
    if (!bookId) return
    currentBookId.value = bookId
    const next = [...notes.value, n]
    notes.value = next
    await saveNotes(bookId, next.filter(x => x.bookId === bookId))
  }

  async function removeNote(id: string) {
    const target = notes.value.find(x => x.id === id)
    const bookId = resolveBookId(target?.bookId)
    if (!bookId) return
    const next = notes.value.filter(x => x.id !== id)
    notes.value = next
    await saveNotes(bookId, next.filter(x => x.bookId === bookId))
  }

  // ── AI 片段操作 ──
  async function addAiFragment(f: AiFragmentRecord) {
    const bookId = resolveBookId(f.bookId)
    if (!bookId) return
    currentBookId.value = bookId
    const next = [...aiFragments.value, f]
    aiFragments.value = next
    await saveAiFragments(bookId, next.filter(x => x.bookId === bookId))
  }

  async function removeAiFragment(id: string) {
    const target = aiFragments.value.find(x => x.id === id)
    const bookId = resolveBookId(target?.bookId)
    if (!bookId) return
    const next = aiFragments.value.filter(x => x.id !== id)
    aiFragments.value = next
    await saveAiFragments(bookId, next.filter(x => x.bookId === bookId))
  }

  return {
    bookmarks,
    highlights,
    notes,
    aiFragments,
    initRecords,
    addBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    addNote,
    removeNote,
    addAiFragment,
    removeAiFragment
  }
})
