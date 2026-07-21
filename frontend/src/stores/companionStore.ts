import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { companions } from '@/config/companions'
import { companionRepo } from '@/repositories/companionRepository'
import type { Companion } from '@/repositories/types'

export const useCompanionStore = defineStore('companion', () => {
  // 内置角色中的第一个作为默认回退角色
  const DEFAULT_COMPANION_ID = companions[0]?.id || 'luchen'

  const currentCompanionId = ref<string>(
    localStorage.getItem('coread_companion_id') || DEFAULT_COMPANION_ID
  )

  const customCompanions = ref<Companion[]>([])
  const isLoaded = ref(false)

  // 异步加载自定义人设
  async function loadCustom() {
    isLoaded.value = false
    const list = await companionRepo.getAll()
    customCompanions.value = list || []
    isLoaded.value = true

    // 加载完成后，如果本地缓存的角色ID在合并后的列表中不存在，则回退到内置默认
    if (!allCompanions.value.some((c) => c.id === currentCompanionId.value)) {
      currentCompanionId.value = DEFAULT_COMPANION_ID
    }
  }

  // 顶层异步载入
  loadCustom()

  // 聚合内置人设与本地自定义人设
  const allCompanions = computed(() => {
    return [...companions, ...customCompanions.value]
  })

  const currentCompanion = computed(() => {
    return allCompanions.value.find((c) => c.id === currentCompanionId.value) || allCompanions.value[0]
  })

  function setCompanion(id: string) {
    if (allCompanions.value.some((c) => c.id === id)) {
      currentCompanionId.value = id
      localStorage.setItem('coread_companion_id', id)
    }
  }

  async function addCustomCompanion(c: Companion) {
    // 检测与内置角色 ID 冲突
    if (companions.some(x => x.id === c.id)) {
      throw new Error(`角色 ID "${c.id}" 与内置角色冲突，请使用其他 ID。`)
    }

    const isEditing = customCompanions.value.some(x => x.id === c.id)
    if (!isEditing && customCompanions.value.length >= 5) {
      throw new Error('自定义伴侣数量已达 5 个上限。')
    }

    const idx = customCompanions.value.findIndex(x => x.id === c.id)
    if (idx > -1) {
      customCompanions.value[idx] = c
    } else {
      customCompanions.value.push(c)
    }
    await companionRepo.save(c)
  }

  async function deleteCustomCompanion(id: string) {
    customCompanions.value = customCompanions.value.filter(x => x.id !== id)
    await companionRepo.delete(id)

    if (currentCompanionId.value === id) {
      setCompanion(DEFAULT_COMPANION_ID)
    }
  }

  return {
    companions,
    customCompanions,
    allCompanions,
    currentCompanionId,
    currentCompanion,
    setCompanion,
    loadCustom,
    addCustomCompanion,
    deleteCustomCompanion,
    isLoaded,
  }
})
