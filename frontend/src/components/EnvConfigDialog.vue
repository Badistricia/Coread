<template>
  <Transition name="modal-fade">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-stone-900/45" @click.self="handleClose"></div>
      <div class="relative w-full max-w-[480px] rounded-2xl border theme-border bg-[var(--color-read-bg)]/95 shadow-2xl overflow-hidden flex flex-col">
        <!-- 头部标题 -->
        <header class="px-5 py-4 border-b theme-border bg-stone-500/5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Setting class="w-4 h-4 text-stone-500" />
            <h3 class="text-sm font-bold text-[var(--color-read-title)]">API 环境变量设置</h3>
          </div>
          <button
            class="w-7 h-7 rounded-full hover:bg-stone-500/10 text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center"
            @click="handleClose"
            title="关闭"
          >
            <Close class="w-3.5 h-3.5" />
          </button>
        </header>

        <div class="p-5 flex flex-col gap-4">
          <!-- 提示信息 -->
          <div class="bg-blue-500/10 border-l-2 border-blue-500 px-3 py-2.5 rounded text-xs leading-relaxed text-[var(--color-read-text)]">
            <div class="font-bold mb-1 flex items-center gap-1">
              <InfoFilled class="w-3.5 h-3.5 text-blue-500" />
              优先级说明
            </div>
            在此配置的 API 参数保存在<strong>浏览器本地</strong>，优先级高于后端 <code class="bg-black/5 px-1 rounded text-stone-500">.env</code> 文件。未填写的项将自动回退使用后端默认配置。
          </div>

          <!-- 表单区域 -->
          <div class="flex flex-col gap-3.5">
            <!-- API Key 输入框 -->
            <div class="flex flex-col gap-1.5">
              <label class="flex items-center justify-between text-xs font-bold text-[var(--color-read-text)]">
                <span>LLM API Key</span>
                <span class="text-[10px] font-normal text-stone-400 bg-stone-500/10 px-1.5 py-0.5 rounded">密钥</span>
              </label>
              <div class="relative flex items-center">
                <input
                  :type="showKey ? 'text' : 'password'"
                  v-model="form.apiKey"
                  placeholder="留空则使用后端 .env 的 LLM_API_KEY"
                  class="w-full px-3 py-2 text-sm border theme-border rounded-lg outline-none bg-[var(--color-read-bg)] text-[var(--color-read-text)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all pr-9"
                />
                <button
                  type="button"
                  class="absolute right-2 text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center"
                  @click="showKey = !showKey"
                  :title="showKey ? '隐藏' : '显示'"
                >
                  <Hide v-if="!showKey" class="w-4 h-4" />
                  <View v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Base URL 输入框 -->
            <div class="flex flex-col gap-1.5">
              <label class="flex items-center justify-between text-xs font-bold text-[var(--color-read-text)]">
                <span>API Base URL</span>
                <span class="text-[10px] font-normal text-stone-400 bg-stone-500/10 px-1.5 py-0.5 rounded">接口地址</span>
              </label>
              <input
                type="text"
                v-model="form.baseUrl"
                placeholder="例如 https://dashscope.aliyuncs.com/compatible-mode/v1"
                class="w-full px-3 py-2 text-sm border theme-border rounded-lg outline-none bg-[var(--color-read-bg)] text-[var(--color-read-text)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            <!-- Model 名称输入框 -->
            <div class="flex flex-col gap-1.5">
              <label class="flex items-center justify-between text-xs font-bold text-[var(--color-read-text)]">
                <span>LLM Model 名称</span>
                <span class="text-[10px] font-normal text-stone-400 bg-stone-500/10 px-1.5 py-0.5 rounded">模型</span>
              </label>
              <input
                type="text"
                v-model="form.model"
                placeholder="例如 qwen-plus, gpt-4o 等"
                class="w-full px-3 py-2 text-sm border theme-border rounded-lg outline-none bg-[var(--color-read-bg)] text-[var(--color-read-text)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>
          </div>

          <!-- 测试结果提示 -->
          <Transition name="fade">
            <div
              v-if="testResult.status"
              class="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs leading-relaxed border"
              :class="testResult.status === 'success' ? 'bg-green-500/10 text-green-700 border-green-500/20' : 'bg-red-500/10 text-red-700 border-red-500/20'"
            >
              <Check v-if="testResult.status === 'success'" class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <Warning v-else class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{{ testResult.message }}</span>
            </div>
          </Transition>

          <!-- 底部按钮操作区 -->
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-bold border theme-border bg-stone-100/50 text-[var(--color-read-text)] hover:bg-stone-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                :disabled="isTesting"
                @click="handleTestConnection"
              >
                <Loading v-if="isTesting" class="w-3.5 h-3.5 animate-spin" />
                <Connection v-else class="w-3.5 h-3.5 text-stone-500" />
                <span>{{ isTesting ? '测试中...' : '测试连接' }}</span>
              </button>
              <button
                type="button"
                class="px-2 py-1.5 rounded text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                @click="handleReset"
                title="清空浏览器端设置，恢复使用后端 .env"
              >
                重置
              </button>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-bold border theme-border bg-stone-100/50 text-[var(--color-read-text)] hover:bg-stone-200/50 transition-colors"
                @click="handleClose"
              >
                取消
              </button>
              <button
                type="button"
                class="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                @click="handleSave"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useEnvStore } from '@/stores/envStore'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const envStore = useEnvStore()

const showKey = ref(false)
const isTesting = ref(false)

const form = ref({
  apiKey: '',
  baseUrl: '',
  model: '',
})

const testResult = ref<{
  status: 'success' | 'error' | null
  message: string
}>({
  status: null,
  message: '',
})

// 当弹窗打开时回显 store 中的配置
watch(
  () => props.visible,
  (val) => {
    if (val) {
      form.value.apiKey = envStore.apiKey
      form.value.baseUrl = envStore.baseUrl
      form.value.model = envStore.model
      testResult.value = { status: null, message: '' }
      showKey.value = false
    }
  }
)

function handleClose() {
  emit('update:visible', false)
}

function handleReset() {
  form.value.apiKey = ''
  form.value.baseUrl = ''
  form.value.model = ''
  envStore.resetConfig()
  testResult.value = {
    status: 'success',
    message: '已恢复使用后端 .env 默认配置',
  }
}

function handleSave() {
  envStore.setConfig(form.value.apiKey, form.value.baseUrl, form.value.model)
  emit('update:visible', false)
}

async function handleTestConnection() {
  if (isTesting.value) return
  isTesting.value = true
  testResult.value = { status: null, message: '' }

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/test-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: form.value.apiKey || undefined,
        base_url: form.value.baseUrl || undefined,
        model: form.value.model || undefined,
      }),
    })

    if (!res.ok) {
      throw new Error(`HTTP 错误: status ${res.status}`)
    }

    const data = await res.json()
    if (data.success) {
      testResult.value = {
        status: 'success',
        message: data.message || '连接测试成功！',
      }
    } else {
      testResult.value = {
        status: 'error',
        message: data.message || '连接失败，请检查 API Key 与地址。',
      }
    }
  } catch (err: any) {
    testResult.value = {
      status: 'error',
      message: `网络测试失败: ${err.message || '无法连接后端服务'}`,
    }
  } finally {
    isTesting.value = false
  }
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
