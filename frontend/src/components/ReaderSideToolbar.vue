<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useReaderStore } from '@/stores/readerStore'
import { useCompanionStore } from '@/stores/companionStore'

const props = defineProps<{
  showChatDrawer: boolean
}>()

const emit = defineEmits<{
  (e: 'update:showChatDrawer', val: boolean): void
  (e: 'toggleDirectory'): void
  (e: 'openStats'): void
}>()

const router = useRouter()
const readerStore = useReaderStore()
const companionStore = useCompanionStore()

// 专属主题渐变色样式
const exclusiveThemeStyle = computed(() => {
  const { accentStart, accentEnd } = companionStore.currentCompanion
  return { background: `linear-gradient(135deg, ${accentStart}, ${accentEnd})` }
})

const exclusiveThemeTitle = computed(() => {
  if (companionStore.currentCompanion.isCustom) return '自定义角色专属主题'
  const titles: Record<string, string> = {
    luchen: '陆沉专属 · 幻惑之瞳',
    xiaoyi: '萧逸专属 · 极速之耀',
    qisili: '齐司礼专属 · 昙花之息',
    chalisu: '查理苏专属 · 真空之耀',
    xiamingxing: '夏鸣星专属 · 璨若骄阳',
  }
  return titles[companionStore.currentCompanionId] || '角色专属主题'
})

// 循环调节行间距 1.4 -> 1.6 -> 1.8 -> 2.0 -> 2.2 -> 1.4
function cycleLineHeight() {
  const current = readerStore.lineHeight
  let next = 1.6
  if (current === 1.4) next = 1.6
  else if (current === 1.6) next = 1.8
  else if (current === 1.8) next = 2.0
  else if (current === 2.0) next = 2.2
  else next = 1.4
  readerStore.setLineHeight(next)
}
</script>

<template>
  <div class="h-full py-6 flex flex-col justify-between shrink-0 select-none">
    <!-- 【第一段：核心导航】 -->
    <div class="flex flex-col gap-2.5 items-center">
      <!-- 目录圆钮 -->
      <button
        @click="emit('toggleDirectory')"
        title="查看目录"
        aria-label="查看章节目录"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        <Fold class="w-4.5 h-4.5 text-stone-600" />
      </button>
      
      <!-- 聊天抽屉折叠圆钮 -->
      <button
        @click="emit('update:showChatDrawer', !showChatDrawer)"
        :title="showChatDrawer ? '收起聊天栏' : '展开聊天栏'"
        aria-label="展开或收起AI伴侣侧栏"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
        :class="{ 'theme-bg-primary-light text-[var(--color-primary)]': showChatDrawer }"
      >
        <ChatDotRound class="w-4.5 h-4.5" />
      </button>
    </div>

    <hr class="theme-border opacity-50 w-6 mx-auto" />

    <!-- 【第二段：功能工具】 -->
    <div class="flex flex-col gap-2.5 items-center">
      <!-- 统计弹窗按钮 -->
      <button
        @click="emit('openStats')"
        title="查看统计与书签笔记"
        aria-label="打开阅读高亮书签看板"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        <Notebook class="w-4.5 h-4.5 text-stone-600" />
      </button>

      <!-- 我的伴侣管理页面入口 -->
      <button
        @click="router.push('/companions')"
        title="我的角色"
        aria-label="进入伴侣管理库"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        <User class="w-4.5 h-4.5 text-stone-600" />
      </button>
    </div>

    <hr class="theme-border opacity-50 w-6 mx-auto" />

    <!-- 【第三段：阅读排版设置（平铺恢复）】 -->
    <div class="flex flex-col gap-2.5 items-center">
      <!-- 单双页切换 -->
      <button
        @click="readerStore.setDoublePage(!readerStore.isDoublePage)"
        :title="readerStore.isDoublePage ? '切换为单页' : '切换为双页'"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        <span class="text-[10px] font-bold leading-none">{{ readerStore.isDoublePage ? '双页' : '单页' }}</span>
      </button>

      <!-- 循环调节行高 -->
      <button
        @click="cycleLineHeight"
        :title="`行距: ${readerStore.lineHeight.toFixed(1)} (点击切换)`"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        <span class="text-[10px] font-bold leading-none">L:{{ readerStore.lineHeight.toFixed(1) }}</span>
      </button>

      <!-- 字号调节 -->
      <button
        @click="readerStore.changeFontSize(1)"
        title="放大字号"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        A+
      </button>
      
      <button
        @click="readerStore.changeFontSize(-1)"
        title="缩小字号"
        class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-stone-500/10 text-[10px] font-bold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
      >
        A-
      </button>

      <!-- 主题色 5 色点垂直平铺 -->
      <div class="flex flex-col gap-2 mt-1.5 items-center">
        <button
          @click="readerStore.setThemeStyle('read-theme-a')"
          class="w-5.5 h-5.5 rounded-full border border-[#ebdcb9] bg-[#fdfaf4] cursor-pointer hover:scale-110 transition-transform"
          :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-a' }"
          title="暖金书卷"
        ></button>
        <button
          @click="readerStore.setThemeStyle('read-theme-b')"
          class="w-5.5 h-5.5 rounded-full border border-[#e4e4e7] bg-[#ffffff] cursor-pointer hover:scale-110 transition-transform"
          :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-b' }"
          title="冷灰极简"
        ></button>
        <button
          @click="readerStore.setThemeStyle('read-theme-c')"
          class="w-5.5 h-5.5 rounded-full border border-[#eedecf] bg-[#fbf8f3] cursor-pointer hover:scale-110 transition-transform"
          :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-c' }"
          title="奶茶温柔"
        ></button>
        <button
          @click="readerStore.setThemeStyle('read-theme-dark')"
          class="w-5.5 h-5.5 rounded-full border border-zinc-700 bg-[#1c1c1e] cursor-pointer hover:scale-110 transition-transform"
          :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-dark' }"
          title="夜间暗黑"
        ></button>
        <button
          @click="readerStore.setThemeStyle('read-theme-exclusive')"
          class="w-5.5 h-5.5 rounded-full border border-stone-300 cursor-pointer hover:scale-110 transition-transform shadow-xs"
          :style="exclusiveThemeStyle"
          :class="{ 'ring-2 ring-offset-1 ring-[var(--color-primary)]': readerStore.themeStyle === 'read-theme-exclusive' }"
          :title="exclusiveThemeTitle"
        ></button>
      </div>
    </div>
  </div>
</template>
