<script setup lang="ts">
defineProps<{
  isBookmarked: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <!-- 下落式书签触发区 -->
  <div
    class="absolute top-0 right-12 w-10 h-16 cursor-pointer group z-20"
    @click="emit('toggle')"
    :title="isBookmarked ? '取消书签' : '加入书签'"
  >
    <div
      class="w-6 h-14 mx-auto transition-all duration-300 flex items-center justify-center transform"
      :class="[
        isBookmarked
          ? 'translate-y-0 text-[var(--color-primary)]'
          : '-translate-y-8 opacity-20 group-hover:translate-y-0 group-hover:opacity-100 text-stone-400'
      ]"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-14" viewBox="0 0 24 36" fill="currentColor">
        <path d="M5 2h14a2 2 0 0 1 2 2v30l-9-6-9 6V4a2 2 0 0 1 2-2z" />
      </svg>
    </div>
  </div>
</template>
