<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { useCompanionStore } from '@/stores/companionStore'
import { useReaderStore } from '@/stores/readerStore'

const chatStore = useChatStore()
const companionStore = useCompanionStore()
const readerStore = useReaderStore()

const input = ref('')
const messageContainer = ref<HTMLDivElement | null>(null)
const inputField = ref<HTMLTextAreaElement | null>(null)

function scrollToBottom() {
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

// 自动滚动到底部
watch(
  () => chatStore.messages,
  () => {
    nextTick(() => {
      scrollToBottom()
    })
  },
  { deep: true }
)

// 监听引用文本改变，自动聚焦输入框
watch(
  () => chatStore.pendingQuote,
  (newQuote) => {
    if (newQuote) {
      nextTick(() => {
        inputField.value?.focus()
      })
    }
  }
)

function autoResize() {
  const el = inputField.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }
}

function onEnterSend(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function send() {
  if (chatStore.isStreaming || !readerStore.book) return
  
  const userText = input.value.trim()
  const quoteText = chatStore.pendingQuote.trim()
  
  if (!userText && !quoteText) return

  input.value = ''
  chatStore.pendingQuote = '' // 清除引用

  // 获取当前阅读段落作为上下文
  const contextText = readerStore.currentPageContent || ''
  
  chatStore.streamResponse(
    userText,
    quoteText,
    contextText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1
  )
}

function createNewSession() {
  if (!readerStore.book) return
  chatStore.createNewSession(readerStore.book.id, companionStore.currentCompanionId)
}

function clearCurrentSession() {
  if (!readerStore.book) return
  if (confirm('确认清空当前会话的消息记录吗？')) {
    chatStore.clearCurrentSession(readerStore.book.id, companionStore.currentCompanionId)
  }
}

/**
 * 限制展示字符
 */
function cleanContent(content: string) {
  return content.replace(/<annotation>.*?<\/annotation>/gs, '').trim()
}
</script>

<template>
  <aside class="w-96 h-full min-h-0 shrink-0 border-l theme-border flex flex-col theme-bg-chat shadow-md z-10 transition-colors duration-300">
    <!-- 伴侣状态与多会话管理器 -->
    <div class="px-4 py-3 border-b theme-border flex items-center justify-between bg-stone-500/10 shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full theme-avatar text-white flex items-center justify-center text-xs font-bold shadow-inner shrink-0">
          {{ companionStore.currentCompanion.name[0] }}
        </div>
        <div>
          <h3 class="text-sm font-bold text-[var(--color-read-title)] leading-tight">{{ companionStore.currentCompanion.name }}</h3>
          <p class="text-[11px] opacity-60 font-sans tracking-wide leading-tight mt-0.5">
            {{ companionStore.currentCompanion.title }}
          </p>
        </div>
      </div>

      <!-- 会话选择与管理 -->
      <div class="flex items-center gap-1.5">
        <select
          v-model="chatStore.currentSessionId"
          class="bg-[var(--color-read-bg)] text-[10px] border theme-border rounded-lg px-2 py-1 text-[var(--color-read-text)] focus:outline-none max-w-[90px] truncate"
        >
          <option v-for="s in chatStore.sessions" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </select>
        <button
          @click="createNewSession"
          title="新建会话"
          class="text-[10px] text-[var(--color-read-text)] opacity-70 hover:opacity-100 px-2 py-1 border theme-border rounded-lg bg-[var(--color-read-bg)] hover:bg-stone-500/10 transition-colors cursor-pointer font-medium shrink-0"
        >
          新建
        </button>
        <button
          @click="clearCurrentSession"
          title="清空当前会话"
          class="text-[10px] text-[var(--color-read-text)] opacity-70 hover:opacity-100 px-2 py-1 border theme-border rounded-lg bg-[var(--color-read-bg)] hover:bg-stone-500/10 transition-colors cursor-pointer font-medium shrink-0"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 聊天记录区域 -->
    <div ref="messageContainer" class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-stone-500/5">
      <div
        v-for="(msg, i) in chatStore.messages"
        :key="i"
        :class="[
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-300',
          msg.role === 'user'
            ? 'ml-auto bg-[var(--color-bg-bubble-user)] text-[var(--color-text-bubble-user)] rounded-br-none'
            : 'mr-auto bg-[var(--color-bg-bubble-ai)] text-[var(--color-text-bubble-ai)] border theme-border rounded-bl-none',
          msg.isStreaming ? 'typewriter-loading' : ''
        ]"
      >
        <!-- 引用原文卡片 -->
        <div
          v-if="msg.role === 'user' && msg.quote"
          class="mb-1.5 p-2 rounded-lg bg-black/5 border-l-2 border-[var(--color-primary)] text-[10px] leading-relaxed opacity-75 italic text-stone-700 select-none"
        >
          “{{ msg.quote }}”
        </div>
        <p class="whitespace-pre-line">{{ msg.role === 'user' ? msg.content : cleanContent(msg.content) }}</p>
      </div>
      
      <!-- 引导状态 -->
      <div v-if="chatStore.messages.length === 0" class="text-stone-400 text-sm text-center pt-12 space-y-1">
        <p class="font-bold text-stone-500">与{{ companionStore.currentCompanion.name }}共读</p>
        <p class="text-xs text-stone-400 max-w-[200px] mx-auto leading-normal">
          你可以在下方输入想法，或者直接在书页中“划线提问”。
        </p>
      </div>
    </div>

    <!-- 待发送引用选区展示 -->
    <div
      v-if="chatStore.pendingQuote"
      class="px-4 py-2 border-t theme-border bg-stone-500/5 flex items-center justify-between text-xs text-stone-500 transition-all duration-300"
    >
      <div class="flex items-center gap-1.5 overflow-hidden pr-2">
        <span class="font-bold shrink-0 theme-text-primary">引用原文:</span>
        <span class="truncate italic text-[var(--color-read-text)]">“{{ chatStore.pendingQuote }}”</span>
      </div>
      <button
        @click="chatStore.pendingQuote = ''"
        class="shrink-0 text-stone-400 hover:text-stone-600 transition-colors px-1"
      >
        ✕
      </button>
    </div>

    <!-- 输入发送区域 -->
    <div class="border-t theme-border p-4 theme-bg-chat transition-colors duration-300">
      <div class="flex gap-2">
        <textarea
          v-model="input"
          ref="inputField"
          rows="1"
          :placeholder="chatStore.pendingQuote ? '针对选中文字输入你的想法...' : '输入你的想法或提问...'"
          class="flex-1 rounded-xl border theme-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-read-bg)] text-[var(--color-read-text)] transition-all resize-none"
          @input="autoResize"
          @keydown="onEnterSend"
          :disabled="chatStore.isStreaming"
        />
        <button
          class="rounded-xl theme-bg-primary px-5 py-2.5 text-sm font-semibold text-white theme-bg-primary-hover shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          @click="send"
          :disabled="(!input.trim() && !chatStore.pendingQuote) || chatStore.isStreaming"
        >
          {{ chatStore.isStreaming ? '回复中' : '发送' }}
        </button>
      </div>
    </div>
  </aside>
</template>
