import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { saveChatSessions, loadChatSessions } from '@/utils/storage'
import { useReaderStore } from '@/stores/readerStore'
import { useCompanionStore } from '@/stores/companionStore'

export interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  quote?: string
  isStreaming?: boolean
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: string
}

function cleanForPrompt(content: string) {
  return content.replace(/<annotation>.*?<\/annotation>/gs, '').trim()
}

export const useChatStore = defineStore('chat', () => {
  const sessions: Ref<ChatSession[]> = ref([])
  const currentSessionId: Ref<string> = ref('')
  const isStreaming = ref(false)

  // ── 待发送划线引用 ──
  const pendingQuote = ref('')

  const readerStore = useReaderStore()
  const companionStore = useCompanionStore()

  const currentSession = computed<ChatSession | null>(() => {
    return sessions.value.find((s) => s.id === currentSessionId.value) || null
  })

  const messages = computed<ChatMessage[]>(() => {
    return currentSession.value ? currentSession.value.messages : []
  })

  // ── 深度自动持久化监听器 ──
  watch(
    sessions,
    async (newSessions) => {
      if (readerStore.book && companionStore.currentCompanionId && newSessions.length > 0) {
        try {
          const cleanData = JSON.parse(JSON.stringify(newSessions))
          await saveChatSessions(readerStore.book.id, companionStore.currentCompanionId, cleanData)
        } catch (err) {
          console.error('自动保存会话失败:', err)
        }
      }
    },
    { deep: true }
  )

  /**
   * 初始化/载入会话列表
   */
  async function loadSessions(bookId: string, companionId: string) {
    const loaded = await loadChatSessions(bookId, companionId)
    if (loaded && loaded.length > 0) {
      sessions.value = loaded
      currentSessionId.value = loaded[loaded.length - 1].id
    } else {
      const defaultId = 'session_' + Date.now()
      sessions.value = [
        {
          id: defaultId,
          name: '新会话',
          messages: [],
          createdAt: new Date().toISOString(),
        },
      ]
      currentSessionId.value = defaultId
    }
  }

  /**
   * 新建会话
   */
  async function createNewSession(_bookId: string, _companionId: string, name?: string) {
    const newId = 'session_' + Date.now()
    const newSess: ChatSession = {
      id: newId,
      name: name || `会话 ${sessions.value.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
    }
    sessions.value.push(newSess)
    currentSessionId.value = newId
  }

  /**
   * 删除指定会话
   */
  async function deleteSession(sessionId: string, _bookId: string, _companionId: string) {
    sessions.value = sessions.value.filter((s) => s.id !== sessionId)
    if (sessions.value.length === 0) {
      const defaultId = 'session_' + Date.now()
      sessions.value = [
        {
          id: defaultId,
          name: '新会话',
          messages: [],
          createdAt: new Date().toISOString(),
        },
      ]
      currentSessionId.value = defaultId
    } else if (currentSessionId.value === sessionId) {
      currentSessionId.value = sessions.value[sessions.value.length - 1].id
    }
  }

  /**
   * 清空当前会话消息
   */
  async function clearCurrentSession(_bookId: string, _companionId: string) {
    if (currentSession.value) {
      currentSession.value.messages = []
    }
  }

  function clear() {
    sessions.value = []
    currentSessionId.value = ''
    pendingQuote.value = ''
  }

  /**
   * SSE 流式对话请求
   */
  async function streamResponse(
    userMsg: string,
    quoteText: string,
    contextText: string,
    chapterText: string,
    _bookId: string,
    companionId: string,
    currentChapter: number
  ) {
    if (isStreaming.value || !currentSession.value) return
    isStreaming.value = true

    // 1. 构建当前会话的多轮历史
    const historyPayload = currentSession.value.messages
      .filter((msg) => !msg.isStreaming)
      .slice(-12)
      .map((msg) => {
        let textContent = cleanForPrompt(msg.content)
        if (msg.quote && msg.role === 'user') {
          textContent = `[用户划线原文: “${msg.quote}”] ${textContent}`
        }
        return {
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: textContent,
        }
      })

    // 2. 插入用户当前消息 (保留 quote 属性用于前端气泡引用显示)
    currentSession.value.messages.push({ role: 'user', content: userMsg, quote: quoteText })

    // 3. 插入占位 AI 流式消息
    const aiMessageIdx = currentSession.value.messages.push({ role: 'ai', content: '', isStreaming: true }) - 1

    try {
      const response = await fetch('http://localhost:8010/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMsg,
          context_text: contextText,
          chapter_text: chapterText,
          current_local_time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          daily_read_minutes: readerStore.dailyReadMinutes,
          current_chapter: currentChapter,
          companion_id: companionId,
          history: historyPayload,
          quote: quoteText, // 传递独立的引用原文
        }),
      })

      if (!response.ok) {
        throw new Error('网络请求错误')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('流式读取器未初始化')

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        buffer = lines.pop() || ''

        for (const line of lines) {
          const cleanLine = line.trim()
          if (!cleanLine) continue

          if (cleanLine.startsWith('data: ')) {
            const data = cleanLine.substring(6)
            if (data === '[DONE]') {
              break
            }
            try {
              const parsed = JSON.parse(data)
              const chunk = parsed.choices?.[0]?.delta?.content || ''
              if (currentSession.value) {
                currentSession.value.messages[aiMessageIdx].content += chunk
              }
            } catch (e) {
              // 忽略
            }
          }
        }
      }
    } catch (err) {
      console.error('SSE Error:', err)
      if (currentSession.value) {
        currentSession.value.messages[aiMessageIdx].content = '（好像出了一点小状况，等会儿再试吧。）'
      }
    } finally {
      isStreaming.value = false
      try {
        if (currentSession.value && currentSession.value.messages[aiMessageIdx]) {
          currentSession.value.messages[aiMessageIdx].isStreaming = false
          
          const lastMsg = currentSession.value.messages[aiMessageIdx].content
          const annotationRegex = /<annotation>(.*?)\|(.*?)<\/annotation>/g
          let match
          while ((match = annotationRegex.exec(lastMsg)) !== null) {
            const originalText = match[1]
            const annotationComment = match[2]
            console.log(`[Phase 1] 捕获到 AI 批注： 原文「${originalText}」 -> 批注「${annotationComment}」`)
          }
        }
      } catch (err) {
        console.error('Error in streamResponse finally block:', err)
      }
    }
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isStreaming,
    pendingQuote,
    loadSessions,
    createNewSession,
    deleteSession,
    clearCurrentSession,
    clear,
    streamResponse,
  }
})
