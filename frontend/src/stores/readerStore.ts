import { defineStore } from 'pinia'
import { ref, computed, markRaw } from 'vue'
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

  // ── 动态响应式分页列表 (数学算力防溢出排版) ──
  const currentChapterPages = computed<string[]>(() => {
    if (!currentChapter.value) return ['']
    
    // 显式引用状态，确保单/双页切换和行距调整时，Pinia 触发重新计算分页
    const doubleMode = isDoublePage.value
    const lh = lineHeight.value
    
    const text = currentChapter.value.content
    const paragraphs = text.split('\n').map(p => p.trim()).filter(Boolean)
    const avgParagraphLength = paragraphs.length > 0 ? text.length / paragraphs.length : 1000
    
    // 动态安全系数 (0.4 到 0.58 之间)
    // 章节内对话/短段落越多（即平均段落长度越短），越要收紧单页字数以防多段落垂直外边距撑爆容器高度导致吞字
    let safetyFactor = 0.58
    if (avgParagraphLength < 40) {
      safetyFactor = 0.4
    } else if (avgParagraphLength < 80) {
      safetyFactor = 0.46
    } else if (avgParagraphLength < 120) {
      safetyFactor = 0.52
    }
    
    // 计算左右侧边栏占用
    const sidebarWidth = isChatOpen.value ? 384 : 0
    // 宽屏下小说卡片主体最大限制为 1280px 内容宽 (对应 max-w-7xl 卡片)
    const cardContentWidth = Math.min(viewportWidth.value - sidebarWidth - 144, 1280)
    // 高度扣除顶部 Header(64px)、上下外边距(48px)、卡片上下内边距(80px)与底部翻页控制条(48px)
    const cardContentHeight = Math.max(200, viewportHeight.value - 240)
    
    // 获取实际铺展宽度。双栏下扣除 gap 64px；单栏下不扣除
    const activeWidth = doubleMode 
      ? Math.max(200, cardContentWidth - 64)
      : Math.max(200, cardContentWidth)
    
    // 铺展公式：总像素面积 / 单字像素面积。
    const calculatedPageSize = Math.floor(
      (safetyFactor * (activeWidth * cardContentHeight)) / (fontSize.value * fontSize.value * lh)
    )
    
    // 限制单页字符在 300 到 1500 字符之间
    const pageSize = Math.max(300, Math.min(calculatedPageSize, 1500))
    
    return paginateText(text, pageSize)
  })

  const totalPages = computed<number>(() => {
    return currentChapterPages.value.length
  })

  const currentPageContent = computed<string>(() => {
    const pageIndex = Math.min(currentPageIndex.value, totalPages.value - 1)
    return currentChapterPages.value[pageIndex] || ''
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
      const sidebarWidth = isChatOpen.value ? 384 : 0
      const cardContentWidth = Math.min(viewportWidth.value - sidebarWidth - 144, 1280)
      const cardContentHeight = Math.max(200, viewportHeight.value - 240)
      const activeWidth = Math.max(200, cardContentWidth - 64)
      const calculatedPageSize = Math.floor(
        (0.6 * (activeWidth * cardContentHeight)) / (fontSize.value * fontSize.value * 1.6)
      )
      const pageSize = Math.max(300, Math.min(calculatedPageSize, 1500))
      
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
    latestReadProgress.value = {
      chapterIndex: currentChapterIndex.value,
      pageIndex: currentPageIndex.value,
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
