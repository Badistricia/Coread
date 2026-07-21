<script setup lang="ts">
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

// ── 内部跳转定位 ──
function handleNavigate(chapterIdx: number, pageIdx: number, sessionId?: string, quote?: string) {
  readerStore.recordCurrentProgress()
  if (quote) {
    readerStore.pendingScrollQuote = quote
  }
  readerStore.currentChapterIndex = chapterIdx
  readerStore.currentPageIndex = pageIdx
  
  if (sessionId) {
    chatStore.currentSessionId = sessionId
    emit('openChatDrawer')
  }
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(val: boolean) => emit('update:modelValue', val)"
    title="共读记录与统计看板"
    width="800px"
    destroy-on-close
    class="stats-dialog !rounded-2xl"
  >
    <el-tabs type="border-card" class="rounded-xl overflow-hidden border theme-border stats-tabs-card">
      <!-- 1. 书签看板 -->
      <el-tab-pane label="我的书签">
        <!-- 统一的精致空白提示 -->
        <div v-if="recordsStore.bookmarks.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <el-icon class="text-3xl opacity-50"><Bookmark /></el-icon>
          <div class="text-xs font-bold text-stone-500">暂无书签</div>
          <p class="text-[10px] opacity-70">在正文右上角悬浮向下拽动，即可拉下书签绸带。</p>
        </div>
        <div v-else class="max-h-[380px] overflow-y-auto space-y-3 pr-1">
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
      </el-tab-pane>

      <!-- 2. 高亮看板 -->
      <el-tab-pane label="高亮划线">
        <div v-if="recordsStore.highlights.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <el-icon class="text-3xl opacity-50"><EditPen /></el-icon>
          <div class="text-xs font-bold text-stone-500">暂无高亮</div>
          <p class="text-[10px] opacity-70">在正文划线选区中直接点击“引用”即可快速高亮。</p>
        </div>
        <div v-else class="max-h-[380px] overflow-y-auto space-y-3 pr-1">
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
      </el-tab-pane>

      <!-- 3. 随笔笔记看板 -->
      <el-tab-pane label="随感笔记">
        <div v-if="recordsStore.notes.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <el-icon class="text-3xl opacity-50"><Document /></el-icon>
          <div class="text-xs font-bold text-stone-500">暂无随感笔记</div>
          <p class="text-[10px] opacity-70">在划线提问时输入你的想法并发送，将同步保存为笔记。</p>
        </div>
        <div v-else class="max-h-[380px] overflow-y-auto space-y-3 pr-1">
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
      </el-tab-pane>

      <!-- 4. AI 对话片段看板 -->
      <el-tab-pane label="AI 研讨片段">
        <div v-if="recordsStore.aiFragments.length === 0" class="flex flex-col items-center justify-center py-16 text-stone-400 gap-2.5 select-none">
          <el-icon class="text-3xl opacity-50"><ChatLineRound /></el-icon>
          <div class="text-xs font-bold text-stone-500">暂无研讨片段</div>
          <p class="text-[10px] opacity-70">在正文划线向角色提问，成功获取答复后自动录入片段。</p>
        </div>
        <div v-else class="max-h-[380px] overflow-y-auto space-y-3 pr-1">
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
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<style scoped>
.stats-tabs-card {
  --el-tabs-header-bg-color: transparent !important;
  background: transparent !important;
}
</style>
