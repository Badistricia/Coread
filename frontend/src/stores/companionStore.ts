import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { companions } from '@/config/companions'

export interface Companion {
  id: string
  name: string
  title: string
  description: string
  personality: string
  themeClass: string
  accentStart: string
  accentEnd: string
}

export const useCompanionStore = defineStore('companion', () => {
  const currentCompanionId: Ref<string> = ref(
    localStorage.getItem('coread_companion_id') || 'luchen'
  )

  const currentCompanion = computed(() => {
    return companions.find((c) => c.id === currentCompanionId.value) || companions[0]
  })

  function setCompanion(id: string) {
    if (companions.some((c) => c.id === id)) {
      currentCompanionId.value = id
      localStorage.setItem('coread_companion_id', id)
    }
  }

  return {
    companions,
    currentCompanionId,
    currentCompanion,
    setCompanion,
  }
})
