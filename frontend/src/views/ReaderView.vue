<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import ChatBox from '@/components/ChatBox.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'
import { useChatStore, type ChatScene } from '@/stores/chatStore'
import { useReaderStore, type BookType } from '@/stores/readerStore'
import { useCompanionStore } from '@/stores/companionStore'
import { useReadingRecordsStore } from '@/stores/readingRecordsStore'
import { useUiStore } from '@/stores/uiStore'
import { parseBookFile, parseTxt, paginateText } from '@/utils/reader'
import { cleanAssistantContent } from '@/utils/chat'
import { saveBook, loadBook, saveProgress, loadProgress } from '@/utils/storage'

// 导入拆分出的组件
import ReaderSideToolbar from '@/components/ReaderSideToolbar.vue'
import BookmarkRibbon from '@/components/BookmarkRibbon.vue'
import ReadingStatsDialog from '@/components/ReadingStatsDialog.vue'
import EnvConfigDialog from '@/components/EnvConfigDialog.vue'

const router = useRouter()
const chatStore = useChatStore()
const readerStore = useReaderStore()
const companionStore = useCompanionStore()
const recordsStore = useReadingRecordsStore()
const uiStore = useUiStore()

const fileInput = ref<HTMLInputElement | null>(null)
const readerContentRef = ref<HTMLElement | null>(null)
const isUploading = ref(false)
const showDirectory = ref(false)
const showChatDrawer = ref(true) // 聊天抽屉开关状态
const showStatsDialog = ref(false) // 统计弹窗显示开关
const showEnvDialog = ref(false) // API 环境变量弹窗显示开关
const showSearchDialog = ref(false) // 全文搜索结果弹窗
const showFirstVisitGuide = ref(false)
const lastPageTurnAt = ref(Date.now())
const nightReminderInFlight = ref(false)
const sceneTriggerInFlight = ref(false)
const suppressSceneTriggers = ref(false)
const showCompanionMenu = ref(false)
const showBookTypeMenu = ref(false)
const toast = ref<{ text: string; tone: 'success' | 'warning' | 'error' } | null>(null)
let toastTimer: number | undefined

const bookTypeOptions: { value: BookType; label: string; hint: string }[] = [
  { value: 'default', label: '默认', hint: '按文本自然调整' },
  { value: 'literature', label: '文学/经典', hint: '适度讨论语言与结构' },
  { value: 'romance', label: '言情/轻松', hint: '更关注情绪与关系' },
]

const currentBookTypeLabel = computed(() => {
  return bookTypeOptions.find((item) => item.value === readerStore.bookType)?.label || '默认'
})

const isNightLampAvailable = computed(() => {
  return readerStore.themeStyle === 'read-theme-dark'
})

const emotionalProgressText = computed(() => {
  if (!readerStore.book || readerStore.chapters.length === 0) return ''

  const chapterBase = readerStore.currentChapterIndex / readerStore.chapters.length
  const pageBase = (readerStore.currentPageIndex + 1) / Math.max(1, readerStore.totalPages)
  const percent = Math.min(100, Math.max(0, (chapterBase + pageBase / readerStore.chapters.length) * 100))
  return `你和${companionStore.currentCompanion.name}一起读了 ${percent.toFixed(1)}%`
})

function notify(text: string, tone: 'success' | 'warning' | 'error' = 'success') {
  toast.value = { text, tone }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2200)
}

function selectBookType(type: BookType) {
  readerStore.setBookType(type)
  showBookTypeMenu.value = false
}

function closeFloatingMenus() {
  showCompanionMenu.value = false
  showBookTypeMenu.value = false
}

function shouldShowFirstVisitGuide(hasSavedBook = false) {
  if (localStorage.getItem('coread_first_visit_guide_skipped') === '1') return false
  if (companionStore.customCompanions.length > 0) return false
  if (hasSavedBook) return false

  const laterAt = Number(localStorage.getItem('coread_first_visit_guide_later_at') || 0)
  if (!laterAt) return true
  return Date.now() - laterAt >= 24 * 60 * 60 * 1000
}

function dismissFirstVisitGuide(skip: boolean) {
  showFirstVisitGuide.value = false
  if (skip) {
    localStorage.setItem('coread_first_visit_guide_skipped', '1')
  } else {
    localStorage.setItem('coread_first_visit_guide_later_at', String(Date.now()))
  }
}

function goCreateCompanionFromGuide() {
  localStorage.setItem('coread_first_visit_guide_skipped', '1')
  showFirstVisitGuide.value = false
  router.push('/companions')
}

function canRenderAvatar(value: unknown) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

// 搜索结果项
interface SearchResult {
  chapterIndex: number
  chapterTitle: string
  pageIndex: number
  context: string // 匹配位置周围上下文
}

// 检查当前页是否已被加为书签
const isCurrentPageBookmarked = computed(() => {
  return recordsStore.bookmarks.some(
    (b) =>
      b.chapterIndex === readerStore.currentChapterIndex &&
      b.pageIndex === readerStore.currentPageIndex
  )
})

// 切换书签状态
async function toggleBookmark() {
  if (!readerStore.book) return
  
  if (isCurrentPageBookmarked.value) {
    const target = recordsStore.bookmarks.find(
      (b) =>
        b.chapterIndex === readerStore.currentChapterIndex &&
        b.pageIndex === readerStore.currentPageIndex
    )
    if (target) {
      await recordsStore.removeBookmark(target.id)
    }
  } else {
    const excerpt = currentPageParagraphs.value[0] || '书签章节段落'
    const cleanExcerpt = excerpt.replace(/<[^>]*>/g, '') // 剥离 HTML 标签获取干净首段
    await recordsStore.addBookmark({
      id: `bookmark_${Date.now()}`,
      bookId: readerStore.book.id,
      chapterIndex: readerStore.currentChapterIndex,
      pageIndex: readerStore.currentPageIndex,
      chapterTitle: readerStore.currentChapter?.title || '未知章节',
      excerpt: cleanExcerpt.length > 30 ? cleanExcerpt.substring(0, 30) + '...' : cleanExcerpt,
      createdAt: new Date().toISOString()
    })
  }
}

// 检查是否偏离最新进度
const showProgressRestorer = computed(() => {
  const progress = readerStore.latestReadProgress
  if (!progress) return false
  return (
    progress.chapterIndex !== readerStore.currentChapterIndex ||
    progress.pageIndex !== readerStore.currentPageIndex
  )
})

const latestChapterText = computed(() => {
  const progress = readerStore.latestReadProgress
  if (!progress) return ''
  return `第 ${progress.chapterIndex + 1} 章 · 第 ${progress.pageIndex + 1} 页`
})

// 自动滚动定位到对应的划线文本
function scrollToPendingQuote() {
  const quote = readerStore.pendingScrollQuote
  if (!quote) return

  nextTick(() => {
    const marks = document.querySelectorAll('.note-highlight-mark, .quote-highlight-mark, .user-highlight-mark, .ai-annotation-mark')
    let targetElement: HTMLElement | null = null

    for (let i = 0; i < marks.length; i++) {
      const el = marks[i] as HTMLElement
      if (el.innerText.includes(quote) || quote.includes(el.innerText)) {
        targetElement = el
        break
      }
    }

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      targetElement.classList.add('highlight-flash')
      setTimeout(() => {
        targetElement?.classList.remove('highlight-flash')
      }, 3600)
    }
    
    readerStore.pendingScrollQuote = ''
  })
}


// 监控书籍切换并载入所有共读记录
watch(
  () => readerStore.book,
  async (newBook) => {
    if (newBook) {
      await recordsStore.initRecords(newBook.id)
    }
  },
  { immediate: true }
)

// ── 文本选择状态 ──
const selectedText = ref('')
const selectionX = ref(0)
const selectionY = ref(0)

// 局部正文划线选择监听
function onTextSelected() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    selectedText.value = ''
    return
  }
  const root = readerContentRef.value
  if (!root || !sel.anchorNode || !sel.focusNode || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) {
    selectedText.value = ''
    return
  }
  const text = sel.toString().trim()
  if (text) {
    selectedText.value = text
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    selectionX.value = rect.left + rect.width / 2
    selectionY.value = rect.top
  }
}

// ── 划线工具栏：三个独立操作 ──

/** 纯划线高亮 */
async function onHighlight(data: { text: string }) {
  if (!readerStore.book) return
  await recordsStore.addHighlight({
    id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    bookId: readerStore.book.id,
    chapterIndex: readerStore.currentChapterIndex,
    pageIndex: readerStore.currentPageIndex,
    quote: data.text,
    createdAt: new Date().toISOString()
  })
  notify('已添加高亮')
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()
  triggerSceneOnce('highlight', '我刚划下了这一段，轻轻回应一下。', data.text)
}

/** 划线后写随笔笔记（不触发 AI） */
async function onNote(data: { text: string; content: string }) {
  if (!readerStore.book) return
  await recordsStore.addNote({
    id: 'note_' + Date.now(),
    bookId: readerStore.book.id,
    chapterIndex: readerStore.currentChapterIndex,
    pageIndex: readerStore.currentPageIndex,
    quote: data.text,
    content: data.content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  notify('笔记已保存')
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()
}

/** 划线后向 AI 角色提问（进入 AI 研讨片段） */
async function onAsk(data: { text: string; question: string }) {
  if (!readerStore.book) return
  showChatDrawer.value = true
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()

  const contextText = readerStore.currentPageContent || ''
  const chapterText = readerStore.currentChapterReadContent || ''
  await chatStore.streamResponse(
    data.question,
    data.text,
    contextText,
    chapterText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1,
    { scene: 'quote' }
  )
}

// ── 全文搜索 ──
const searchResults = ref<SearchResult[]>([])
const searchQuery = ref('')

function onSearch(data: { text: string }) {
  const query = data.text.trim()
  if (!query || query.length < 2) {
    notify('搜索内容太短，至少需要 2 个字', 'warning')
    return
  }

  const results: SearchResult[] = []
  const chapters = readerStore.chapters

  for (let ci = 0; ci < chapters.length; ci++) {
    const content = chapters[ci].content
    let searchFrom = 0

    while (true) {
      const idx = content.indexOf(query, searchFrom)
      if (idx === -1) break

      // 用 paginateText 确定该位置在第几页
      const pages = paginateText(content, 800)
      let pageIdx = 0
      let charCount = 0
      for (let pi = 0; pi < pages.length; pi++) {
        charCount += pages[pi].length
        if (idx < charCount) {
          pageIdx = pi
          break
        }
      }

      // 提取上下文（前后各 20 字）
      const ctxStart = Math.max(0, idx - 20)
      const ctxEnd = Math.min(content.length, idx + query.length + 20)
      let context = content.substring(ctxStart, ctxEnd).replace(/\n/g, ' ')
      if (ctxStart > 0) context = '…' + context
      if (ctxEnd < content.length) context = context + '…'

      results.push({
        chapterIndex: ci,
        chapterTitle: chapters[ci].title,
        pageIndex: pageIdx,
        context,
      })

      searchFrom = idx + query.length
    }
  }

  searchResults.value = results
  searchQuery.value = query
  showSearchDialog.value = true

  selectedText.value = ''
  window.getSelection()?.removeAllRanges()
}

/** 搜索结果跳转到指定位置 */
function handleSearchNavigate(chapterIdx: number, pageIdx: number) {
  readerStore.recordCurrentProgress()
  readerStore.currentChapterIndex = chapterIdx
  readerStore.currentPageIndex = pageIdx
  showSearchDialog.value = false
}

// ── 导入书籍 ──
async function onFileUploaded(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true
  try {
    const { parsed, rawText } = await parseBookFile(file)
    
    // 保存至本地 Store 与 IndexedDB
    readerStore.setBook('demo', parsed.title, parsed.chapters)
    await saveBook('demo', rawText)
    await recordsStore.initRecords('demo')
    
    // 初始化进度
    await saveProgress('demo', {
      chapter: 0,
      page: 0,
      updatedAt: new Date().toISOString(),
    })
    
    // 初始化该书与该角色的会话列表
    chatStore.clear()
    await chatStore.loadSessions('demo', companionStore.currentCompanionId)
    await triggerSceneOnce('start_reading', '我准备开始读这本书了，陪我进入状态。')
  } catch (err) {
    console.error('导入失败：', err)
    const message = err instanceof Error ? err.message : '请检查文件格式是否正确。'
    alert(`导入失败：${message}`)
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

// 目录章节跳转
function selectChapter(idx: number) {
  readerStore.currentChapterIndex = idx
  readerStore.currentPageIndex = 0
  showDirectory.value = false
}

// 当前页面的段落渲染
const currentPageParagraphs = computed(() => {
  if (!readerStore.currentPageContent) return []
  return readerStore.currentPageContent.split('\n').map(p => p.trim()).filter(Boolean)
})

function splitQuoteParts(quote: string) {
  return quote.split(/\r?\n/).map(part => part.trim()).filter(Boolean)
}

function escapeRegExp(value: string) {
  return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function createQuoteRegex(quote: string) {
  const pattern = quote.trim().split(/\s+/).map(escapeRegExp).join('\\s+')
  return new RegExp(pattern, 'g')
}

// 解析当前聊天历史中 AI 产生的所有划线批注
const activeAnnotations = computed(() => {
  const list: { originalText: string; comment: string }[] = []
  const annotationRegex = /<annotation>(.*?)\|(.*?)<\/annotation>/g
  
  chatStore.messages.forEach(msg => {
    if (msg.role === 'ai') {
      let match
      annotationRegex.lastIndex = 0
      while ((match = annotationRegex.exec(msg.content)) !== null) {
        list.push({
          originalText: match[1].trim(),
          comment: match[2].trim()
        })
      }
    }
  })
  return list
})

// 对段落文字动态生成划线批注高亮 HTML
function highlightParagraph(paraText: string) {
  let html = paraText

  // Keep one mark per quote by priority to avoid nested highlight spans.
  const currentChapterIdx = readerStore.currentChapterIndex
  const currentPageIdx = readerStore.currentPageIndex
  const markMap = new Map<string, { className: string; attrs: string; priority: number }>()

  function addMark(quote: string, className: string, attrs: string, priority: number) {
    if (!quote) return
    const existing = markMap.get(quote)
    if (!existing || priority > existing.priority) {
      markMap.set(quote, { className, attrs, priority })
    }
  }

  recordsStore.highlights
    .filter(h => h.chapterIndex === currentChapterIdx && h.pageIndex === currentPageIdx)
    .forEach(h => {
      splitQuoteParts(h.quote).forEach(quote => {
        addMark(quote, 'user-highlight-mark', `data-hl-id="${h.id}"`, 1)
      })
    })

  recordsStore.notes
    .filter(n => n.chapterIndex === currentChapterIdx && n.pageIndex === currentPageIdx && n.quote)
    .forEach(n => {
      splitQuoteParts(n.quote!).forEach(quote => {
        addMark(quote, 'note-highlight-mark', `data-note-id="${n.id}" title="${escapeHtmlAttr(n.content)}"`, 3)
      })
    })

  // 1. chatStore 用户划线研讨
  chatStore.messages.forEach((msg, idx) => {
    if (msg.role === 'user' && msg.quote) {
      splitQuoteParts(msg.quote).forEach(line => addMark(line, 'quote-highlight-mark', `data-msg-index="${idx}"`, 2))
    }
  })

  // 2. AI 批注
  activeAnnotations.value.forEach(ann => {
    addMark(ann.originalText, 'ai-annotation-mark', `title="${escapeHtmlAttr(ann.comment)}"`, 0)
  })

  // 3. 渲染标记
  Array.from(markMap.entries()).sort((a, b) => b[0].length - a[0].length).forEach(([quote, mark]) => {
    html = html.replace(createQuoteRegex(quote), (matchedText) => {
      return `<span class="${mark.className}" ${mark.attrs}>${matchedText}</span>`
    })
  })

  return html
}

// ── 荧光划线点击气泡追问浮窗状态 ──
const showQuotePopover = ref(false)
const popoverPosition = ref({ x: 0, y: 0 })
const popoverMessageIndex = ref(-1)
const followUpInput = ref('')
const popoverMessageContainer = ref<HTMLDivElement | null>(null)

// 过滤出该划线对应的问答线程消息
const popoverThreadMessages = computed(() => {
  if (popoverMessageIndex.value === -1 || !chatStore.currentSession) return []
  const baseUserMsg = chatStore.currentSession.messages[popoverMessageIndex.value]
  if (!baseUserMsg || baseUserMsg.role !== 'user') return []
  
  const targetQuote = baseUserMsg.quote
  if (!targetQuote) return []
  
  const list: any[] = []
  const msgs = chatStore.currentSession.messages
  
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    if (m.role === 'user' && m.quote === targetQuote) {
      list.push(m)
      let j = i + 1
      while (j < msgs.length && msgs[j].role === 'ai') {
        list.push(msgs[j])
        j++
      }
    }
  }
  return list
})

// 悬浮框的动态防越界定位
const popoverStyle = computed(() => {
  let left = popoverPosition.value.x
  let top = popoverPosition.value.y
  
  const halfWidth = 190
  const padding = 16
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  
  if (left - halfWidth < padding) {
    left = halfWidth + padding
  }
  if (left + halfWidth > windowWidth - padding) {
    left = windowWidth - halfWidth - padding
  }
  
  // 防止底部偏出
  const estimatedHeight = 320
  if (top + estimatedHeight > windowHeight - padding) {
    top = windowHeight - estimatedHeight - padding
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'translateX(-50%)',
  }
})

// 点击正文划线触发浮层
async function onReaderContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const noteMark = target.closest('.note-highlight-mark') as HTMLElement | null
  const highlightMark = target.closest('.user-highlight-mark') as HTMLElement | null
  const userMark = target.closest('.quote-highlight-mark') as HTMLElement | null

  if (noteMark) {
    const noteId = noteMark.getAttribute('data-note-id')
    if (!noteId) return
    const ok = await uiStore.confirm({
      title: '取消笔记',
      message: '确认删除这条笔记吗？原文上的笔记划线也会一起移除。',
      confirmText: '删除笔记',
      danger: true,
    })
    if (ok) {
      await recordsStore.removeNote(noteId)
      notify('笔记已取消')
    }
    return
  }

  if (highlightMark) {
    const highlightId = highlightMark.getAttribute('data-hl-id')
    if (!highlightId) return
    const ok = await uiStore.confirm({
      title: '取消划线',
      message: '确认移除这条普通划线吗？',
      confirmText: '移除划线',
      danger: true,
    })
    if (ok) {
      await recordsStore.removeHighlight(highlightId)
      notify('划线已取消')
    }
    return
  }
  
  if (userMark) {
    const msgIndexStr = userMark.getAttribute('data-msg-index')
    if (msgIndexStr) {
      const msgIndex = parseInt(msgIndexStr)
      if (msgIndex !== -1) {
        const rect = userMark.getBoundingClientRect()
        popoverPosition.value = {
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8
        }
        popoverMessageIndex.value = msgIndex
        showQuotePopover.value = true
        followUpInput.value = ''
        
        nextTick(() => {
          const inputEl = document.querySelector('.popover-input-field') as HTMLTextAreaElement | null
          inputEl?.focus()
          if (popoverMessageContainer.value) {
            popoverMessageContainer.value.scrollTop = popoverMessageContainer.value.scrollHeight
          }
        })
      }
    }
  }
}

// 发送追问
async function sendFollowUp() {
  if (chatStore.isStreaming || !readerStore.book || popoverMessageIndex.value === -1) return
  const text = followUpInput.value.trim()
  if (!text) return

  const baseUserMsg = chatStore.currentSession?.messages[popoverMessageIndex.value]
  if (!baseUserMsg) return
  const targetQuote = baseUserMsg.quote || ''

  followUpInput.value = ''
  
  const contextText = readerStore.currentPageContent || ''
  const chapterText = readerStore.currentChapterReadContent || ''
  
  await chatStore.streamResponse(
    text,
    targetQuote,
    contextText,
    chapterText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1,
    { scene: 'quote' }
  )
}

async function triggerSceneOnce(
  scene: ChatScene,
  message: string,
  quoteText = '',
  oncePerBook = true,
  contextText = readerStore.currentPageContent || '',
  chapterText = ''
) {
  if (!readerStore.book || sceneTriggerInFlight.value || chatStore.isStreaming) return

  const dateKey = new Date().toISOString().slice(0, 10)
  const scope = oncePerBook ? readerStore.book.id : 'global'
  const storageKey = `coread_scene_${scene}_${scope}_${companionStore.currentCompanionId}_${dateKey}`
  if (localStorage.getItem(storageKey) === '1') return

  sceneTriggerInFlight.value = true
  showChatDrawer.value = true

  try {
    const ok = await chatStore.streamResponse(
      message,
      quoteText,
      contextText,
      chapterText,
      readerStore.book.id,
      companionStore.currentCompanionId,
      readerStore.currentChapterIndex + 1,
      { scene }
    )
    if (ok) {
      localStorage.setItem(storageKey, '1')
    }
  } finally {
    sceneTriggerInFlight.value = false
  }
}

async function removeQuoteDiscussionMark() {
  const session = chatStore.currentSession
  const baseUserMsg = session?.messages[popoverMessageIndex.value]
  const targetQuote = baseUserMsg?.quote || ''
  if (!session || !targetQuote) return
  const targetMsg = baseUserMsg!

  const ok = await uiStore.confirm({
    title: '取消研讨划线',
    message: '确认移除这条对话研讨划线吗？聊天文字会保留，对应共读片段记录会删除。',
    confirmText: '移除研讨划线',
    danger: true,
  })
  if (!ok) return

  targetMsg.quote = ''

  const relatedFragments = recordsStore.aiFragments.filter(
    (item) =>
      item.sessionId === session.id &&
      item.quote === targetQuote &&
      item.chapterIndex === targetMsg.chapterIndex &&
      item.pageIndex === targetMsg.pageIndex
  )
  await Promise.all(relatedFragments.map((item) => recordsStore.removeAiFragment(item.id)))

  showQuotePopover.value = false
  popoverMessageIndex.value = -1
  notify('研讨划线已取消')
}

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 监听追问会话增长，自动滚动
watch(
  () => popoverThreadMessages.value,
  () => {
    nextTick(() => {
      if (popoverMessageContainer.value) {
        popoverMessageContainer.value.scrollTop = popoverMessageContainer.value.scrollHeight
      }
    })
  },
  { deep: true }
)

// ── 监听进度变化并自动保存 ──
watch(
  [() => readerStore.currentChapterIndex, () => readerStore.currentPageIndex],
  async ([newChapter, newPage], [oldChapter]) => {
    if (readerStore.book) {
      const now = Date.now()
      const pageTurnInterval = now - lastPageTurnAt.value
      lastPageTurnAt.value = now

      await saveProgress('demo', {
        chapter: newChapter,
        page: newPage,
        updatedAt: new Date().toISOString(),
      })
      scrollToPendingQuote()
      if (suppressSceneTriggers.value) return
      maybeTriggerNightReminder(pageTurnInterval)
      if (newChapter > oldChapter && newPage === 0 && oldChapter >= 0) {
        const previousChapter = readerStore.chapters[oldChapter]
        triggerSceneOnce(
          'chapter_finished',
          '我刚读完了一章，陪我轻轻收一下这一章的感觉。',
          '',
          true,
          previousChapter?.title || ''
        )
      }
      if (readerStore.getDailyReadMinutes() >= 20) {
        triggerSceneOnce('reading_streak', '我已经连续读了一会儿了，给我一点继续读下去的陪伴感。')
      }
    }
  }
)

async function maybeTriggerNightReminder(pageTurnInterval: number) {
  if (!readerStore.book || nightReminderInFlight.value || chatStore.isStreaming) return

  const now = new Date()
  const hour = now.getHours()
  if (hour < 23 && hour >= 5) return

  const dateKey = now.toISOString().slice(0, 10)
  const storageKey = `coread_night_reminder_${readerStore.book.id}_${companionStore.currentCompanionId}_${dateKey}`
  if (localStorage.getItem(storageKey) === '1') return

  const hasReadLongEnough = readerStore.getDailyReadMinutes() >= 10
  const hasSlowedDown = pageTurnInterval >= 45000
  if (!hasReadLongEnough && !hasSlowedDown) return

  nightReminderInFlight.value = true
  localStorage.setItem(storageKey, '1')
  showChatDrawer.value = true

  try {
    await chatStore.streamResponse(
      '已经有些晚了，轻轻提醒我休息一下。',
      '',
      readerStore.currentPageContent || '',
      readerStore.currentChapterReadContent || '',
      readerStore.book.id,
      companionStore.currentCompanionId,
      readerStore.currentChapterIndex + 1,
      { scene: 'night' }
    )
  } finally {
    nightReminderInFlight.value = false
  }
}

// ── 监听角色切换并加载其专属会话 ──
watch(
  () => companionStore.currentCompanionId,
  async (newId) => {
    if (readerStore.book) {
      await chatStore.loadSessions(readerStore.book.id, newId)
    }
  }
)

/**
 * 角色切换守卫：流式输出期间禁止切换角色
 */
function handleCompanionSwitch(id: string) {
  if (chatStore.isStreaming) {
    notify('角色正在回复中，请等待完成后再切换', 'warning')
    return
  }
  companionStore.setCompanion(id)
  showCompanionMenu.value = false
}

function handleNextPage() {
  readerStore.nextPage()
}

function handlePrevPage() {
  readerStore.prevPage()
}

// ── 视口改变与侧边栏折叠监听 ──
const handleResize = () => {
  readerStore.updateViewport(window.innerWidth, window.innerHeight, showChatDrawer.value)
}

watch(showChatDrawer, (newVal) => {
  readerStore.updateViewport(window.innerWidth, window.innerHeight, newVal)
})

// ── 键盘导航 ──
function onKeyDown(e: KeyboardEvent) {
  // 忽略输入框内的键盘事件
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    if (e.key === 'ArrowRight') handleNextPage()
    else handlePrevPage()
  }
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('click', closeFloatingMenus)
    if (toastTimer) window.clearTimeout(toastTimer)
  }
})

// ── 挂载初始化 ──
onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('click', closeFloatingMenus)
    handleResize()
  }
  readerStore.resetReadingTimer()

  const savedBookText = await loadBook('demo')
  if (savedBookText) {
    suppressSceneTriggers.value = true
    const parsed = parseTxt('测试书籍.txt', savedBookText)
    readerStore.setBook('demo', parsed.title, parsed.chapters)
    
    const progress = await loadProgress('demo')
    if (progress) {
      readerStore.currentChapterIndex = progress.chapter
      readerStore.currentPageIndex = progress.page
    }
    
    // 载入当前书籍与角色的会话列表
    await chatStore.loadSessions('demo', companionStore.currentCompanionId)
    await nextTick()
    suppressSceneTriggers.value = false
  }
  showFirstVisitGuide.value = shouldShowFirstVisitGuide(Boolean(savedBookText))
})
</script>

<template>
  <div class="h-screen overflow-hidden flex flex-col transition-colors duration-300 theme-bg-app">
    <Transition name="fade-scale">
      <div
        v-if="toast"
        class="fixed top-5 left-1/2 -translate-x-1/2 z-[80] rounded-full border theme-border bg-[var(--color-read-bg)]/90 backdrop-blur-md shadow-lg px-4 py-2 text-xs font-semibold"
        :class="toast.tone === 'error' ? 'text-red-500' : toast.tone === 'warning' ? 'text-amber-600' : 'text-[var(--color-primary)]'"
      >
        {{ toast.text }}
      </div>
    </Transition>

    <Transition name="modal-fade">
      <div v-if="showFirstVisitGuide" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-stone-900/55 backdrop-blur-sm" @click="dismissFirstVisitGuide(false)"></div>
        <div class="relative w-full max-w-[520px] rounded-2xl border theme-border bg-[var(--color-read-bg)]/95 shadow-2xl overflow-hidden">
          <header class="px-5 py-4 border-b theme-border bg-stone-500/5">
            <h2 class="text-base font-bold text-[var(--color-read-title)]">先创建一个共读角色</h2>
            <p class="text-xs text-stone-400 mt-1">名称 → 性格 → 语言风格 → 关系 → 头像 → 预览 → 保存。</p>
          </header>
          <div class="p-5 space-y-3 text-sm text-[var(--color-read-text)]">
            <p class="leading-relaxed opacity-80">
              角色创建会引导你把伴侣写成稳定的人格卡。你也可以先用内置模板开始读，之后再回来编辑自己的角色。
            </p>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-xl border theme-border bg-stone-500/5 p-3">自由文本填写人设</div>
              <div class="rounded-xl border theme-border bg-stone-500/5 p-3">本地头像圆形裁剪</div>
              <div class="rounded-xl border theme-border bg-stone-500/5 p-3">模板可查看编辑</div>
              <div class="rounded-xl border theme-border bg-stone-500/5 p-3">支持 JSON 导入导出</div>
            </div>
          </div>
          <footer class="px-5 py-4 border-t theme-border bg-stone-500/5 flex items-center justify-end gap-2">
            <button
              class="px-4 py-2 rounded-xl text-xs border theme-border bg-transparent hover:bg-stone-500/10 transition-colors"
              @click="dismissFirstVisitGuide(false)"
            >
              之后再看
            </button>
            <button
              class="px-4 py-2 rounded-xl text-xs border theme-border bg-transparent hover:bg-stone-500/10 transition-colors"
              @click="dismissFirstVisitGuide(true)"
            >
              Skip
            </button>
            <button
              class="px-4 py-2 rounded-xl text-xs font-bold text-white theme-bg-primary theme-bg-primary-hover transition-colors"
              @click="goCreateCompanionFromGuide"
            >
              去创建角色
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- Header 头部栏 -->
    <header class="border-b theme-border px-6 py-4 flex items-center justify-between bg-[var(--color-bg-app)] shrink-0 z-[70]">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold tracking-wide theme-text-app">CoRead</h1>
        <div v-if="readerStore.book" class="text-sm theme-text-app opacity-70 font-sans">
          正在共读：《{{ readerStore.book.title }}》
        </div>
        <div v-if="readerStore.book" class="text-xs theme-text-app opacity-60 font-sans rounded-full border theme-border px-3 py-1 bg-stone-500/5">
          {{ emotionalProgressText }}
        </div>
      </div>

      <!-- 顶部配置栏 -->
      <div class="flex items-center gap-4">
        <div v-if="readerStore.book" class="relative" @click.stop>
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border theme-header-btn bg-stone-500/5 hover:bg-stone-500/10 transition-colors cursor-pointer text-xs font-semibold"
            @click="showBookTypeMenu = !showBookTypeMenu; showCompanionMenu = false"
          >
            <span class="theme-text-app opacity-65">类型</span>
            <span class="theme-text-app">{{ currentBookTypeLabel }}</span>
            <ArrowDown class="w-3 h-3 text-stone-400" />
          </button>
          <Transition name="fade-slide">
            <div
              v-if="showBookTypeMenu"
              class="absolute right-0 top-full mt-2 w-52 rounded-xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-xl p-1.5 z-50"
            >
              <button
                v-for="item in bookTypeOptions"
                :key="item.value"
                class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
                :class="readerStore.bookType === item.value ? 'theme-bg-primary-light text-[var(--color-primary)]' : 'hover:bg-stone-500/10 theme-text-card'"
                @click="selectBookType(item.value)"
              >
                <div class="text-xs font-bold">{{ item.label }}</div>
                <div class="text-[10px] opacity-60 mt-0.5">{{ item.hint }}</div>
              </button>
            </div>
          </Transition>
        </div>

        <!-- 伴侣下拉选择器 -->
        <div class="relative" @click.stop>
          <button 
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border theme-header-btn bg-stone-500/5 hover:bg-stone-500/10 transition-colors cursor-pointer text-xs font-semibold"
            :disabled="chatStore.isStreaming"
            :class="{ 'opacity-50 cursor-not-allowed': chatStore.isStreaming }"
            @click="showCompanionMenu = !showCompanionMenu; showBookTypeMenu = false"
          >
            <span
              class="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center shrink-0 shadow-inner overflow-hidden text-[8px] text-white"
              :style="{ background: `linear-gradient(135deg, ${companionStore.currentCompanion.accentStart}, ${companionStore.currentCompanion.accentEnd})` }"
            >
              <img v-if="canRenderAvatar(companionStore.currentCompanion.avatar)" :src="companionStore.currentCompanion.avatar" :alt="companionStore.currentCompanion.name" class="w-full h-full object-cover" />
            </span>
            <span class="theme-text-app">{{ companionStore.currentCompanion.name }}</span>
            <ArrowDown class="w-3 h-3 text-stone-400" />
          </button>

          <Transition name="fade-slide">
            <div
              v-if="showCompanionMenu"
              class="absolute right-0 top-full mt-2 w-56 rounded-xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-xl p-1.5 z-50"
            >
              <button 
                v-for="c in companionStore.allCompanions" 
                :key="c.id" 
                class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer"
                :class="companionStore.currentCompanionId === c.id ? 'theme-bg-primary-light text-[var(--color-primary)]' : 'hover:bg-stone-500/10 theme-text-card'"
                @click="handleCompanionSwitch(c.id)"
              >
                <span
                  class="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center shrink-0 shadow-inner overflow-hidden text-[8px] text-white"
                  :style="{ background: `linear-gradient(135deg, ${c.accentStart}, ${c.accentEnd})` }"
                >
                  <img v-if="canRenderAvatar(c.avatar)" :src="c.avatar" :alt="c.name" class="w-full h-full object-cover" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs truncate font-bold">{{ c.name }}</span>
                  <span class="block text-[9px] text-stone-400 truncate mt-0.5">{{ c.title }}</span>
                </span>
              </button>
              
              <div class="my-1 h-px bg-stone-500/15"></div>
              <button
                class="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[var(--color-primary)] hover:bg-stone-500/10 transition-colors cursor-pointer"
                @click="showCompanionMenu = false; router.push('/companions')"
              >
                <Setting class="w-3.5 h-3.5" />
                管理共读角色
              </button>
            </div>
          </Transition>
        </div>

        <!-- 导入书籍按钮 -->
        <input
          type="file"
          ref="fileInput"
          accept=".txt,.pdf,.epub"
          class="hidden"
          @change="onFileUploaded"
        />
        <button
          @click="fileInput?.click()"
          class="px-4 py-1.5 rounded-full text-xs font-semibold border theme-header-btn transition-colors duration-300"
          :disabled="isUploading"
        >
          {{ isUploading ? '读取中...' : '换本书' }}
        </button>

        <!-- API 环境变量设置按钮 -->
        <button
          @click="showEnvDialog = true"
          title="设置 API Key / 环境变量"
          aria-label="打开 API Key 环境变量设置弹窗"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border theme-header-btn transition-colors duration-300 cursor-pointer"
        >
          <Setting class="w-3.5 h-3.5 text-stone-600" />
          <span>API设置</span>
        </button>
      </div>
    </header>

    <!-- 主阅读与聊天区域 -->
    <main class="flex-1 min-h-0 flex overflow-hidden">
      <!-- 左侧阅读器视口 -->
      <section class="flex-1 min-w-0 flex flex-col justify-between p-6 overflow-hidden relative transition-colors duration-300">
        <Transition name="lamp-glow">
          <div
            v-if="readerStore.book && isNightLampAvailable && readerStore.isNightLampOn"
            class="night-lamp-beam"
          ></div>
        </Transition>

        <button
          v-if="readerStore.book && isNightLampAvailable"
          class="night-lamp-switch"
          :class="{ 'night-lamp-active': readerStore.isNightLampOn }"
          :title="readerStore.isNightLampOn ? '关闭小夜灯' : '打开小夜灯'"
          :aria-pressed="readerStore.isNightLampOn"
          aria-label="小夜灯"
          type="button"
          @click.stop="readerStore.toggleNightLamp"
        >
          <span class="lamp-base"></span>
          <span class="lamp-cord"></span>
          <span class="lamp-shade">
            <span class="lamp-bulb"></span>
          </span>
          <span class="pull-cord"></span>
        </button>
        
        <!-- 右侧浮出的目录卡片 -->
        <Transition name="fade-scale">
          <div
            v-if="showDirectory"
            class="absolute right-20 top-12 w-80 max-h-[70vh] bg-[var(--color-read-bg)] border theme-border shadow-2xl rounded-2xl p-4 z-20 flex flex-col transition-all duration-300"
          >
            <div class="pb-3 border-b theme-border flex items-center justify-between">
              <h3 class="font-bold text-[var(--color-read-title)] text-sm">目录</h3>
              <button
                @click="showDirectory = false"
                class="text-stone-400 hover:text-stone-600 transition-colors px-1 text-xs"
              >
                ✕
              </button>
            </div>
            <div class="flex-1 overflow-y-auto mt-3 space-y-1.5 pr-1">
              <button
                v-for="(ch, idx) in readerStore.chapters"
                :key="idx"
                :class="[
                  'w-full text-left px-3 py-2 text-xs rounded-xl transition-all duration-200 border border-transparent font-medium',
                  readerStore.currentChapterIndex === idx
                    ? 'theme-bg-primary text-white shadow-xs'
                    : 'hover:bg-stone-500/5 theme-text-card opacity-80 hover:opacity-100'
                ]"
                @click="selectChapter(idx)"
              >
                {{ ch.title }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- 目录背景轻遮罩 -->
        <div
          v-if="showDirectory"
          class="absolute inset-0 z-10"
          @click="showDirectory = false"
        ></div>

        <!-- 右侧垂直悬浮面板 (三段式小组件) -->
        <div v-if="readerStore.book" class="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-3 theme-bg-card border theme-border shadow-lg rounded-2xl p-2.5 transition-colors duration-300">
          <ReaderSideToolbar
            v-model:showChatDrawer="showChatDrawer"
            @toggleDirectory="showDirectory = !showDirectory"
            @openStats="showStatsDialog = true"
            @openEnvConfig="showEnvDialog = true"
          />
        </div>

        <!-- 空白导入状态 -->
        <div v-if="!readerStore.book" class="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-stone-500/10 flex items-center justify-center text-stone-500 shadow-sm border theme-border">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-[var(--color-read-title)]">开始你的 CoRead 之旅</h3>
          <p class="text-sm text-[var(--color-read-text)] opacity-70 max-w-sm">
            导入一份 TXT / PDF / EPUB 小说，与你选择的伴侣一起沉浸式共读，他会在阅读过程中为你提供温暖的对话与情绪价值。
          </p>
          <div class="relative" @click.stop>
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-full border theme-border bg-stone-500/5 hover:bg-stone-500/10 text-xs font-semibold transition-colors"
              @click="showBookTypeMenu = !showBookTypeMenu"
            >
              <span class="text-[var(--color-read-text)] opacity-70">书籍类型</span>
              <span class="text-[var(--color-read-text)]">{{ currentBookTypeLabel }}</span>
              <ArrowDown class="w-3 h-3 text-stone-400" />
            </button>
            <Transition name="fade-slide">
              <div
                v-if="showBookTypeMenu"
                class="absolute left-1/2 top-full mt-2 w-52 -translate-x-1/2 rounded-xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-xl p-1.5 z-50"
              >
                <button
                  v-for="item in bookTypeOptions"
                  :key="item.value"
                  class="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  :class="readerStore.bookType === item.value ? 'theme-bg-primary-light text-[var(--color-primary)]' : 'hover:bg-stone-500/10 theme-text-card'"
                  @click="selectBookType(item.value)"
                >
                  <div class="text-xs font-bold">{{ item.label }}</div>
                  <div class="text-[10px] opacity-60 mt-0.5">{{ item.hint }}</div>
                </button>
              </div>
            </Transition>
          </div>
          <button
            @click="fileInput?.click()"
            class="px-6 py-2.5 rounded-full theme-bg-primary text-white text-sm font-semibold theme-bg-primary-hover shadow-md hover:scale-105 transition-all duration-300"
          >
            导入一本书籍
          </button>
        </div>

        <!-- 小说展示区 (微信读书风格独立大书卡纸张) -->
        <div
          v-else
          class="flex-1 max-w-7xl mx-auto w-full theme-bg-card theme-text-card rounded-2xl shadow-lg border theme-border flex flex-col justify-between px-10 py-8 my-3 relative z-[2] transition-all duration-300 min-h-0"
        >
          <!-- 下落式书签 (独立小组件) -->
          <BookmarkRibbon
            :is-bookmarked="isCurrentPageBookmarked"
            @toggle="toggleBookmark"
          />

          <!-- 毛玻璃进度一键切回提示条 -->
          <Transition name="fade-scale">
            <div
              v-if="showProgressRestorer"
              class="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-white/75 dark:bg-zinc-800/75 backdrop-blur-md border border-stone-200/50 dark:border-zinc-700/50 shadow-lg flex items-center gap-3 text-xs theme-text-card font-medium transition-all"
            >
              <span>您刚才阅读到：{{ latestChapterText }}</span>
              <button
                @click="readerStore.restoreLatestProgress"
                class="px-2.5 py-1 rounded-full theme-bg-primary text-white hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold border-0"
              >
                回到最新进度 ↺
              </button>
              <button
                @click="readerStore.latestReadProgress = null"
                class="text-stone-400 hover:text-stone-600 transition-colors text-[10px] bg-transparent border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </Transition>

          <!-- 局部绑定的 mouseup 正文划线监听，限制其最大高度，防止其撑开卡片 -->
          <div ref="readerContentRef" class="flex-1 min-h-0 overflow-hidden flex flex-col justify-center my-4" @mouseup="onTextSelected" @click="onReaderContentClick">
            <div
              class="wechat-reader-container theme-font-reading tracking-wide text-justify theme-text-card h-full overflow-hidden transition-all duration-300"
              :style="{
                fontSize: readerStore.fontSize + 'px',
                columns: readerStore.isDoublePage ? 2 : 1,
                columnRule: readerStore.isDoublePage ? '' : 'none'
              }"
            >
              <!-- 章节标题 -->
              <h2
                v-if="readerStore.currentPageIndex === 0"
                class="text-2xl font-bold tracking-wide theme-text-title border-l-4 theme-border pl-4 py-1.5 mb-8"
              >
                {{ readerStore.currentChapter?.title }}
              </h2>
              
              <!-- 正文段落 -->
              <p
                v-for="(para, idx) in currentPageParagraphs"
                :key="idx"
                class="indent-8 text-justify tracking-wide"
                :style="{ 
                  lineHeight: readerStore.lineHeight,
                  marginBottom: '0.8em'
                }"
                v-html="highlightParagraph(para)"
              ></p>
            </div>
          </div>

          <!-- 底部翻页控制 -->
          <div class="mt-8 pt-4 border-t theme-border flex items-center justify-between text-xs theme-text-card opacity-60 font-sans shrink-0">
            <button
              class="px-4 py-1.5 border theme-border rounded-full hover:bg-stone-500/10 theme-text-card disabled:opacity-30 disabled:pointer-events-none transition-colors"
              :disabled="readerStore.currentChapterIndex === 0 && readerStore.currentPageIndex === 0"
              @click="handlePrevPage"
            >
              上一页
            </button>
            <span class="font-medium">
              第 {{ readerStore.currentChapterIndex + 1 }} 章 · 第 {{ readerStore.currentPageIndex + 1 }} / {{ readerStore.totalPages }} 页
            </span>
            <button
              class="px-4 py-1.5 border theme-border rounded-full hover:bg-stone-500/10 theme-text-card disabled:opacity-30 disabled:pointer-events-none transition-colors"
              :disabled="readerStore.currentChapterIndex === readerStore.chapters.length - 1 && readerStore.currentPageIndex === readerStore.totalPages - 1"
              @click="handleNextPage"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      <!-- 聊天框 (抽屉滑出 Transition 包装) -->
      <Transition name="slide-right">
        <ChatBox v-if="readerStore.book && showChatDrawer" />
      </Transition>
    </main>

    <!-- 选区原位划线工具栏（三按钮：划线 | 笔记 | 问问xxx） -->
    <SelectionToolbar
      :selected-text="selectedText"
      :x="selectionX"
      :y="selectionY"
      @highlight="onHighlight"
      @note="onNote"
      @ask="onAsk"
      @search="onSearch"
    />

    <!-- 荧光划线点击气泡追问浮窗 -->
    <div v-if="showQuotePopover" class="fixed inset-0 z-40 bg-transparent" @click="showQuotePopover = false"></div>

    <Transition name="fade-scale">
      <div
        v-if="showQuotePopover"
        ref="popoverCardRef"
        :style="popoverStyle"
        class="quote-popover-card fixed z-50 w-[380px] max-w-[90vw] bg-[var(--color-read-bg)]/90 backdrop-blur-md border theme-border shadow-2xl rounded-2xl p-4 flex flex-col transition-all duration-300"
      >
        <!-- 头部：伴侣名字 + 划线原文极简剪切 -->
        <div class="pb-2 border-b theme-border flex items-center justify-between shrink-0">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold theme-text-primary">与 {{ companionStore.currentCompanion.name }} 研讨中</span>
          </div>
          <button
            @click="removeQuoteDiscussionMark"
            class="ml-auto mr-2 px-2 py-1 rounded-lg border border-red-500/20 bg-red-500/5 text-[10px] font-bold text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            取消划线
          </button>
          <button
            @click="showQuotePopover = false"
            class="text-stone-400 hover:text-stone-600 transition-colors px-1 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
        
        <!-- 划线原文缩影 -->
        <div class="py-1.5 px-2 bg-stone-500/5 rounded-lg border theme-border mt-2 text-[10px] text-[var(--color-read-text)] opacity-75 truncate italic shrink-0">
          划线原文：“{{ chatStore.currentSession?.messages[popoverMessageIndex]?.quote }}”
        </div>

        <!-- 局部问答对话滚动列表 -->
        <div
          ref="popoverMessageContainer"
          class="flex-1 overflow-y-auto my-3 space-y-3 pr-1 max-h-[220px] min-h-[100px]"
        >
          <div
            v-for="(msg, i) in popoverThreadMessages"
            :key="i"
            :class="[
              'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-xs transition-all duration-200',
              msg.role === 'user'
                ? 'ml-auto bg-[var(--color-bg-bubble-user)] text-[var(--color-text-bubble-user)] rounded-br-none'
                : 'mr-auto bg-[var(--color-bg-bubble-ai)] text-[var(--color-text-bubble-ai)] border theme-border rounded-bl-none',
              msg.isStreaming ? 'typewriter-loading' : ''
            ]"
          >
            <p class="whitespace-pre-line">{{ msg.role === 'user' ? msg.content : cleanAssistantContent(msg.content) }}</p>
          </div>
        </div>

        <!-- 底部追问输入框 -->
        <div class="pt-2 border-t theme-border flex gap-2 shrink-0">
          <textarea
            v-model="followUpInput"
            rows="1"
            placeholder="输入想法或追问..."
            class="popover-input-field flex-1 rounded-xl border theme-border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-read-bg)] text-[var(--color-read-text)] transition-all resize-none"
            @keydown.enter.prevent="sendFollowUp"
            :disabled="chatStore.isStreaming"
          />
          <button
            class="rounded-xl theme-bg-primary px-4 py-2 text-xs font-semibold text-white theme-bg-primary-hover shadow-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            @click="sendFollowUp"
            :disabled="!followUpInput.trim() || chatStore.isStreaming"
          >
            {{ chatStore.isStreaming ? '...' : '发送' }}
          </button>
        </div>
      </div>
    </Transition>
    <!-- 统计详情弹窗 (独立小组件) -->
    <ReadingStatsDialog
      v-model="showStatsDialog"
      @open-chat-drawer="showChatDrawer = true"
    />

    <!-- API 环境变量设置弹窗 -->
    <EnvConfigDialog v-model:visible="showEnvDialog" />

    <!-- 全文搜索结果弹窗 -->
    <Transition name="modal-fade">
      <div v-if="showSearchDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-stone-900/45 backdrop-blur-sm" @click="showSearchDialog = false"></div>
        <div class="relative w-full max-w-[700px] max-h-[82vh] rounded-2xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col">
          <header class="px-5 py-4 border-b theme-border bg-stone-500/5 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-[var(--color-read-title)]">全文搜索</h3>
              <p class="text-[10px] text-stone-400 mt-0.5">{{ searchQuery }}</p>
            </div>
            <button
              class="w-7 h-7 rounded-full hover:bg-stone-500/10 text-stone-400 hover:text-stone-600 transition-colors"
              @click="showSearchDialog = false"
            >
              <Close class="w-3.5 h-3.5 mx-auto" />
            </button>
          </header>

          <template v-if="searchResults.length === 0">
            <div class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
              <svg class="w-10 h-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <div class="text-xs font-bold text-stone-500">未找到匹配结果</div>
              <p class="text-[10px] opacity-70">尝试缩短搜索词或更换关键词。</p>
            </div>
          </template>

          <div v-else class="overflow-y-auto space-y-2 p-4">
            <div class="text-[10px] text-stone-400 mb-2">共找到 {{ searchResults.length }} 处匹配</div>
            <div
              v-for="(r, i) in searchResults"
              :key="i"
              class="flex items-start gap-3 p-3 rounded-xl bg-stone-500/5 hover:bg-stone-500/10 border theme-border transition-colors cursor-pointer group"
              @click="handleSearchNavigate(r.chapterIndex, r.pageIndex)"
            >
              <div class="shrink-0 flex flex-col items-center min-w-[44px]">
                <span class="text-[10px] font-bold text-[var(--color-primary)]">{{ r.chapterTitle }}</span>
                <span class="text-[9px] text-stone-400">第 {{ r.pageIndex + 1 }} 页</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-[var(--color-read-text)] leading-relaxed line-clamp-2">
                  {{ r.context }}
                </p>
              </div>
              <button
                class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-all border bg-[var(--color-primary)]/5 text-[var(--color-primary)] border-[var(--color-primary)]/15 opacity-0 group-hover:opacity-100 hover:bg-[var(--color-primary)]/10 active:scale-95"
              >
                <span>跳转</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateX(10px);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active,
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.lamp-glow-enter-active {
  transition: opacity 0.45s ease;
}

.lamp-glow-leave-active {
  transition: opacity 0.12s ease-out;
}

.lamp-glow-enter-from,
.lamp-glow-leave-to {
  opacity: 0;
}

.night-lamp-beam {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  width: min(420px, 42vw);
  height: min(360px, 42vh);
  pointer-events: none;
  opacity: 0.95;
  background:
    radial-gradient(circle at 10% 18%, rgba(255, 232, 158, 0.28) 0%, rgba(255, 213, 116, 0.16) 24%, rgba(255, 210, 112, 0.06) 48%, transparent 72%),
    radial-gradient(ellipse at 20% 30%, rgba(255, 205, 99, 0.13) 0%, transparent 58%);
  filter: blur(8px);
  mix-blend-mode: normal;
}

.night-lamp-switch {
  position: absolute;
  left: 28px;
  top: 0;
  z-index: 30;
  width: 56px;
  height: 148px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
}

.lamp-base {
  width: 34px;
  height: 12px;
  border-radius: 0 0 16px 16px;
  background: #3f3f46;
  box-shadow: inset 0 -2px 5px rgba(0, 0, 0, 0.45);
}

.lamp-cord {
  width: 2px;
  height: 58px;
  background: #34343a;
}

.lamp-shade {
  position: relative;
  width: 46px;
  height: 30px;
  border-radius: 22px 22px 6px 6px;
  background: #3a3a40;
  box-shadow: inset 0 -3px 8px rgba(0, 0, 0, 0.22), 0 3px 8px rgba(0, 0, 0, 0.32);
}

.lamp-bulb {
  position: absolute;
  left: 50%;
  bottom: -7px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #807b68;
  transform: translateX(-50%);
  transition: background-color 0.45s ease, box-shadow 0.45s ease;
}

.pull-cord {
  position: relative;
  width: 2px;
  height: 32px;
  margin-top: 3px;
  background: #77747a;
  transition: transform 0.18s ease;
}

.pull-cord::after {
  content: '';
  position: absolute;
  left: -3px;
  bottom: -7px;
  width: 8px;
  height: 12px;
  border-radius: 4px;
  background: #b9473f;
  box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.32);
}

.night-lamp-switch:hover .pull-cord {
  transform: scaleY(1.08);
}

.night-lamp-switch:active .pull-cord {
  transform: translateY(12px);
}

.night-lamp-active .lamp-shade {
  background: #434042;
}

.night-lamp-active .lamp-bulb {
  background: #d0a94f;
  box-shadow: 0 0 10px 4px rgba(255, 217, 109, 0.2), 0 0 30px 12px rgba(255, 199, 79, 0.065);
}
</style>
