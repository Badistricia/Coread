// 阅读器相关工具函数 — Phase 1
// TXT 编码检测、章节拆分、字数分页

export interface Chapter {
  title: string
  content: string
}

export interface ParsedBook {
  title: string
  chapters: Chapter[]
}

/**
 * 智能解析文本编码，支持 UTF-8 与 GBK 回退
 */
export function decodeText(arrayBuffer: ArrayBuffer): string {
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    return utf8Decoder.decode(arrayBuffer)
  } catch (e) {
    const gbkDecoder = new TextDecoder('gbk')
    return gbkDecoder.decode(arrayBuffer)
  }
}

/**
 * 将整篇小说文本按章节拆分
 */
export function parseTxt(fileName: string, text: string): ParsedBook {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 匹配常见章节标题正则
  const chapterRegex = /^\s*(第\s*[一二三四五六七八九十百千零0-9]+\s*[章节卷集部篇回].*)$/gm

  const matches: { index: number; title: string }[] = []
  let match

  while ((match = chapterRegex.exec(cleanText)) !== null) {
    matches.push({
      index: match.index,
      title: match[1].trim(),
    })
  }

  const chapters: Chapter[] = []

  if (matches.length === 0) {
    chapters.push({
      title: '正文',
      content: cleanText,
    })
  } else {
    // 提取引子前言
    if (matches[0].index > 0) {
      const preambleText = cleanText.substring(0, matches[0].index).trim()
      if (preambleText) {
        chapters.push({
          title: '前言',
          content: preambleText,
        })
      }
    }

    // 拆分各章节
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index
      const end = i + 1 < matches.length ? matches[i + 1].index : cleanText.length
      const chapterContent = cleanText.substring(start, end).trim()
      chapters.push({
        title: matches[i].title,
        content: chapterContent,
      })
    }
  }

  const title = fileName.replace(/\.[^/.]+$/, '')

  return {
    title,
    chapters,
  }
}

/**
 * 智能分页：每页约 pageSize 字，优先在段落边界或句子结束处截断
 */
export function paginateText(text: string, pageSize: number = 1000): string[] {
  if (!text) return ['']

  const pages: string[] = []
  let remainingText = text

  while (remainingText.length > 0) {
    if (remainingText.length <= pageSize) {
      pages.push(remainingText.trim())
      break
    }

    let breakPoint = pageSize
    const chunk = remainingText.substring(0, pageSize)
    const lastNewline = chunk.lastIndexOf('\n')

    if (lastNewline > pageSize * 0.6) {
      // 优先段落截断
      breakPoint = lastNewline + 1
    } else {
      // 其次标点截断
      const lastSentenceEnd = Math.max(
        chunk.lastIndexOf('。'),
        chunk.lastIndexOf('！'),
        chunk.lastIndexOf('？')
      )
      if (lastSentenceEnd > pageSize * 0.5) {
        breakPoint = lastSentenceEnd + 1
      }
    }

    pages.push(remainingText.substring(0, breakPoint).trim())
    remainingText = remainingText.substring(breakPoint)
  }

  return pages
}
