<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { useCompanionStore } from '@/stores/companionStore'
import { useReaderStore } from '@/stores/readerStore'
import { cleanAssistantContent } from '@/utils/chat'
import SessionManager from '@/components/SessionManager.vue'
import type { ChatScene } from '@/stores/chatStore'

const chatStore = useChatStore()
const companionStore = useCompanionStore()
const readerStore = useReaderStore()

const input = ref('')
const messageContainer = ref<HTMLDivElement | null>(null)
const inputField = ref<HTMLTextAreaElement | null>(null)

const quickActions: { label: string; scene: ChatScene; message: string }[] = [
  { label: '这段什么意思？', scene: 'quick_explain', message: '这段什么意思？' },
  { label: '聊聊你的感受', scene: 'quick_feeling', message: '聊聊你读到这里的感受。' },
  { label: '继续读吧', scene: 'continue', message: '陪我继续读吧。' },
  { label: '戳你一下', scene: 'playful_ping', message: '戳你一下。' },
  { label: '想听你说话', scene: 'companion_idle', message: '想听你说句话。' },
]

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
  const chapterText = readerStore.currentChapterReadContent || ''
  
  chatStore.streamResponse(
    userText,
    quoteText,
    contextText,
    chapterText,
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1,
    { scene: quoteText ? 'quote' : 'general' }
  )
}

function sendQuickAction(scene: ChatScene, message: string) {
  if (chatStore.isStreaming || !readerStore.book) return

  const quoteText = chatStore.pendingQuote.trim()
  chatStore.pendingQuote = ''

  chatStore.streamResponse(
    message,
    quoteText,
    readerStore.currentPageContent || '',
    readerStore.currentChapterReadContent || '',
    readerStore.book.id,
    companionStore.currentCompanionId,
    readerStore.currentChapterIndex + 1,
    { scene }
  )
}

function createNewSession() {
  if (!readerStore.book) return
  chatStore.createNewSession(readerStore.book.id, companionStore.currentCompanionId)
}

function clearCurrentSession() {
  if (!readerStore.book) return
  chatStore.clearCurrentSession(readerStore.book.id, companionStore.currentCompanionId)
}

</script>

<template>
  <aside class="w-96 h-full min-h-0 shrink-0 border-l theme-border flex flex-col theme-bg-chat shadow-md z-10 transition-colors duration-300">
    <!-- 伴侣状态与多会话管理器 (子组件) -->
    <SessionManager
      v-if="readerStore.book"
      :sessions="chatStore.sessions"
      :current-session-id="chatStore.currentSessionId"
      @select="id => chatStore.currentSessionId = id"
      @create="createNewSession"
      @rename="name => chatStore.updateSessionName(readerStore.book!.id, companionStore.currentCompanionId, chatStore.currentSessionId, name)"
      @clear="clearCurrentSession"
    />

    <!-- 聊天记录区域 -->
    <div ref="messageContainer" class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-stone-500/5">
      <template v-for="(msg, i) in chatStore.messages" :key="i">
        <!-- 状态A：等待 AI 加载中 (显示精致微型 loading 气泡) -->
        <div 
          v-if="msg.role === 'ai' && !msg.content && msg.isStreaming"
          class="ai-loading-bubble bg-[var(--color-bg-bubble-ai)] text-[var(--color-text-bubble-ai)] border theme-border mr-auto shadow-sm"
        >
          <div class="chat-bubble-dots">
            <span class="chat-bubble-dot"></span>
            <span class="chat-bubble-dot"></span>
            <span class="chat-bubble-dot"></span>
          </div>
        </div>

        <!-- 状态B：普通用户/AI 气泡 -->
        <div
          v-else
          :class="[
            'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-300 w-fit clear-both mt-4 first:mt-0',
            msg.role === 'user'
              ? 'ml-auto bg-[var(--color-bg-bubble-user)] text-[var(--color-text-bubble-user)] rounded-br-none'
              : 'mr-auto bg-[var(--color-bg-bubble-ai)] text-[var(--color-text-bubble-ai)] border theme-border rounded-bl-none',
            msg.isStreaming && msg.content ? 'typewriter-loading' : ''
          ]"
        >
          <!-- 引用原文卡片 -->
          <div
            v-if="msg.role === 'user' && msg.quote"
            class="mb-1.5 p-2 rounded-lg bg-stone-500/10 border-l-2 border-[var(--color-primary)] text-[10px] leading-relaxed italic text-[var(--color-read-text)] select-none"
          >
            “{{ msg.quote }}”
          </div>
          
          <p class="whitespace-pre-line">{{ msg.role === 'user' ? msg.content : cleanAssistantContent(msg.content) }}</p>
        </div>
      </template>
      
      <!-- 引导状态 -->
      <div v-if="chatStore.messages.length === 0" class="text-stone-400 text-sm text-center pt-12 space-y-1">
        <p class="font-bold text-stone-500">与{{ companionStore.currentCompanion.name }}共读</p>
        <p class="text-xs text-stone-400 max-w-[200px] mx-auto leading-normal">
          你可以在下方输入想法，或者直接在书页中“划线提问”。
        </p>
      </div>
    </div>

    <!-- 统一输入发送 Composer -->
    <div class="border-t theme-border p-4 theme-bg-chat transition-colors duration-300 shrink-0">
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="action in quickActions"
          :key="action.scene"
          class="px-2.5 py-1 rounded-full border theme-border bg-stone-500/5 hover:bg-stone-500/10 text-[10px] font-semibold text-[var(--color-read-text)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          :disabled="chatStore.isStreaming"
          @click="sendQuickAction(action.scene, action.message)"
        >
          {{ action.label }}
        </button>
      </div>

      <div class="rounded-2xl border theme-border bg-[var(--color-read-bg)] focus-within:ring-2 focus-within:ring-[var(--color-primary)] overflow-hidden flex flex-col transition-all">
        <!-- 待发送引用选区展示 (嵌在 composer 内部顶部) -->
        <div
          v-if="chatStore.pendingQuote"
          class="px-3.5 py-2 border-b theme-border bg-stone-500/5 flex items-center justify-between text-xs text-stone-500 transition-all duration-300"
        >
          <div class="flex items-center gap-1.5 overflow-hidden pr-2">
            <span class="font-bold shrink-0 text-[var(--color-primary)]">引用:</span>
            <span class="truncate italic text-[var(--color-read-text)]">“{{ chatStore.pendingQuote }}”</span>
          </div>
          <button
            @click="chatStore.pendingQuote = ''"
            class="shrink-0 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer flex items-center justify-center p-0.5 rounded-full hover:bg-stone-500/10"
          >
            <Close class="w-2.5 h-2.5" />
          </button>
        </div>

        <!-- 输入框 + 发送按钮 -->
        <div class="flex items-end p-2 gap-2">
          <textarea
            v-model="input"
            ref="inputField"
            rows="1"
            :placeholder="chatStore.pendingQuote ? '针对选中文字输入你的想法...' : '输入你的想法或提问...'"
            class="flex-1 px-2.5 py-2 text-xs bg-transparent text-[var(--color-read-text)] border-none focus:outline-none resize-none min-h-[32px] max-h-[120px]"
            @input="autoResize"
            @keydown="onEnterSend"
            :disabled="chatStore.isStreaming"
          />
          
          <button
            :disabled="(!input.trim() && !chatStore.pendingQuote) || chatStore.isStreaming"
            @click="send"
            class="shrink-0 h-8 w-8 rounded-full theme-bg-primary text-white flex items-center justify-center shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-45 disabled:pointer-events-none"
            title="发送"
          >
            <Loading v-if="chatStore.isStreaming" class="w-4 h-4 animate-spin" />
            <Promotion v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
