<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import ChatBox from '@/components/ChatBox.vue'
import SelectionToolbar from '@/components/SelectionToolbar.vue'
import { useChatStore } from '@/stores/chatStore'
import { useReaderStore } from '@/stores/readerStore'
import { useCompanionStore } from '@/stores/companionStore'
import { parseTxt, decodeText } from '@/utils/reader'
import {
  saveBook,
  loadBook,
  saveProgress,
  loadProgress,
} from '@/utils/storage'

const chatStore = useChatStore()
const readerStore = useReaderStore()
const companionStore = useCompanionStore()

const fileInput = ref<HTMLInputElement | null>(null)
const readerContentRef = ref<HTMLElement | null>(null)
const isUploading = ref(false)
const showDirectory = ref(false)
const showChatDrawer = ref(true) // 聊天抽屉开关状态

// 根据当前所选角色，动态呈现其专属渐变色图标
const exclusiveThemeStyle = computed(() => {
  const { accentStart, accentEnd } = companionStore.currentCompanion
  return { background: `linear-gradient(135deg, ${accentStart}, ${accentEnd})` }
})

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

// 划线提问交互：处理来自原位弹出框的提交
async function onToolbarSubmit(data: { text: string; question: string }) {
  if (!readerStore.book) return
  
  // 1. 自动弹出右侧聊天抽屉
  showChatDrawer.value = true

  // 2. 清空划线选择
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()

  if (!data.question.trim()) {
    chatStore.pendingQuote = data.text
    return
  }

  // 3. 发送流式对话
  const contextText = readerStore.currentPageContent || ''
  await chatStore.streamResponse(
    data.question,
    data.text,
    contextText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1
  )
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

  // 1. 先进行用户划线高亮（荧光笔实线）
  chatStore.messages.forEach((msg, idx) => {
    if (msg.role === 'user' && msg.quote) {
      // 跨段落匹配处理：按行拆开匹配，确保每一段对应的行都能高亮
      const lines = msg.quote.split('\n').map(l => l.trim()).filter(Boolean)
      lines.forEach(line => {
        if (line && html.includes(line)) {
          const escapedText = line.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
          const regex = new RegExp(escapedText, 'g')
          // 添加 data-msg-index 属性关联提问消息
          html = html.replace(regex, `<span class="user-highlight-mark" data-msg-index="${idx}">${line}</span>`)
        }
      })
    }
  })

  // 2. 再进行 AI 批注高亮
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
  
  await chatStore.streamResponse(
    text,
    targetQuote,
    contextText,
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
        <!-- 伴侣选择器 (外壳适配 app 变量对比，避免看不清) -->
        <div class="flex items-center bg-stone-500/10 rounded-full p-1 border theme-border theme-header-btn shadow-xs">
          <button
            v-for="c in companionStore.companions"
            :key="c.id"
            :class="[
              'px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300',
              companionStore.currentCompanionId === c.id
                ? 'theme-bg-primary text-white shadow-sm'
                : 'theme-text-app opacity-60 hover:opacity-100'
            ]"
            @click="companionStore.setCompanion(c.id)"
          >
            {{ c.name }}
          </button>
        </div>

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

        <!-- 右侧垂直悬浮面板 -->
        <div v-if="readerStore.book" class="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-3.5 theme-bg-card border theme-border shadow-lg rounded-2xl p-2.5 transition-colors duration-300">
          <!-- 目录圆钮 -->
          <button
            @click="showDirectory = !showDirectory"
            title="查看目录"
            class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <!-- 聊天抽屉折叠圆钮 -->
          <button
            @click="showChatDrawer = !showChatDrawer"
            :title="showChatDrawer ? '收起聊天栏' : '展开聊天栏'"
            class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            :class="{ 'theme-bg-primary-light text-[var(--color-primary)]': showChatDrawer }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          
          <hr class="theme-border opacity-50" />
          
          <!-- 字号调节圆钮 -->
          <button
            @click="readerStore.changeFontSize(1)"
            title="放大字号"
            class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            A+
          </button>
          <button
            @click="readerStore.changeFontSize(-1)"
            title="缩小字号"
            class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-[10px] font-bold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            A-
          </button>
          
          <hr class="theme-border opacity-50" />

          <!-- 阅读背景主题 — 5 色圆点 -->
          <div class="flex flex-col gap-2 items-center">
            <!-- A · 暖金书卷 -->
            <button
              @click="readerStore.setThemeStyle('read-theme-a')"
              class="w-5.5 h-5.5 rounded-full border border-[#ebdcb9] bg-[#fdfaf4] cursor-pointer hover:scale-110 transition-transform"
              :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-a' }"
              title="暖金书卷"
            ></button>
            <!-- B · 冷灰极简 -->
            <button
              @click="readerStore.setThemeStyle('read-theme-b')"
              class="w-5.5 h-5.5 rounded-full border border-[#e4e4e7] bg-[#ffffff] cursor-pointer hover:scale-110 transition-transform"
              :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-b' }"
              title="冷灰极简"
            ></button>
            <!-- C · 奶茶温柔 -->
            <button
              @click="readerStore.setThemeStyle('read-theme-c')"
              class="w-5.5 h-5.5 rounded-full border border-[#eedecf] bg-[#fbf8f3] cursor-pointer hover:scale-110 transition-transform"
              :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-c' }"
              title="奶茶温柔"
            ></button>
            <!-- D · 夜间暗黑 -->
            <button
              @click="readerStore.setThemeStyle('read-theme-dark')"
              class="w-5.5 h-5.5 rounded-full border border-zinc-700 bg-[#1c1c1e] cursor-pointer hover:scale-110 transition-transform"
              :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-dark' }"
              title="夜间暗黑"
            ></button>
            <!-- 专属角色配色 (动态读取渐变与名字) -->
            <button
              @click="readerStore.setThemeStyle('read-theme-exclusive')"
              class="w-5.5 h-5.5 rounded-full border border-stone-300 cursor-pointer hover:scale-110 transition-transform shadow-xs"
              :style="exclusiveThemeStyle"
              :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-exclusive' }"
              :title="companionStore.currentCompanionId === 'luchen' ? '陆沉专属 · 幻惑之瞳' : '萧逸专属 · 极速之耀'"
            ></button>
          </div>
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
          <!-- 局部绑定的 mouseup 正文划线监听，限制其最大高度，防止其撑开卡片 -->
          <div ref="readerContentRef" class="flex-1 min-h-0 overflow-hidden flex flex-col justify-center my-4" @mouseup="onTextSelected" @click="onReaderContentClick">
            <div
              class="wechat-reader-container theme-font-reading tracking-wide text-justify theme-text-card h-full overflow-hidden transition-all duration-300"
              :style="{ fontSize: readerStore.fontSize + 'px' }"
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
                class="indent-8 text-justify leading-relaxed tracking-wide mb-6"
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

    <!-- 选区原位划线工具栏 (submit 映射为就地提问) -->
    <SelectionToolbar
      :selected-text="selectedText"
      :x="selectionX"
      :y="selectionY"
      @submit="onToolbarSubmit"
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
