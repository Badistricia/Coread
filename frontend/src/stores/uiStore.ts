import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DialogRequest {
  id: string
  type: 'confirm' | 'prompt'
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  inputValue?: string
  inputPlaceholder?: string
  resolve: (value: boolean | string | null) => void
}

export const useUiStore = defineStore('ui', () => {
  const dialog = ref<DialogRequest | null>(null)

  function confirm(options: Omit<DialogRequest, 'id' | 'type' | 'resolve'>) {
    return new Promise<boolean>((resolve) => {
      dialog.value = {
        ...options,
        id: `dialog_${Date.now()}`,
        type: 'confirm',
        resolve: (value) => resolve(value === true),
      }
    })
  }

  function prompt(options: Omit<DialogRequest, 'id' | 'type' | 'resolve'>) {
    return new Promise<string | null>((resolve) => {
      dialog.value = {
        ...options,
        id: `dialog_${Date.now()}`,
        type: 'prompt',
        resolve: (value) => resolve(typeof value === 'string' ? value : null),
      }
    })
  }

  function close(value: boolean | string | null) {
    const current = dialog.value
    dialog.value = null
    current?.resolve(value)
  }

  return {
    dialog,
    confirm,
    prompt,
    close,
  }
})
