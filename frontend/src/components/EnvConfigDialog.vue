<template>
  <Transition name="fade-scale">
    <div v-if="visible" class="env-dialog-overlay" @click.self="handleClose">
      <div class="env-dialog-card">
        <!-- 头部标题 -->
        <div class="env-dialog-header">
          <div class="header-title">
            <span class="icon">⚙️</span>
            <span>API 环境变量设置</span>
          </div>
          <button class="close-btn" @click="handleClose" title="关闭">&times;</button>
        </div>

        <!-- 提示信息 -->
        <div class="env-tips">
          <p>💡 <strong>优先级说明</strong>：在此配置的 API 参数保存在<strong>浏览器本地</strong>，优先级高于后端 <code>.env</code> 文件。未填写的项将自动回退使用后端默认配置。</p>
        </div>

        <!-- 表单区域 -->
        <div class="env-form">
          <!-- API Key 输入框 -->
          <div class="form-item">
            <label class="form-label">
              <span>LLM API Key</span>
              <span class="tag-badge">密钥</span>
            </label>
            <div class="input-wrapper">
              <input
                :type="showKey ? 'text' : 'password'"
                v-model="form.apiKey"
                placeholder="留空则使用后端 .env 的 LLM_API_KEY"
                class="env-input"
              />
              <button
                type="button"
                class="toggle-eye"
                @click="showKey = !showKey"
                :title="showKey ? '隐藏' : '显示'"
              >
                {{ showKey ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          <!-- Base URL 输入框 -->
          <div class="form-item">
            <label class="form-label">
              <span>API Base URL</span>
              <span class="tag-badge">接口地址</span>
            </label>
            <input
              type="text"
              v-model="form.baseUrl"
              placeholder="例如 https://dashscope.aliyuncs.com/compatible-mode/v1"
              class="env-input"
            />
          </div>

          <!-- Model 名称输入框 -->
          <div class="form-item">
            <label class="form-label">
              <span>LLM Model 名称</span>
              <span class="tag-badge">模型</span>
            </label>
            <input
              type="text"
              v-model="form.model"
              placeholder="例如 qwen-plus, gpt-4o 等"
              class="env-input"
            />
          </div>
        </div>

        <!-- 测试结果提示 -->
        <Transition name="fade">
          <div
            v-if="testResult.status"
            :class="['test-feedback', testResult.status === 'success' ? 'is-success' : 'is-error']"
          >
            <span class="feedback-icon">{{ testResult.status === 'success' ? '✅' : '❌' }}</span>
            <span class="feedback-msg">{{ testResult.message }}</span>
          </div>
        </Transition>

        <!-- 底部按钮操作区 -->
        <div class="env-dialog-footer">
          <div class="left-actions">
            <button
              type="button"
              class="btn-secondary btn-test"
              :disabled="isTesting"
              @click="handleTestConnection"
            >
              <span v-if="isTesting" class="spinner">⏳</span>
              <span v-else>🧪 测试连接</span>
            </button>
            <button
              type="button"
              class="btn-text-danger"
              @click="handleReset"
              title="清空浏览器端设置，恢复使用后端 .env"
            >
              重置
            </button>
          </div>
          <div class="right-actions">
            <button type="button" class="btn-secondary" @click="handleClose">取消</button>
            <button type="button" class="btn-primary" @click="handleSave">确定</button>
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
.env-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.env-dialog-card {
  width: 90%;
  max-width: 480px;
  background: var(--bg-card, #ffffff);
  color: var(--text-color, #2c3e50);
  border-radius: 14px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.2);
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.env-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #888;
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  color: #333;
  background: rgba(0, 0, 0, 0.05);
}

.env-tips {
  background: rgba(64, 158, 255, 0.08);
  border-left: 4px solid var(--theme-color, #409eff);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.45;
}

.env-tips code {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: monospace;
}

.env-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.88rem;
  font-weight: 600;
}

.tag-badge {
  font-size: 0.72rem;
  font-weight: normal;
  color: #888;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.env-input {
  width: 100%;
  padding: 9px 12px;
  font-size: 0.9rem;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: 8px;
  outline: none;
  background: var(--bg-primary, #f9fafb);
  color: inherit;
  transition: border-color 0.2s;
}

.input-wrapper .env-input {
  padding-right: 40px;
}

.env-input:focus {
  border-color: var(--theme-color, #409eff);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.15);
}

.toggle-eye {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px;
}

.test-feedback {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  line-height: 1.4;
}

.test-feedback.is-success {
  background: rgba(103, 194, 58, 0.1);
  color: #277700;
  border: 1px solid rgba(103, 194, 58, 0.2);
}

.test-feedback.is-error {
  background: rgba(245, 108, 108, 0.1);
  color: #c42b2b;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

.env-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;

}

.left-actions,
.right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-primary {
  background: var(--theme-color, #409eff);
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.05);
  color: inherit;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-text-danger {
  background: none;
  border: none;
  color: #f56c6c;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.btn-text-danger:hover {
  background: rgba(245, 108, 108, 0.1);
}

/* 动效 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.25s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
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
