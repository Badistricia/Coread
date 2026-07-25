<script setup lang="ts">
import { useCompanionStore } from '@/stores/companionStore'
import { useReaderStore } from '@/stores/readerStore'
import AppDialogHost from '@/components/AppDialogHost.vue'

const companionStore = useCompanionStore()
const readerStore = useReaderStore()
</script>

<template>
  <div :class="[companionStore.currentCompanion.themeClass, readerStore.themeStyle]" class="h-screen overflow-hidden font-sans theme-bg-app theme-text-app transition-colors duration-500">
    <router-view />
    <AppDialogHost />
  </div>
</template>
