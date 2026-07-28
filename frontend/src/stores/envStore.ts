import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'coread_custom_env_config'

export interface CustomEnvConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export const useEnvStore = defineStore('env', () => {
  const apiKey = ref('')
  const baseUrl = ref('')
  const model = ref('')

  // 初始化从 localStorage 加载配置
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const parsed: CustomEnvConfig = JSON.parse(cached)
      apiKey.value = parsed.apiKey || ''
      baseUrl.value = parsed.baseUrl || ''
      model.value = parsed.model || ''
    }
  } catch (err) {
    console.error('加载本地 ENV 配置失败:', err)
  }

  // 监听变动并保存至 localStorage
  watch(
    [apiKey, baseUrl, model],
    () => {
      try {
        const payload: CustomEnvConfig = {
          apiKey: apiKey.value,
          baseUrl: baseUrl.value,
          model: model.value,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch (err) {
        console.error('保存 ENV 配置失败:', err)
      }
    },
    { deep: true }
  )

  function setConfig(newApiKey: string, newBaseUrl: string, newModel: string) {
    apiKey.value = newApiKey.trim()
    baseUrl.value = newBaseUrl.trim()
    model.value = newModel.trim()
  }

  function resetConfig() {
    apiKey.value = ''
    baseUrl.value = ''
    model.value = ''
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    apiKey,
    baseUrl,
    model,
    setConfig,
    resetConfig,
  }
})
