<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  type: 'bookmark' | 'highlight' | 'note' | 'aifragment'
  title: string
  subtitle?: string
  quote?: string
  content?: string
  aiMessage?: string
  aiName?: string
  time: string
}>()

const emit = defineEmits<{
  (e: 'navigate'): void
  (e: 'delete'): void
}>()

const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div 
    class="p-4 bg-stone-500/5 hover:bg-stone-500/10 border theme-border rounded-2xl transition-all duration-300 flex items-start justify-between gap-4 group relative overflow-hidden"
  >
    <div class="min-w-0 flex-1 space-y-1">
      <!-- 头部：类型标识/位置 & 时间 -->
      <div class="flex items-center justify-between text-[10px] text-stone-400">
        <div class="flex items-center gap-1.5 font-bold text-[var(--color-primary)]">
          <!-- 动态呈现类型小图标 -->
          <el-icon v-if="type === 'bookmark'"><Bookmark /></el-icon>
          <el-icon v-else-if="type === 'highlight'"><EditPen /></el-icon>
          <el-icon v-else-if="type === 'note'"><Document /></el-icon>
          <el-icon v-else-if="type === 'aifragment'"><ChatLineRound /></el-icon>
          
          <span>{{ title }}</span>
          <span v-if="subtitle" class="opacity-60 font-normal">· {{ subtitle }}</span>
        </div>
        <span class="opacity-70">{{ new Date(time).toLocaleString() }}</span>
      </div>

      <!-- 划线原文引用 -->
      <div 
        v-if="quote" 
        class="mt-2 pl-2.5 border-l-2 border-[var(--color-primary)] text-xs text-[var(--color-read-text)] italic bg-black/5 p-1.5 rounded truncate"
      >
        “{{ quote }}”
      </div>

      <!-- 随感/想法主体 (支持超长文本 3 行收缩折叠) -->
      <div v-if="content" class="mt-2 text-xs text-[var(--color-read-text)] leading-relaxed bg-stone-500/5 p-2.5 rounded-xl">
        <strong class="text-[9px] opacity-60 block mb-0.5">我的想法:</strong>
        <p :class="[isExpanded ? '' : 'line-clamp-3']" class="whitespace-pre-line">{{ content }}</p>
        <button 
          v-if="content.length > 90" 
          @click="toggleExpand" 
          class="text-[10px] text-[var(--color-primary)] font-bold mt-1 cursor-pointer block hover:underline"
        >
          {{ isExpanded ? '收起' : '展开全文' }}
        </button>
      </div>

      <!-- AI 研讨问答 (同样支持折叠) -->
      <div v-if="aiMessage && type === 'aifragment'" class="mt-2.5 space-y-2">
        <div class="text-xs text-[var(--color-read-text)] bg-[var(--color-bg-bubble-user)]/30 p-2.5 rounded-xl">
          <span class="font-bold text-[var(--color-text-bubble-user)] text-[9px] block mb-0.5">提问：</span>
          <p :class="[isExpanded ? '' : 'line-clamp-2']" class="whitespace-pre-line">{{ content }}</p>
        </div>
        <div class="text-xs text-[var(--color-read-text)] bg-[var(--color-bg-bubble-ai)]/30 border theme-border p-2.5 rounded-xl">
          <span class="font-bold text-[var(--color-text-bubble-ai)] text-[9px] block mb-0.5">{{ aiName || 'AI' }} 回复：</span>
          <p :class="[isExpanded ? '' : 'line-clamp-3']" class="whitespace-pre-line">{{ aiMessage }}</p>
        </div>
        <button 
          v-if="(content?.length || 0) + aiMessage.length > 120" 
          @click="toggleExpand" 
          class="text-[10px] text-[var(--color-primary)] font-bold mt-1 cursor-pointer block hover:underline"
        >
          {{ isExpanded ? '收起' : '展开研讨详情' }}
        </button>
      </div>
    </div>

    <!-- 侧栏操作区 -->
    <div class="flex items-center gap-1 shrink-0 self-center">
      <!-- 定位按钮：自定义样式替代 el-button -->
      <button
        @click="emit('navigate')"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all duration-200 border bg-[var(--color-primary)]/5 text-[var(--color-primary)] border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30 active:scale-95"
        title="定位到原文位置"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
          <path d="M2 12h20"/>
        </svg>
        <span>定位</span>
      </button>
      
      <el-popconfirm
        title="确认删除该记录吗？"
        confirm-button-text="确定"
        cancel-button-text="取消"
        @confirm="emit('delete')"
      >
        <template #reference>
          <el-button
            size="small"
            type="danger"
            plain
            icon="Delete"
            circle
            class="transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100"
            title="删除记录"
          />
        </template>
      </el-popconfirm>
    </div>
  </div>
</template>
