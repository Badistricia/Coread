<script setup lang="ts">
import { computed } from 'vue'
import { useCompanionStore } from '@/stores/companionStore'
import { ElMessageBox } from 'element-plus'

interface Session {
  id: string
  name: string
  messages: any[]
}

const props = defineProps<{
  sessions: Session[]
  currentSessionId: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
  (e: 'rename', id: string): void
  (e: 'clear', id: string): void
}>()

const companionStore = useCompanionStore()

const currentSession = computed(() => {
  return props.sessions.find(s => s.id === props.currentSessionId) || props.sessions[0]
})

// ── 新建会话 ──
function handleCreate() {
  emit('create')
}

// ── 重命名会话 ──
function handleRename() {
  if (!currentSession.value) return
  ElMessageBox.prompt('请输入会话新名称', '重命名会话', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: currentSession.value.name,
    inputPattern: /\S+/,
    inputErrorMessage: '会话名不能为空'
  }).then(({ value }) => {
    emit('rename', value.trim())
  }).catch(() => {})
}

// ── 清空会话内容 ──
function handleClear() {
  if (!currentSession.value) return
  ElMessageBox.confirm(
    '确认清空当前会话的所有对话历史吗？此操作不可撤销。',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    emit('clear', currentSession.value.id)
  }).catch(() => {})
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 border-b theme-border bg-stone-500/5 select-none shrink-0 w-full">
    <!-- 伴侣头像与身份标题 -->
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <div 
        class="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-inner shrink-0"
        :style="{ background: `linear-gradient(135deg, ${companionStore.currentCompanion.accentStart}, ${companionStore.currentCompanion.accentEnd})` }"
      >
        {{ companionStore.currentCompanion.name[0] }}
      </div>
      <div class="min-w-0">
        <h4 class="text-xs font-bold theme-text-app truncate">{{ companionStore.currentCompanion.name }}</h4>
        <p class="text-[9px] text-stone-400 truncate mt-0.5">{{ companionStore.currentCompanion.title }}</p>
      </div>
    </div>

    <!-- 会话管理下拉选单 -->
    <el-dropdown trigger="click" @command="(cmd: string) => {
      if (cmd === 'create') handleCreate()
      else if (cmd === 'rename') handleRename()
      else if (cmd === 'clear') handleClear()
      else emit('select', cmd)
    }">
      <button class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border theme-border bg-stone-500/5 hover:bg-stone-500/10 transition-all text-xs font-medium cursor-pointer max-w-[150px] shrink-0">
        <span class="theme-text-app truncate">{{ currentSession?.name || '默认会话' }}</span>
        <el-icon class="text-stone-400 shrink-0"><ArrowDown /></el-icon>
      </button>
      
      <template #dropdown>
        <el-dropdown-menu class="!p-1.5 w-56">
          <div class="text-[10px] font-bold text-stone-400 px-2 py-1 select-none">最近会话</div>
          
          <!-- 会话列表 -->
          <el-dropdown-item 
            v-for="s in sessions" 
            :key="s.id" 
            :command="s.id"
            :class="{ 'theme-bg-primary-light !text-[var(--color-primary)] font-semibold': s.id === currentSessionId }"
          >
            <div class="flex items-center justify-between w-full text-xs">
              <span class="truncate pr-4" :title="s.name">{{ s.name }}</span>
              <span class="text-[9px] text-stone-400 shrink-0 font-normal">
                {{ s.messages.filter(m => !m.isStreaming).length }} 聊
              </span>
            </div>
          </el-dropdown-item>
          
          <!-- 操控功能项 -->
          <el-dropdown-item divided command="create">
            <div class="flex items-center gap-1.5 text-xs text-[var(--color-primary)] font-medium py-0.5">
              <el-icon><Plus /></el-icon>
              <span>新建会话</span>
            </div>
          </el-dropdown-item>
          
          <el-dropdown-item command="rename">
            <div class="flex items-center gap-1.5 text-xs text-stone-600 font-medium py-0.5">
              <el-icon><Edit /></el-icon>
              <span>重命名会话</span>
            </div>
          </el-dropdown-item>
          
          <el-dropdown-item command="clear" class="!text-red-500 hover:!bg-red-50">
            <div class="flex items-center gap-1.5 text-xs font-medium py-0.5">
              <el-icon><Delete /></el-icon>
              <span>清空当前会话</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
