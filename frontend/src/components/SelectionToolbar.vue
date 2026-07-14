<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCompanionStore } from '@/stores/companionStore'

const props = defineProps<{
  selectedText: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'submit', data: { text: string; question: string }): void
}>()

const companionStore = useCompanionStore()
const isAsking = ref(false)
const question = ref('')

// 每次选中文本更新时，自动重置输入状态
watch(
  () => props.selectedText,
  () => {
    isAsking.value = false
    question.value = ''
  }
)

function sendQuestion() {
  emit('submit', {
    text: props.selectedText,
    question: question.value.trim(),
  })
  isAsking.value = false
  question.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="selectedText"
      class="absolute z-50 -translate-x-1/2 -translate-y-full mt-[-10px] transition-all duration-300"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <!-- 状态一：胶囊气泡按钮 -->
      <div
        v-if="!isAsking"
        class="bg-white border border-stone-200 shadow-md rounded-full px-4 py-2 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center"
        @click="isAsking = true"
      >
        <span class="text-xs font-semibold theme-text-primary">
          问问{{ companionStore.currentCompanion.name }}
        </span>
      </div>

      <!-- 状态二：就地变形微型输入框 -->
      <div
        v-else
        class="bg-white border border-stone-200 shadow-xl rounded-2xl p-3 flex flex-col gap-2 w-72 transition-all"
        @click.stop
      >
        <div class="text-[10px] text-stone-400 font-sans truncate select-none">
          引用: “{{ selectedText }}”
        </div>
        <div class="flex gap-1.5 items-center">
          <input
            v-model="question"
            type="text"
            ref="inputRef"
            :placeholder="`向 ${companionStore.currentCompanion.name} 提问...`"
            class="flex-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] bg-stone-50 text-stone-800"
            @keyup.enter="sendQuestion"
            v-focus
          />
          <button
            @click="sendQuestion"
            class="rounded-lg theme-bg-primary px-3 py-1.5 text-xs font-semibold text-white theme-bg-primary-hover shadow-sm cursor-pointer shrink-0"
          >
            {{ question.trim() ? '发送' : '引用' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
// 自定义指令：自动聚焦
const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus()
}
</script>
