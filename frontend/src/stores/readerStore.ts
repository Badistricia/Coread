import { defineStore } from 'pinia'
import { ref, computed, markRaw, watch } from 'vue'
import type { Ref } from 'vue'
import { type Chapter, paginateText } from '@/utils/reader'

export interface BookMeta {
  id: string
  title: string
  totalChapters: number
}

export const useReaderStore = defineStore('reader', () => {
  const book: Ref<BookMeta | null> = ref(null)
  const chapters: Ref<Chapter[]> = ref([])
  const currentChapterIndex: Ref<number> = ref(0) // 0-based index
  const currentPageIndex: Ref<number> = ref(0) // 0-based index

  // ── 微信读书级配置状态 ──
  const fontSize: Ref<number> = ref(
    Number(localStorage.getItem('coread_font_size')) || 18
  )
  const themeStyle: Ref<string> = ref(
    localStorage.getItem('coread_theme_style') || 'read-theme-a'
  )
  const isDoublePage: Ref<boolean> = ref(
    localStorage.getItem('coread_is_double_page') !== 'false'
  )
  const lineHeight: Ref<number> = ref(
    Number(localStorage.getItem('coread_line_height')) || 1.6
  )

  // ── 跳转历史与进度切回 ──
  const latestReadProgress: Ref<{ chapterIndex: number; pageIndex: number } | null> = ref(null)

  // ── 视口与侧边栏宽度感知状态 ──
  const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
  const isChatOpen = ref(true)

  // ── 阅读计时器（Phase 1: 会话级计时，刷新后重置） ──
  const readingStartTime: Ref<number> = ref(Date.now())

  const dailyReadMinutes = computed<number>(() => {
    return Math.floor((Date.now() - readingStartTime.value) / 60000)
  })

  const currentChapter = computed<Chapter | null>(() => {
    if (chapters.value.length === 0 || currentChapterIndex.value < 0 || currentChapterIndex.value >= chapters.value.length) {
      return null
    }
    return chapters.value[currentChapterIndex.value]
  })

  // ── 内部计算当前配置下的单页字符数上限 ──
  function getPageSizeLimit(chapterContent: string, lhValue: number, doubleMode: boolean) {
    if (!chapterContent) return 1000

    const paragraphs = chapterContent.split('\n').map(p => p.trim()).filter(Boolean)
    const avgParagraphLength = paragraphs.length > 0 ? chapterContent.length / paragraphs.length : 1000
    
    // 动态安全系数 (0.4 到 0.58 之间)
    let safetyFactor = 0.58
    if (avgParagraphLength < 40) {
      safetyFactor = 0.4
    } else if (avgParagraphLength < 80) {
      safetyFactor = 0.46
    } else if (avgParagraphLength < 120) {
      safetyFactor = 0.52
    }
    
    const sidebarWidth = isChatOpen.value ? 384 : 0
    const cardContentWidth = Math.min(viewportWidth.value - sidebarWidth - 144, 1280)
    const cardContentHeight = Math.max(200, viewportHeight.value - 240)
    
    const activeWidth = doubleMode 
      ? Math.max(200, cardContentWidth - 64)
      : Math.max(200, cardContentWidth)
    
    const calculatedPageSize = Math.floor(
      (safetyFactor * (activeWidth * cardContentHeight)) / (fontSize.value * fontSize.value * lhValue)
    )
    
    return Math.max(300, Math.min(calculatedPageSize, 1500))
  }

  // ── 动态响应式分页列表 (数学算力防溢出排版) ──
  const currentChapterPages = computed<string[]>(() => {
    if (!currentChapter.value) return ['']
    
    // 显式引用状态，确保单/双页切换和行距调整时，Pinia 触发重新计算分页
    const doubleMode = isDoublePage.value
    const lh = lineHeight.value
    const text = currentChapter.value.content
    
    const pageSize = getPageSizeLimit(text, lh, doubleMode)
    return paginateText(text, pageSize)
  })

  const totalPages = computed<number>(() => {
    return currentChapterPages.value.length
  })

  const currentPageContent = computed<string>(() => {
    const pageIndex = Math.min(currentPageIndex.value, totalPages.value - 1)
    return currentChapterPages.value[pageIndex] || ''
  })

  // ── 限制当前页码不越界 ──
  function clampCurrentPage() {
    if (currentPageIndex.value >= totalPages.value) {
      currentPageIndex.value = Math.max(0, totalPages.value - 1)
    }
  }

  // 当总页数因排版或章节变化而变动时，执行无缝边界修正，防越界吞页
  watch(totalPages, () => {
    clampCurrentPage()
  })

  function setBook(id: string, title: string, bookChapters: Chapter[]) {
    book.value = {
      id,
      title,
      totalChapters: bookChapters.length,
    }
    chapters.value = markRaw(bookChapters)
    currentChapterIndex.value = 0
    currentPageIndex.value = 0
  }

  function goToPage(page: number) {
    if (page >= 0 && page < totalPages.value) {
      currentPageIndex.value = page
    }
  }

  function nextPage() {
    if (currentPageIndex.value < totalPages.value - 1) {
      currentPageIndex.value++
      return true
    } else if (currentChapterIndex.value < chapters.value.length - 1) {
      currentChapterIndex.value++
      currentPageIndex.value = 0
      return true
    }
    return false
  }

  function prevPage() {
    if (currentPageIndex.value > 0) {
      currentPageIndex.value--
      return true
    } else if (currentChapterIndex.value > 0) {
      currentChapterIndex.value--
      const prevChapter = chapters.value[currentChapterIndex.value]
      const pageSize = getPageSizeLimit(prevChapter.content, lineHeight.value, isDoublePage.value)
      const prevPages = paginateText(prevChapter.content, pageSize)
      currentPageIndex.value = prevPages.length - 1
      return true
    }
    return false
  }

  // ── 视口改变同步 Action ──
  function updateViewport(width: number, height: number, chatOpen: boolean) {
    viewportWidth.value = width
    viewportHeight.value = height
    isChatOpen.value = chatOpen
  }

  // ── 配置修改方法 ──
  function changeFontSize(delta: number) {
    const nextSize = fontSize.value + delta
    if (nextSize >= 14 && nextSize <= 26) {
      fontSize.value = nextSize
      localStorage.setItem('coread_font_size', String(nextSize))
      
      if (currentPageIndex.value >= totalPages.value) {
        currentPageIndex.value = totalPages.value - 1
      }
    }
  }

  function setThemeStyle(style: string) {
    themeStyle.value = style
    localStorage.setItem('coread_theme_style', style)
  }

  function resetReadingTimer() {
    readingStartTime.value = Date.now()
  }

  function setDoublePage(val: boolean) {
    isDoublePage.value = val
    localStorage.setItem('coread_is_double_page', String(val))
  }

  function setLineHeight(val: number) {
    lineHeight.value = val
    localStorage.setItem('coread_line_height', String(val))
  }

  const pendingScrollQuote = ref('')

  function recordCurrentProgress() {
    if (!latestReadProgress.value) {
      latestReadProgress.value = {
        chapterIndex: currentChapterIndex.value,
        pageIndex: currentPageIndex.value,
      }
    }
  }

  function restoreLatestProgress() {
    if (latestReadProgress.value) {
      currentChapterIndex.value = latestReadProgress.value.chapterIndex
      currentPageIndex.value = latestReadProgress.value.pageIndex
      latestReadProgress.value = null
    }
  }

  return {
    book,
    chapters,
    currentChapterIndex,
    currentPageIndex,
    currentChapter,
    totalPages,
    currentPageContent,
    fontSize,
    themeStyle,
    isDoublePage,
    lineHeight,
    latestReadProgress,
    pendingScrollQuote,
    viewportWidth,
    viewportHeight,
    isChatOpen,
    dailyReadMinutes,
    setBook,
    goToPage,
    nextPage,
    prevPage,
    updateViewport,
    changeFontSize,
    setThemeStyle,
    resetReadingTimer,
    setDoublePage,
    setLineHeight,
    recordCurrentProgress,
    restoreLatestProgress,
  }
})
