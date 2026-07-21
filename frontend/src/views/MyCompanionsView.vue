<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompanionStore } from '@/stores/companionStore'
import { useChatStore } from '@/stores/chatStore'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Companion } from '@/repositories/types'

const router = useRouter()
const companionStore = useCompanionStore()
const chatStore = useChatStore()

const showEditDialog = ref(false)
const isEditMode = ref(false)

const companionForm = ref<Companion>({
  id: '',
  name: '',
  title: '',
  description: '',
  personality: '',
  themeClass: 'theme-exclusive-custom',
  accentStart: '#a3b19b',
  accentEnd: '#6b7a66',
  isCustom: true,
  tone: '',
  readingStyle: '',
  midnightStyle: '',
  callToUser: '你',
})

// 经典莫兰迪双色色卡预设
const colorPresets = [
  { name: '沉砂绛红', start: '#8a4b4b', end: '#4c2e2e' },
  { name: '流沙曜金', start: '#d2b48c', end: '#8b7500' },
  { name: '浅黛幽蓝', start: '#778899', end: '#4682b4' },
  { name: '松针冷绿', start: '#a3b19b', end: '#556b2f' },
  { name: '迷雾灰紫', start: '#c0a9bd', end: '#7b68ee' },
]

function selectPresetColor(start: string, end: string) {
  companionForm.value.accentStart = start
  companionForm.value.accentEnd = end
}

function openAddDialog() {
  isEditMode.value = false
  companionForm.value = {
    id: 'custom_' + Date.now(),
    name: '',
    title: '',
    description: '',
    personality: '',
    themeClass: 'theme-exclusive-custom',
    accentStart: '#a3b19b',
    accentEnd: '#6b7a66',
    isCustom: true,
    tone: '',
    readingStyle: '',
    midnightStyle: '',
    callToUser: '你',
  }
  showEditDialog.value = true
}

function openEditDialog(c: Companion) {
  isEditMode.value = true
  companionForm.value = { ...c }
  showEditDialog.value = true
}

async function handleSaveCompanion() {
  const c = companionForm.value
  if (!c.name.trim()) {
    ElMessage.warning('请输入角色名字')
    return
  }
  if (!c.title.trim()) {
    ElMessage.warning('请输入简短身份')
    return
  }

  try {
    await companionStore.addCustomCompanion(c)
    ElMessage.success(isEditMode.value ? '编辑角色成功' : '新增角色成功')
    showEditDialog.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

function selectCompanion(id: string) {
  if (chatStore.isStreaming) {
    ElMessage.warning('角色正在回复中，请等待完成后再切换')
    return
  }
  companionStore.setCompanion(id)
  ElMessage.success('已选用该阅读伴侣')
}

// 复制模板克隆人设
function copyTemplate(template: Companion) {
  isEditMode.value = false
  companionForm.value = {
    ...template,
    id: 'custom_' + Date.now(),
    name: template.name + ' (克隆)',
    isCustom: true,
  }
  showEditDialog.value = true
  ElMessage.info('已载入模板，您可以继续自定义调整')
}

// 更多操作下拉处理
function handleCommand(cmd: string, c: Companion) {
  if (cmd === 'edit') {
    openEditDialog(c)
  } else if (cmd === 'delete') {
    ElMessageBox.confirm(
      `确定删除自定义角色“${c.name}”吗？此操作不可恢复。`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(async () => {
      await companionStore.deleteCustomCompanion(c.id)
      ElMessage.success('删除角色成功')
    }).catch(() => {})
  }
}

// 纯 Vue 自定义下拉菜单控制
const activeDropdownId = ref<string | null>(null)
function closeAllDropdowns() {
  activeDropdownId.value = null
}

onMounted(() => {
  window.addEventListener('click', closeAllDropdowns)
})
onUnmounted(() => {
  window.removeEventListener('click', closeAllDropdowns)
})
</script>

<template>
  <div class="min-h-screen bg-[var(--color-read-bg)] text-[var(--color-read-text)] flex flex-col font-sans transition-colors duration-300">
    <!-- 头部导航 -->
    <header class="px-6 py-4 border-b theme-border flex items-center gap-4 shrink-0 bg-stone-500/5 select-none">
      <button 
        @click="router.back()" 
        class="w-7 h-7 rounded-full border theme-border flex items-center justify-center hover:bg-stone-500/10 active:scale-95 transition-all text-stone-500 hover:text-stone-700 cursor-pointer bg-transparent"
      >
        <el-icon class="!text-xs"><ArrowLeft /></el-icon>
      </button>
      <h1 class="text-base font-bold text-[var(--color-read-title)]">共读角色人设库</h1>
      <span class="text-xs opacity-50">在这里编辑您专属的 AI 伴侣人设，支持最多 5 个自定义角色</span>
    </header>

    <!-- 卡片展示网格 -->
    <main class="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full select-none">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <!-- 伴侣角色卡片 -->
        <div 
          v-for="c in companionStore.allCompanions" 
          :key="c.id"
          class="w-full max-w-[260px] border theme-border rounded-2xl bg-stone-500/5 hover:bg-stone-500/10 transition-all duration-300 relative flex flex-col items-center justify-between pb-4 overflow-hidden group hover:shadow-lg"
          :class="[
            companionStore.currentCompanionId === c.id 
              ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-read-bg)]' 
              : ''
          ]"
        >
          <!-- 渐变氛围横幅 -->
          <div 
            class="w-full h-16 opacity-20 group-hover:opacity-30 transition-opacity duration-300"
            :style="{ background: `linear-gradient(135deg, ${c.accentStart}, ${c.accentEnd})` }"
          ></div>

          <!-- 头像/首字浮在横幅上 -->
          <div 
            class="w-16 h-16 rounded-full text-white flex items-center justify-center text-lg font-bold shadow-md -mt-8 border-2 border-[var(--color-read-bg)]"
            :style="{ background: `linear-gradient(135deg, ${c.accentStart}, ${c.accentEnd})` }"
          >
            {{ c.name[0] }}
          </div>

          <!-- 角色信息 -->
          <div class="px-4 text-center mt-3 flex-1 flex flex-col justify-between w-full">
            <div>
              <div class="flex items-center justify-center gap-1.5">
                <h3 class="font-bold text-sm text-[var(--color-read-title)] truncate max-w-[120px]">{{ c.name }}</h3>
                <span 
                  class="text-[8px] px-1 py-0.5 rounded-full font-semibold shrink-0"
                  :class="c.isCustom ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-stone-500/10 text-stone-400'"
                >
                  {{ c.isCustom ? '自定义' : '内置' }}
                </span>
              </div>
              <p class="text-[10px] text-stone-400 truncate mt-0.5">{{ c.title }}</p>
              
              <!-- 性格标签 -->
              <div class="flex flex-wrap justify-center gap-1 mt-2.5">
                <span 
                  v-for="tag in (c.personality || '温雅').split(/[，, ]+/)" 
                  :key="tag"
                  class="text-[9px] px-1.5 py-0.5 rounded-md bg-stone-500/10 opacity-80"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <!-- 卡片操作 -->
            <div class="mt-4 pt-3 border-t theme-border flex items-center justify-between w-full">
              <button 
                v-if="companionStore.currentCompanionId === c.id"
                class="text-[10px] font-bold text-[var(--color-primary)] flex items-center gap-1 cursor-default bg-transparent border-none"
              >
                ● 正在陪读
              </button>
              <button 
                v-else
                @click="selectCompanion(c.id)"
                class="text-[10px] font-bold text-stone-400 hover:text-[var(--color-primary)] transition-colors cursor-pointer bg-transparent border-none"
              >
                选用伴侣
              </button>

              <!-- 更多设置菜单 (纯 Vue & Tailwind 实现) -->
              <div class="relative">
                <button 
                  @click.stop="activeDropdownId = activeDropdownId === c.id ? null : c.id"
                  class="text-stone-400 hover:text-stone-700 transition-colors p-1 rounded hover:bg-stone-500/10 cursor-pointer bg-transparent border-none"
                >
                  <el-icon class="!text-xs"><MoreFilled /></el-icon>
                </button>
                
                <Transition name="fade-slide">
                  <div 
                    v-if="activeDropdownId === c.id"
                    @click.stop
                    class="absolute right-0 bottom-full mb-2 w-36 bg-[var(--color-read-bg)]/95 backdrop-blur-md border theme-border rounded-xl shadow-lg p-1 z-50 flex flex-col gap-0.5"
                  >
                    <template v-if="c.isCustom">
                      <button 
                        @click="handleCommand('edit', c); activeDropdownId = null"
                        class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-[var(--color-read-text)] hover:bg-stone-500/10 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-none"
                      >
                        <el-icon class="text-stone-400"><Edit /></el-icon>
                        <span>编辑人设</span>
                      </button>
                      <button 
                        @click="handleCommand('delete', c); activeDropdownId = null"
                        class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-red-500 font-semibold hover:bg-red-500/10 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-none"
                      >
                        <el-icon><Delete /></el-icon>
                        <span>删除角色</span>
                      </button>
                    </template>
                    <template v-else>
                      <button 
                        @click="copyTemplate(c); activeDropdownId = null"
                        class="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-none"
                      >
                        <el-icon><CopyDocument /></el-icon>
                        <span>克隆为人设模板</span>
                      </button>
                    </template>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </div>

        <!-- 虚线占位“新建自定义角色”卡片 -->
        <div 
          v-if="companionStore.customCompanions.length < 5"
          @click="openAddDialog"
          class="w-full max-w-[260px] min-h-[220px] border-2 border-dashed theme-border rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-stone-500/5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-300 text-stone-400"
        >
          <el-icon class="text-2xl"><Plus /></el-icon>
          <div class="text-xs font-bold">新建自定义角色</div>
          <p class="text-[9px] opacity-60 text-center px-4">设计你独特的共读人设，最多可拥有 5 个</p>
        </div>
      </div>
    </main>

    <!-- 实时预览卡片与表单 Dialog (纯 Vue & CSS 毛玻璃卡纸风格) -->
    <Transition name="modal-fade">
      <div v-if="showEditDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- 背景毛玻璃遮罩 -->
        <div class="absolute inset-0 bg-stone-900/60 backdrop-blur-md" @click="showEditDialog = false"></div>
        
        <!-- 弹窗主体 -->
        <Transition name="modal-scale">
          <div 
            v-if="showEditDialog"
            class="relative w-full max-w-[820px] bg-[var(--color-read-bg)] border theme-border rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 transition-all duration-300"
            style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);"
          >
            <!-- 头部 -->
            <header class="px-6 py-5 border-b theme-border flex items-center justify-between bg-stone-500/5">
              <h2 class="text-base font-bold text-[var(--color-read-title)]">
                {{ isEditMode ? '编辑伴侣人设' : '新建自定义伴侣' }}
              </h2>
              <button 
                @click="showEditDialog = false"
                class="w-7 h-7 rounded-full flex items-center justify-center hover:bg-stone-500/10 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer bg-transparent border-none"
              >
                <el-icon><Close /></el-icon>
              </button>
            </header>
            
            <!-- 内容区 -->
            <div class="flex-1 overflow-y-auto p-6 flex gap-6 items-start">
              <!-- 左侧：所见即所得实时卡片渲染预览 -->
              <div class="w-64 border theme-border rounded-2xl bg-stone-500/5 p-4 flex flex-col items-center justify-between shadow-inner shrink-0 relative overflow-hidden">
                <div 
                  class="absolute top-0 left-0 right-0 h-12 opacity-20"
                  :style="{ background: `linear-gradient(135deg, ${companionForm.accentStart}, ${companionForm.accentEnd})` }"
                ></div>
                
                <div 
                  class="w-14 h-14 rounded-full text-white flex items-center justify-center text-lg font-bold shadow-md z-10 border border-[var(--color-read-bg)]"
                  :style="{ background: `linear-gradient(135deg, ${companionForm.accentStart}, ${companionForm.accentEnd})` }"
                >
                  {{ companionForm.name ? companionForm.name[0] : '？' }}
                </div>
                
                <div class="text-center mt-3 w-full">
                  <h3 class="font-bold text-sm text-[var(--color-read-title)] truncate">{{ companionForm.name || '角色名字' }}</h3>
                  <p class="text-[10px] text-stone-400 truncate mt-0.5">{{ companionForm.title || '身份名号' }}</p>
                  
                  <div class="flex flex-wrap justify-center gap-1 mt-2">
                    <span 
                      v-for="tag in (companionForm.personality || '人设标签').split(/[，, ]+/)" 
                      :key="tag"
                      class="text-[8px] px-1.5 py-0.5 rounded-md bg-stone-500/15"
                    >
                      {{ tag }}
                    </span>
                  </div>
                  
                  <p class="text-[10px] text-[var(--color-read-text)] opacity-70 mt-3 line-clamp-3 leading-relaxed border-t theme-border pt-2 text-left">
                    {{ companionForm.description || '在这里，您可以为您的伴侣撰写详细的身世背景人设描述。' }}
                  </p>
                </div>
                
                <div 
                  class="w-full h-1 mt-4 rounded-full"
                  :style="{ background: `linear-gradient(90deg, ${companionForm.accentStart}, ${companionForm.accentEnd})` }"
                ></div>
              </div>

              <!-- 右侧：详细配置表单 (完全定制) -->
              <form @submit.prevent class="flex-1 space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-form select-none">
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">角色名字 <span class="text-red-500">*</span></label>
                    <input 
                      v-model="companionForm.name" 
                      placeholder="例: 莫非" 
                      maxlength="15" 
                      class="custom-input"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">角色身份名号 <span class="text-red-500">*</span></label>
                    <input 
                      v-model="companionForm.title" 
                      placeholder="例: 皇家占星术士" 
                      maxlength="30" 
                      class="custom-input"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">如何称呼您 (称呼用户为)</label>
                    <input 
                      v-model="companionForm.callToUser" 
                      placeholder="例: 兔子、夫人、少主" 
                      maxlength="15" 
                      class="custom-input"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">性格标签 (空格或逗号隔开)</label>
                    <input 
                      v-model="companionForm.personality" 
                      placeholder="例: 腹黑, 温雅, 毒舌" 
                      class="custom-input"
                    />
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">人设背景描述</label>
                  <textarea 
                    v-model="companionForm.description" 
                    :rows="2" 
                    placeholder="详细输入角色的背景来历，帮助伴侣更深层次理解对话情境。" 
                    class="custom-textarea text-xs"
                  ></textarea>
                </div>

                <hr class="theme-border opacity-30 my-2" />
                <div class="text-[10px] font-bold text-[var(--color-primary)]">AI 说话语气与共读风格微调 Prompt</div>

                <div class="grid grid-cols-3 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">语气说明说明</label>
                    <textarea 
                      v-model="companionForm.tone" 
                      :rows="2" 
                      placeholder="例: 慵懒低沉，喜欢戏谑" 
                      class="custom-textarea text-xs"
                    ></textarea>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">读书批注风格</label>
                    <textarea 
                      v-model="companionForm.readingStyle" 
                      :rows="2" 
                      placeholder="例: 关注伏笔细节" 
                      class="custom-textarea text-xs"
                    ></textarea>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">深夜问候语气</label>
                    <textarea 
                      v-model="companionForm.midnightStyle" 
                      :rows="2" 
                      placeholder="例: 强硬催促休息" 
                      class="custom-textarea text-xs"
                    ></textarea>
                  </div>
                </div>

                <hr class="theme-border opacity-30 my-2" />

                <!-- 色卡选取与微调 -->
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-[var(--color-read-text)] opacity-85">人设卡片主题色 (双色莫兰迪渐变)</label>
                  <div class="flex flex-col gap-2.5 w-full">
                    <!-- 快捷莫兰迪色色卡 -->
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="p in colorPresets"
                        :key="p.name"
                        type="button"
                        @click="selectPresetColor(p.start, p.end)"
                        class="px-2 py-1 text-[10px] rounded-lg border theme-border flex items-center gap-1 hover:bg-stone-500/5 transition-all cursor-pointer bg-transparent"
                      >
                        <span 
                          class="w-2 h-2 rounded-full" 
                          :style="{ background: `linear-gradient(135deg, ${p.start}, ${p.end})` }"
                        ></span>
                        {{ p.name }}
                      </button>
                    </div>

                    <!-- ColorPicker 自由微调 (原生替代，极简化奢华风格) -->
                    <div class="flex items-center gap-4 bg-stone-500/5 p-2.5 rounded-xl border theme-border">
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] opacity-65">首色:</span>
                        <div class="relative w-7 h-7 rounded-full border theme-border overflow-hidden cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-stone-500/5">
                          <input 
                            type="color" 
                            v-model="companionForm.accentStart" 
                            class="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          />
                          <div class="w-5 h-5 rounded-full border theme-border" :style="{ backgroundColor: companionForm.accentStart }"></div>
                        </div>
                        <span class="text-[10px] font-mono text-stone-400 select-all">{{ companionForm.accentStart }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] opacity-65">末色:</span>
                        <div class="relative w-7 h-7 rounded-full border theme-border overflow-hidden cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-stone-500/5">
                          <input 
                            type="color" 
                            v-model="companionForm.accentEnd" 
                            class="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          />
                          <div class="w-5 h-5 rounded-full border theme-border" :style="{ backgroundColor: companionForm.accentEnd }"></div>
                        </div>
                        <span class="text-[10px] font-mono text-stone-400 select-all">{{ companionForm.accentEnd }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <!-- 底部 -->
            <footer class="px-6 py-4 border-t theme-border flex justify-end gap-3 bg-stone-500/5 shrink-0">
              <button 
                @click="showEditDialog = false"
                class="px-5 py-2 rounded-xl text-xs border theme-border hover:bg-stone-500/10 text-stone-500 transition-colors cursor-pointer bg-transparent"
              >
                取消
              </button>
              <button 
                @click="handleSaveCompanion"
                class="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer border-none"
                :style="{ background: `linear-gradient(135deg, ${companionForm.accentStart}, ${companionForm.accentEnd})` }"
              >
                保存并应用
              </button>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 模态弹窗动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  transform: scale(0.94);
  opacity: 0;
}

/* 下拉菜单动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* 自定义输入控件 */
.custom-input,
.custom-textarea {
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-read-border);
  background-color: var(--color-read-bg);
  color: var(--color-read-text);
  outline: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.custom-input::placeholder,
.custom-textarea::placeholder {
  color: var(--color-read-text);
  opacity: 0.35;
}

.custom-input:focus,
.custom-textarea:focus {
  border-color: transparent;
  box-shadow: 
    0 0 0 1.5px v-bind('companionForm.accentStart'),
    0 0 10px v-bind('companionForm.accentStart + "33"');
}

/* 隐藏滚动条但保留滚动功能 */
.custom-form::-webkit-scrollbar {
  width: 5px;
}
.custom-form::-webkit-scrollbar-track {
  background: transparent;
}
.custom-form::-webkit-scrollbar-thumb {
  background: var(--color-read-border);
  border-radius: 99px;
}
</style>
