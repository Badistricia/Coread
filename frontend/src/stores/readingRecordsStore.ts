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

  // ── 初始化加载所有记录 ──
  async function initRecords(bookId: string) {
    currentBookId.value = bookId
    
    const [bList, hList, nList, fList] = await Promise.all([
      loadBookmarks(bookId),
      loadHighlights(bookId),
      loadNotes(bookId),
      loadAiFragments(bookId)
    ])

    bookmarks.value = bList || []
    highlights.value = hList || []
    notes.value = nList || []
    aiFragments.value = fList || []
  }

  // ── 书签操作 ──
  async function addBookmark(b: Bookmark) {
    if (bookmarks.value.some(x => x.chapterIndex === b.chapterIndex && x.pageIndex === b.pageIndex)) {
      return // 防重复同一页
    }
    bookmarks.value.push(b)
    await saveBookmarks(currentBookId.value, bookmarks.value)
  }

  async function removeBookmark(id: string) {
    bookmarks.value = bookmarks.value.filter(x => x.id !== id)
    await saveBookmarks(currentBookId.value, bookmarks.value)
  }

  // ── 高亮操作 ──
  async function addHighlight(h: HighlightRecord) {
    highlights.value.push(h)
    await saveHighlights(currentBookId.value, highlights.value)
  }

  async function removeHighlight(id: string) {
    highlights.value = highlights.value.filter(x => x.id !== id)
    await saveHighlights(currentBookId.value, highlights.value)
  }

  // ── 随笔笔记操作 ──
  async function addNote(n: NoteRecord) {
    notes.value.push(n)
    await saveNotes(currentBookId.value, notes.value)
  }

  async function removeNote(id: string) {
    notes.value = notes.value.filter(x => x.id !== id)
    await saveNotes(currentBookId.value, notes.value)
  }

  // ── AI 片段操作 ──
  async function addAiFragment(f: AiFragmentRecord) {
    aiFragments.value.push(f)
    await saveAiFragments(currentBookId.value, aiFragments.value)
  }

  async function removeAiFragment(id: string) {
    aiFragments.value = aiFragments.value.filter(x => x.id !== id)
    await saveAiFragments(currentBookId.value, aiFragments.value)
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
