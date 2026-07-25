<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useUiStore } from '@/stores/uiStore'

const uiStore = useUiStore()
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => uiStore.dialog,
  (dialog) => {
    inputValue.value = dialog?.inputValue || ''
    if (dialog?.type === 'prompt') {
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  }
)

function confirm() {
  if (!uiStore.dialog) return
  if (uiStore.dialog.type === 'prompt') {
    const value = inputValue.value.trim()
    if (!value) return
    uiStore.close(value)
    return
  }
  uiStore.close(true)
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="uiStore.dialog" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-stone-950/45 backdrop-blur-sm" @click="uiStore.close(null)"></div>
      <div class="relative w-full max-w-[420px] rounded-2xl border theme-border bg-[var(--color-read-bg)]/95 backdrop-blur-md shadow-2xl overflow-hidden">
        <header class="px-5 py-4 border-b theme-border bg-stone-500/5">
          <h3 class="text-sm font-bold text-[var(--color-read-title)]">{{ uiStore.dialog.title }}</h3>
          <p class="text-xs text-[var(--color-read-text)] opacity-70 leading-relaxed mt-2">
            {{ uiStore.dialog.message }}
          </p>
        </header>

        <div v-if="uiStore.dialog.type === 'prompt'" class="px-5 pt-4">
          <input
            ref="inputRef"
            v-model="inputValue"
            class="w-full rounded-xl border theme-border bg-stone-500/5 px-3 py-2 text-sm text-[var(--color-read-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 focus:border-[var(--color-primary)]/40"
            :placeholder="uiStore.dialog.inputPlaceholder || ''"
            @keydown.enter.prevent="confirm"
            @keydown.escape.prevent="uiStore.close(null)"
          />
        </div>

        <footer class="px-5 py-4 flex justify-end gap-2">
          <button
            class="px-4 py-2 rounded-xl border theme-border bg-transparent text-xs font-bold text-stone-500 hover:bg-stone-500/10 transition-colors"
            @click="uiStore.close(null)"
          >
            {{ uiStore.dialog.cancelText || '取消' }}
          </button>
          <button
            class="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            :class="uiStore.dialog.danger ? 'bg-red-500 hover:bg-red-600' : 'theme-bg-primary theme-bg-primary-hover'"
            @click="confirm"
          >
            {{ uiStore.dialog.confirmText || '确定' }}
          </button>
        </footer>
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
