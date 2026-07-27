<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCompanionStore } from '@/stores/companionStore'
import { useUiStore } from '@/stores/uiStore'

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
const uiStore = useUiStore()
const showMenu = ref(false)

function canRenderAvatar(value: unknown) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

const currentSession = computed(() => {
  return props.sessions.find(s => s.id === props.currentSessionId) || props.sessions[0]
})

// ── 新建会话 ──
function handleCreate() {
  emit('create')
}

// ── 重命名会话 ──
async function handleRename() {
  if (!currentSession.value) return
  const value = await uiStore.prompt({
    title: '重命名会话',
    message: '给这段共读对话换一个更好认的名字。',
    inputValue: currentSession.value.name,
    inputPlaceholder: '会话名称',
    confirmText: '保存',
  })
  if (value?.trim()) {
    emit('rename', value.trim())
  }
}

// ── 清空会话内容 ──
async function handleClear() {
  if (!currentSession.value) return
  const ok = await uiStore.confirm({
    title: '清空当前会话',
    message: '确认清空当前会话的所有对话历史吗？此操作不可撤销。',
    confirmText: '清空',
    danger: true,
  })
  if (ok) {
    emit('clear', currentSession.value.id)
  }
}

function selectSession(id: string) {
  emit('select', id)
  showMenu.value = false
}

function runMenuAction(action: 'create' | 'rename' | 'clear') {
  showMenu.value = false
  if (action === 'create') handleCreate()
  if (action === 'rename') handleRename()
  if (action === 'clear') handleClear()
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 border-b theme-border bg-stone-500/5 select-none shrink-0 w-full">
    <!-- 伴侣头像与身份标题 -->
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <div 
        class="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-inner shrink-0 overflow-hidden"
        :style="{ background: `linear-gradient(135deg, ${companionStore.currentCompanion.accentStart}, ${companionStore.currentCompanion.accentEnd})` }"
      >
        <img v-if="canRenderAvatar(companionStore.currentCompanion.avatar)" :src="companionStore.currentCompanion.avatar" :alt="companionStore.currentCompanion.name" class="w-full h-full object-cover" />
        <span v-else>{{ companionStore.currentCompanion.name[0] }}</span>
      </div>
      <div class="min-w-0">
        <h4 class="text-xs font-bold theme-text-app truncate">{{ companionStore.currentCompanion.name }}</h4>
        <p class="text-[9px] text-stone-400 truncate mt-0.5">{{ companionStore.currentCompanion.title }}</p>
      </div>
    </div>

    <!-- 会话管理下拉选单 -->
    <div class="relative" @click.stop>
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border theme-border bg-stone-500/5 hover:bg-stone-500/10 transition-all text-xs font-medium cursor-pointer max-w-[150px] shrink-0"
        @click="showMenu = !showMenu"
      >
        <span class="theme-text-app truncate">{{ currentSession?.name || '默认会话' }}</span>
        <ArrowDown class="w-3 h-3 text-stone-400 shrink-0" />
      </button>

      <Transition name="fade-slide">
        <div
          v-if="showMenu"
          class="absolute right-0 top-full mt-2 w-56 rounded-xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-xl p-1.5 z-50"
        >
          <div class="text-[10px] font-bold text-stone-400 px-2 py-1 select-none">最近会话</div>
          
          <!-- 会话列表 -->
          <button 
            v-for="s in sessions" 
            :key="s.id" 
            class="w-full px-2.5 py-2 rounded-lg text-left transition-colors"
            :class="s.id === currentSessionId ? 'theme-bg-primary-light text-[var(--color-primary)] font-semibold' : 'hover:bg-stone-500/10 theme-text-card'"
            @click="selectSession(s.id)"
          >
            <div class="flex items-center justify-between w-full text-xs">
              <span class="truncate pr-4" :title="s.name">{{ s.name }}</span>
              <span class="text-[9px] text-stone-400 shrink-0 font-normal">
                {{ s.messages.filter(m => !m.isStreaming).length }} 聊
              </span>
            </div>
          </button>
          
          <!-- 操控功能项 -->
          <div class="my-1 h-px bg-stone-500/15"></div>
          <button
            class="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-[var(--color-primary)] font-medium hover:bg-stone-500/10"
            @click="runMenuAction('create')"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>新建会话</span>
          </button>
          
          <button
            class="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-stone-600 font-medium hover:bg-stone-500/10"
            @click="runMenuAction('rename')"
          >
            <Edit class="w-3.5 h-3.5" />
            <span>重命名会话</span>
          </button>
          
          <button
            class="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-red-500 font-medium hover:bg-red-500/10"
            @click="runMenuAction('clear')"
          >
            <Delete class="w-3.5 h-3.5" />
            <span>清空当前会话</span>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
