<script setup lang="ts">
import { ref } from 'vue'
import { useReaderStore } from '@/stores/readerStore'
import { useChatStore } from '@/stores/chatStore'
import { useReadingRecordsStore } from '@/stores/readingRecordsStore'
import { useCompanionStore } from '@/stores/companionStore'
import ReadingRecordItem from './ReadingRecordItem.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'openChatDrawer'): void
}>()

const readerStore = useReaderStore()
const chatStore = useChatStore()
const recordsStore = useReadingRecordsStore()
const companionStore = useCompanionStore()
const activeTab = ref<'bookmarks' | 'highlights' | 'notes' | 'fragments'>('bookmarks')

const tabs = [
  { id: 'bookmarks', label: '我的书签' },
  { id: 'highlights', label: '高亮划线' },
  { id: 'notes', label: '随感笔记' },
  { id: 'fragments', label: 'AI 研讨片段' },
] as const

// ── 内部跳转定位 ──
function handleNavigate(chapterIdx: number, pageIdx: number, sessionId?: string, quote?: string) {
  readerStore.recordCurrentProgress()
  if (quote) {
    readerStore.pendingScrollQuote = quote
  }
  readerStore.currentChapterIndex = chapterIdx
  readerStore.currentPageIndex = Math.max(0, Math.min(pageIdx, readerStore.totalPages - 1))
  
  if (sessionId) {
    chatStore.currentSessionId = sessionId
    emit('openChatDrawer')
  }
  emit('update:modelValue', false)
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-stone-900/45 backdrop-blur-sm" @click="emit('update:modelValue', false)"></div>
      <div class="relative w-full max-w-[800px] max-h-[86vh] rounded-2xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col">
        <header class="px-5 py-4 border-b theme-border bg-stone-500/5 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-[var(--color-read-title)]">共读记录与统计看板</h3>
            <p class="text-[10px] text-stone-400 mt-0.5">书签、划线、笔记和 AI 研讨片段</p>
          </div>
          <button
            class="w-7 h-7 rounded-full hover:bg-stone-500/10 text-stone-400 hover:text-stone-600 transition-colors"
            @click="emit('update:modelValue', false)"
          >
            <Close class="w-3.5 h-3.5 mx-auto" />
          </button>
        </header>

        <div class="px-4 pt-4">
          <div class="grid grid-cols-4 gap-1 rounded-xl border theme-border bg-stone-500/5 p-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="px-3 py-2 rounded-lg text-xs font-bold transition-colors"
              :class="activeTab === tab.id ? 'theme-bg-primary text-white shadow-sm' : 'theme-text-card hover:bg-stone-500/10'"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <!-- 1. 书签看板 -->
      <section v-if="activeTab === 'bookmarks'">
        <!-- 统一的精致空白提示 -->
        <div v-if="recordsStore.bookmarks.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <Bookmark class="w-8 h-8 opacity-50" />
          <div class="text-xs font-bold text-stone-500">暂无书签</div>
          <p class="text-[10px] opacity-70">在正文右上角悬浮向下拽动，即可拉下书签绸带。</p>
        </div>
        <div v-else class="space-y-3 pr-1">
          <ReadingRecordItem
            v-for="b in recordsStore.bookmarks"
            :key="b.id"
            type="bookmark"
            :title="b.chapterTitle"
            :subtitle="`第 ${b.pageIndex + 1} 页`"
            :quote="b.excerpt"
            :time="b.createdAt"
            @navigate="handleNavigate(b.chapterIndex, b.pageIndex, undefined, b.excerpt)"
            @delete="recordsStore.removeBookmark(b.id)"
          />
        </div>
      </section>

      <!-- 2. 高亮看板 -->
      <section v-if="activeTab === 'highlights'">
        <div v-if="recordsStore.highlights.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <EditPen class="w-8 h-8 opacity-50" />
          <div class="text-xs font-bold text-stone-500">暂无高亮</div>
          <p class="text-[10px] opacity-70">在正文划线选区中直接点击“引用”即可快速高亮。</p>
        </div>
        <div v-else class="space-y-3 pr-1">
          <ReadingRecordItem
            v-for="h in recordsStore.highlights"
            :key="h.id"
            type="highlight"
            title="高亮原文"
            :quote="h.quote"
            :time="h.createdAt"
            @navigate="handleNavigate(h.chapterIndex, h.pageIndex, undefined, h.quote)"
            @delete="recordsStore.removeHighlight(h.id)"
          />
        </div>
      </section>

      <!-- 3. 随笔笔记看板 -->
      <section v-if="activeTab === 'notes'">
        <div v-if="recordsStore.notes.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <Document class="w-8 h-8 opacity-50" />
          <div class="text-xs font-bold text-stone-500">暂无随感笔记</div>
          <p class="text-[10px] opacity-70">在划线提问时输入你的想法并发送，将同步保存为笔记。</p>
        </div>
        <div v-else class="space-y-3 pr-1">
          <ReadingRecordItem
            v-for="n in recordsStore.notes"
            :key="n.id"
            type="note"
            title="笔记摘录"
            :quote="n.quote"
            :content="n.content"
            :time="n.createdAt"
            @navigate="handleNavigate(n.chapterIndex, n.pageIndex, undefined, n.quote)"
            @delete="recordsStore.removeNote(n.id)"
          />
        </div>
      </section>

      <!-- 4. AI 对话片段看板 -->
      <section v-if="activeTab === 'fragments'">
        <div v-if="recordsStore.aiFragments.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <ChatLineRound class="w-8 h-8 opacity-50" />
          <div class="text-xs font-bold text-stone-500">暂无研讨片段</div>
          <p class="text-[10px] opacity-70">在正文划线向角色提问，成功获取答复后自动录入片段。</p>
        </div>
        <div v-else class="space-y-3 pr-1">
          <ReadingRecordItem
            v-for="f in recordsStore.aiFragments"
            :key="f.id"
            type="aifragment"
            title="研讨片段"
            :quote="f.quote"
            :content="f.userMessage"
            :ai-message="f.aiMessage"
            :ai-name="companionStore.currentCompanion.name"
            :time="f.createdAt"
            @navigate="handleNavigate(f.chapterIndex, f.pageIndex, f.sessionId, f.quote)"
            @delete="recordsStore.removeAiFragment(f.id)"
          />
        </div>
      </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
