<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ChatBox from '@/components/ChatBox.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'
import { useChatStore } from '@/stores/chatStore'
import { useReaderStore } from '@/stores/readerStore'
import { useCompanionStore } from '@/stores/companionStore'
import { useReadingRecordsStore } from '@/stores/readingRecordsStore'
import { parseTxt, decodeText, paginateText } from '@/utils/reader'
import { saveBook, loadBook, saveProgress, loadProgress } from '@/utils/storage'

// 导入拆分出的组件
import ReaderSideToolbar from '@/components/ReaderSideToolbar.vue'
import BookmarkRibbon from '@/components/BookmarkRibbon.vue'
import ReadingStatsDialog from '@/components/ReadingStatsDialog.vue'

const router = useRouter()
const chatStore = useChatStore()
const readerStore = useReaderStore()
const companionStore = useCompanionStore()
const recordsStore = useReadingRecordsStore()

const fileInput = ref<HTMLInputElement | null>(null)
const readerContentRef = ref<HTMLElement | null>(null)
const isUploading = ref(false)
const showDirectory = ref(false)
const showChatDrawer = ref(true) // 聊天抽屉开关状态
const showStatsDialog = ref(false) // 统计弹窗显示开关
const showSearchDialog = ref(false) // 全文搜索结果弹窗

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
    const marks = document.querySelectorAll('.user-highlight-mark, .ai-annotation-mark')
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
  ElMessage.success('已添加高亮')
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()
}

/** 划线后写随笔笔记（不触发 AI） */
async function onNote(data: { text: string; content: string }) {
  if (!readerStore.book) return
  const highlightId = 'hl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
  // 同时存划线标记和笔记
  await recordsStore.addHighlight({
    id: highlightId,
    bookId: readerStore.book.id,
    chapterIndex: readerStore.currentChapterIndex,
    pageIndex: readerStore.currentPageIndex,
    quote: data.text,
    createdAt: new Date().toISOString()
  })
  await recordsStore.addNote({
    id: 'note_' + Date.now(),
    bookId: readerStore.book.id,
    highlightId,
    chapterIndex: readerStore.currentChapterIndex,
    pageIndex: readerStore.currentPageIndex,
    quote: data.text,
    content: data.content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  ElMessage.success('笔记已保存')
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
  const chapterText = readerStore.currentChapter?.content || ''
  await chatStore.streamResponse(
    data.question,
    data.text,
    contextText,
    chapterText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1
  )
}

// ── 全文搜索 ──
const searchResults = ref<SearchResult[]>([])
const searchQuery = ref('')

function onSearch(data: { text: string }) {
  const query = data.text.trim()
  if (!query || query.length < 2) {
    ElMessage.warning('搜索内容太短，至少需要 2 个字')
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
    const arrayBuffer = await file.arrayBuffer()
    const rawText = decodeText(arrayBuffer)
    const parsed = parseTxt(file.name, rawText)
    
    // 保存至本地 Store 与 IndexedDB
    readerStore.setBook('demo', parsed.title, parsed.chapters)
    await saveBook('demo', rawText)
    
    // 初始化进度
    await saveProgress('demo', {
      chapter: 0,
      page: 0,
      updatedAt: new Date().toISOString(),
    })
    
    // 初始化该书与该角色的会话列表
    chatStore.clear()
    await chatStore.loadSessions('demo', companionStore.currentCompanionId)
  } catch (err) {
    console.error('导入失败：', err)
    alert('导入失败，请检查文件格式是否正确。')
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

  // 0. 收集 recordsStore 中属于当前页的高亮 & 笔记 quote
  const currentChapterIdx = readerStore.currentChapterIndex
  const currentPageIdx = readerStore.currentPageIndex
  const currentPageRecords: { id: string; quote: string }[] = []

  recordsStore.highlights
    .filter(h => h.chapterIndex === currentChapterIdx && h.pageIndex === currentPageIdx)
    .forEach(h => currentPageRecords.push({ id: h.id, quote: h.quote }))

  recordsStore.notes
    .filter(n => n.chapterIndex === currentChapterIdx && n.pageIndex === currentPageIdx && n.quote)
    .forEach(n => currentPageRecords.push({ id: n.id, quote: n.quote! }))

  // 去重（同一条 quote 可能在 highlights 和 notes 都出现）
  const uniqueRecords = currentPageRecords.filter(
    (r, i, arr) => arr.findIndex(x => x.quote === r.quote) === i
  )

  // 1. recordsStore 手动划线 / 笔记高亮
  uniqueRecords.forEach(rec => {
    if (rec.quote && html.includes(rec.quote)) {
      const escapedText = rec.quote.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(escapedText, 'g')
      html = html.replace(regex, `<span class="user-highlight-mark" data-hl-id="${rec.id}">${rec.quote}</span>`)
    }
  })

  // 2. chatStore 用户划线高亮（荧光笔实线）
  chatStore.messages.forEach((msg, idx) => {
    if (msg.role === 'user' && msg.quote) {
      const lines = msg.quote.split('\n').map(l => l.trim()).filter(Boolean)
      lines.forEach(line => {
        if (line && html.includes(line)) {
          const escapedText = line.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
          const regex = new RegExp(escapedText, 'g')
          html = html.replace(regex, `<span class="user-highlight-mark" data-msg-index="${idx}">${line}</span>`)
        }
      })
    }
  })

  // 3. AI 批注高亮
  activeAnnotations.value.forEach(ann => {
    if (ann.originalText && html.includes(ann.originalText)) {
      const escapedText = ann.originalText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(escapedText, 'g')
      html = html.replace(regex, `<span class="ai-annotation-mark" title="${ann.comment}">${ann.originalText}</span>`)
    }
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
function onReaderContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const userMark = target.closest('.user-highlight-mark') as HTMLElement | null
  
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
  const chapterText = readerStore.currentChapter?.content || ''
  
  await chatStore.streamResponse(
    text,
    targetQuote,
    contextText,
    chapterText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1
  )
}

function cleanContent(content: string) {
  return content.replace(/<annotation>.*?<\/annotation>/gs, '').trim()
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
  async ([newChapter, newPage]) => {
    if (readerStore.book) {
      await saveProgress('demo', {
        chapter: newChapter,
        page: newPage,
        updatedAt: new Date().toISOString(),
      })
      scrollToPendingQuote()
    }
  }
)

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
    ElMessage.warning('角色正在回复中，请等待完成后再切换')
    return
  }
  companionStore.setCompanion(id)
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
    if (e.key === 'ArrowRight') readerStore.nextPage()
    else readerStore.prevPage()
  }
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', onKeyDown)
  }
})

// ── 挂载初始化 ──
onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', onKeyDown)
    handleResize()
  }
  readerStore.resetReadingTimer()

  const savedBookText = await loadBook('demo')
  if (savedBookText) {
    const parsed = parseTxt('测试书籍.txt', savedBookText)
    readerStore.setBook('demo', parsed.title, parsed.chapters)
    
    const progress = await loadProgress('demo')
    if (progress) {
      readerStore.currentChapterIndex = progress.chapter
      readerStore.currentPageIndex = progress.page
    }
    
    // 载入当前书籍与角色的会话列表
    await chatStore.loadSessions('demo', companionStore.currentCompanionId)
  }
})
</script>

<template>
  <div class="h-screen overflow-hidden flex flex-col transition-colors duration-300 theme-bg-app">
    <!-- Header 头部栏 -->
    <header class="border-b theme-border px-6 py-4 flex items-center justify-between bg-[var(--color-bg-app)] shrink-0 z-10">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold tracking-wide theme-text-app">AI 共读</h1>
        <div v-if="readerStore.book" class="text-sm theme-text-app opacity-70 font-sans">
          正在共读：《{{ readerStore.book.title }}》
        </div>
      </div>

      <!-- 顶部配置栏 -->
      <div class="flex items-center gap-4">
        <!-- 伴侣下拉选择器 -->
        <el-dropdown trigger="click" @command="handleCompanionSwitch">
          <button 
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border theme-header-btn bg-stone-500/5 hover:bg-stone-500/10 transition-colors cursor-pointer text-xs font-semibold"
            :disabled="chatStore.isStreaming"
            :class="{ 'opacity-50 cursor-not-allowed': chatStore.isStreaming }"
          >
            <span 
              class="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-inner" 
              :style="{ background: `linear-gradient(135deg, ${companionStore.currentCompanion.accentStart}, ${companionStore.currentCompanion.accentEnd})` }"
            ></span>
            <span class="theme-text-app">{{ companionStore.currentCompanion.name }}</span>
            <el-icon class="text-stone-400"><ArrowDown /></el-icon>
          </button>
          
          <template #dropdown>
            <el-dropdown-menu class="!p-1.5 w-48">
              <el-dropdown-item 
                v-for="c in companionStore.allCompanions" 
                :key="c.id" 
                :command="c.id"
                :class="{ 'theme-bg-primary-light !text-[var(--color-primary)] font-bold': companionStore.currentCompanionId === c.id }"
              >
                <div class="flex items-center gap-2 w-full">
                  <span 
                    class="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-inner" 
                    :style="{ background: `linear-gradient(135deg, ${c.accentStart}, ${c.accentEnd})` }"
                  ></span>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs truncate font-bold">{{ c.name }}</div>
                    <div class="text-[9px] text-stone-400 truncate mt-0.5">{{ c.title }}</div>
                  </div>
                </div>
              </el-dropdown-item>
              
              <el-dropdown-item divided @click="router.push('/companions')">
                <div class="flex items-center justify-center gap-1.5 w-full text-xs font-bold text-[var(--color-primary)] py-0.5">
                  <el-icon><Setting /></el-icon>
                  管理共读角色
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 导入书籍按钮 -->
        <input
          type="file"
          ref="fileInput"
          accept=".txt"
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
      </div>
    </header>

    <!-- 主阅读与聊天区域 -->
    <main class="flex-1 min-h-0 flex overflow-hidden">
      <!-- 左侧阅读器视口 -->
      <section class="flex-1 min-w-0 flex flex-col justify-between p-6 overflow-hidden relative transition-colors duration-300">
        
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
          />
        </div>

        <!-- 空白导入状态 -->
        <div v-if="!readerStore.book" class="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-stone-500/10 flex items-center justify-center text-stone-500 shadow-sm border theme-border">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-[var(--color-read-title)]">开始你的 AI 共读之旅</h3>
          <p class="text-sm text-[var(--color-read-text)] opacity-70 max-w-sm">
            导入一份 TXT 小说，与你选择的伴侣一起沉浸式共读，他会在阅读过程中为你提供温暖的对话与情绪价值。
          </p>
          <button
            @click="fileInput?.click()"
            class="px-6 py-2.5 rounded-full theme-bg-primary text-white text-sm font-semibold theme-bg-primary-hover shadow-md hover:scale-105 transition-all duration-300"
          >
            导入一本 TXT 书籍
          </button>
        </div>

        <!-- 小说展示区 (微信读书风格独立大书卡纸张) -->
        <div
          v-else
          class="flex-1 max-w-7xl mx-auto w-full theme-bg-card theme-text-card rounded-2xl shadow-lg border theme-border flex flex-col justify-between px-10 py-8 my-3 relative transition-all duration-300 min-h-0"
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
              @click="readerStore.prevPage()"
            >
              上一页
            </button>
            <span class="font-medium">
              第 {{ readerStore.currentChapterIndex + 1 }} 章 · 第 {{ readerStore.currentPageIndex + 1 }} / {{ readerStore.totalPages }} 页
            </span>
            <button
              class="px-4 py-1.5 border theme-border rounded-full hover:bg-stone-500/10 theme-text-card disabled:opacity-30 disabled:pointer-events-none transition-colors"
              :disabled="readerStore.currentChapterIndex === readerStore.chapters.length - 1 && readerStore.currentPageIndex === readerStore.totalPages - 1"
              @click="readerStore.nextPage()"
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
            <p class="whitespace-pre-line">{{ msg.role === 'user' ? msg.content : cleanContent(msg.content) }}</p>
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

    <!-- 全文搜索结果弹窗 -->
    <el-dialog
      v-model="showSearchDialog"
      :title="'全文搜索：' + searchQuery"
      width="700px"
      destroy-on-close
      class="stats-dialog !rounded-2xl"
    >
      <template v-if="searchResults.length === 0">
        <div class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <svg class="w-10 h-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <div class="text-xs font-bold text-stone-500">未找到匹配结果</div>
          <p class="text-[10px] opacity-70">尝试缩短搜索词或更换关键词。</p>
        </div>
      </template>

      <div v-else class="max-h-[420px] overflow-y-auto space-y-2 pr-1">
        <div class="text-[10px] text-stone-400 mb-2">共找到 {{ searchResults.length }} 处匹配</div>
        <div
          v-for="(r, i) in searchResults"
          :key="i"
          class="flex items-start gap-3 p-3 rounded-xl bg-stone-500/5 hover:bg-stone-500/10 border border-stone-200/60 transition-colors cursor-pointer group"
          @click="handleSearchNavigate(r.chapterIndex, r.pageIndex)"
        >
          <!-- 章节页码标记 -->
          <div class="shrink-0 flex flex-col items-center min-w-[44px]">
            <span class="text-[10px] font-bold text-[var(--color-primary)]">{{ r.chapterTitle }}</span>
            <span class="text-[9px] text-stone-400">第 {{ r.pageIndex + 1 }} 页</span>
          </div>

          <!-- 上下文片段 -->
          <div class="flex-1 min-w-0">
            <p class="text-xs text-[var(--color-read-text)] leading-relaxed line-clamp-2">
              {{ r.context }}
            </p>
          </div>

          <!-- 跳转按钮 -->
          <button
            class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-all border bg-[var(--color-primary)]/5 text-[var(--color-primary)] border-[var(--color-primary)]/15 opacity-0 group-hover:opacity-100 hover:bg-[var(--color-primary)]/10 active:scale-95"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/>
            </svg>
            <span>跳转</span>
          </button>
        </div>
      </div>
    </el-dialog>
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
</style>
