<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCompanionStore } from '@/stores/companionStore'

const props = defineProps<{
  selectedText: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'highlight', data: { text: string }): void
  (e: 'note', data: { text: string; content: string }): void
  (e: 'ask', data: { text: string; question: string }): void
  (e: 'search', data: { text: string }): void
}>()

const companionStore = useCompanionStore()

// null = 初始按钮栏 / 'note' = 笔记输入 / 'ask' = 提问输入
const activeMode = ref<'note' | 'ask' | null>(null)
const inputText = ref('')
const copyDone = ref(false)

// 每次选中文本更新时，自动重置
watch(
  () => props.selectedText,
  () => {
    activeMode.value = null
    inputText.value = ''
    copyDone.value = false
  }
)

// ── 一键操作 ──

function doHighlight() {
  emit('highlight', { text: props.selectedText })
}

function doSearch() {
  emit('search', { text: props.selectedText })
}

async function doCopy() {
  try {
    await navigator.clipboard.writeText(props.selectedText)
    copyDone.value = true
    setTimeout(() => { copyDone.value = false }, 1500)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = props.selectedText
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyDone.value = true
    setTimeout(() => { copyDone.value = false }, 1500)
  }
}

// ── 输入模式 ──

function openNote() {
  activeMode.value = 'note'
  inputText.value = ''
}

function openAsk() {
  activeMode.value = 'ask'
  inputText.value = ''
}

function submitNote() {
  if (!inputText.value.trim()) return
  emit('note', { text: props.selectedText, content: inputText.value.trim() })
  inputText.value = ''
  activeMode.value = null
}

function submitAsk() {
  emit('ask', { text: props.selectedText, question: inputText.value.trim() })
  inputText.value = ''
  activeMode.value = null
}

function cancel() {
  activeMode.value = null
  inputText.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="selectedText"
      class="absolute z-50 -translate-x-1/2 -translate-y-full mt-[-10px] transition-all duration-300"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <!-- 状态一：五个胶囊按钮 -->
      <div
        v-if="activeMode === null"
        class="flex items-center gap-1 bg-white/95 backdrop-blur border border-stone-200 shadow-lg rounded-full px-1.5 py-1.5 select-none"
        @click.stop
      >
        <!-- 问问xxx -->
        <button
          @click="openAsk"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/20 active:scale-95"
          title="向角色提问讨论选中文字"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>问问{{ companionStore.currentCompanion.name }}</span>
        </button>

        <!-- 分割线 -->
        <span class="w-px h-4 bg-stone-200 mx-0.5"></span>

        <!-- 复制 -->
        <button
          @click="doCopy"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200 active:scale-95"
          title="复制选中文字"
        >
          <svg v-if="!copyDone" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg v-else class="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>{{ copyDone ? '已复制' : '复制' }}</span>
        </button>

        <!-- 划线 -->
        <button
          @click="doHighlight"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 active:scale-95"
          title="高亮标记选中文字"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 11-6 6v3h9l3-3"/>
            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2 2.8-2.8 5.2 5.2"/>
          </svg>
          <span>划线</span>
        </button>

        <!-- 写笔记 -->
        <button
          @click="openNote"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 active:scale-95"
          title="为选中文字写随笔想法"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          </svg>
          <span>写笔记</span>
        </button>

        <!-- 全文搜索 -->
        <button
          @click="doSearch"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 active:scale-95"
          title="在整本书中搜索选中文字"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <span>全文搜索</span>
        </button>
      </div>

      <!-- 状态二/三：笔记 / 提问 输入框 -->
      <div
        v-else
        class="bg-white/95 backdrop-blur border border-stone-200 shadow-xl rounded-2xl p-3 flex flex-col gap-2 w-72 transition-all"
        @click.stop
      >
        <!-- 引用预览条 -->
        <div class="flex items-center gap-1.5 text-[10px] text-stone-400 select-none">
          <svg class="w-3 h-3 shrink-0 opacity-60" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
          <span class="truncate">"{{ selectedText }}"</span>
        </div>

        <!-- 输入区 -->
        <div class="flex gap-1.5 items-center">
          <input
            v-model="inputText"
            type="text"
            ref="inputRef"
            :placeholder="activeMode === 'note' ? '写点想法...' : `向 ${companionStore.currentCompanion.name} 提问...`"
            class="flex-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] bg-stone-50 text-stone-800"
            @keyup.enter="activeMode === 'note' ? submitNote() : submitAsk()"
            @keyup.escape="cancel"
            v-focus
          />
          <button
            v-if="activeMode === 'note'"
            @click="submitNote"
            :disabled="!inputText.trim()"
            class="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 shadow-sm cursor-pointer shrink-0 transition-colors"
          >
            保存
          </button>
          <button
            v-else
            @click="submitAsk"
            class="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 shadow-sm cursor-pointer shrink-0 transition-colors"
          >
            {{ inputText.trim() ? '发送' : '发送' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus()
}
</script>
