import { strFromU8, unzipSync } from 'fflate'

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

export interface ParsedBookFile {
  parsed: ParsedBook
  rawText: string
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

export async function parseBookFile(file: File): Promise<ParsedBookFile> {
  const arrayBuffer = await file.arrayBuffer()
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'txt') {
    const rawText = decodeText(arrayBuffer)
    return {
      parsed: parseTxt(file.name, rawText),
      rawText,
    }
  }

  if (extension === 'pdf') {
    const rawText = await extractPdfText(arrayBuffer)
    assertExtractedText(rawText)
    return {
      parsed: parseTxt(file.name, rawText),
      rawText,
    }
  }

  if (extension === 'epub') {
    return extractEpubBook(file.name, arrayBuffer)
  }

  throw new Error('暂不支持该文件格式')
}

function assertExtractedText(text: string) {
  if (!text.trim()) {
    throw new Error('未能从文件中提取到可阅读文本，扫描版或图片版 PDF 暂不支持')
  }
}

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdfWorkerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
  const pdf = await loadingTask.promise
  const pages: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => {
          if (!('str' in item)) return ''
          return 'hasEOL' in item && item.hasEOL ? `${item.str}\n` : item.str
        })
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, '$1$2')
        .trim()

      if (pageText) pages.push(pageText)
    }
  } finally {
    await loadingTask.destroy()
  }

  return pages.join('\n\n')
}

function extractEpubBook(fileName: string, arrayBuffer: ArrayBuffer): ParsedBookFile {
  const files = unzipSync(new Uint8Array(arrayBuffer))
  const containerText = readZipText(files, 'META-INF/container.xml')
  const containerDoc = parseXml(containerText, 'EPUB container.xml')
  const rootfile = getElementsByLocalName(containerDoc, 'rootfile')[0]
  const opfPath = rootfile?.getAttribute('full-path')

  if (!opfPath) throw new Error('EPUB 缺少 package 文件')

  const opfText = readZipText(files, opfPath)
  const opfDoc = parseXml(opfText, 'EPUB package')
  const opfDir = getDirName(opfPath)
  const title = getFirstTextByLocalName(opfDoc, 'title') || fileName.replace(/\.[^/.]+$/, '')
  const manifest = new Map<string, { href: string; mediaType: string }>()

  for (const item of getElementsByLocalName(opfDoc, 'item')) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) {
      manifest.set(id, {
        href,
        mediaType: item.getAttribute('media-type') || '',
      })
    }
  }

  const chapters: Chapter[] = []

  for (const itemref of getElementsByLocalName(opfDoc, 'itemref')) {
    const idref = itemref.getAttribute('idref')
    const item = idref ? manifest.get(idref) : null
    if (!item || !isReadableEpubItem(item.href, item.mediaType)) continue

    const chapterPath = resolveZipPath(files, opfDir, item.href)
    const chapterText = readZipText(files, chapterPath)
    const chapter = extractHtmlChapter(chapterText, chapters.length + 1)
    if (chapter.content) chapters.push(chapter)
  }

  if (chapters.length === 0) throw new Error('未能从 EPUB 中提取到章节')

  const rawText = chapters
    .map((chapter, index) => `第${index + 1}章 ${chapter.title}\n\n${chapter.content}`)
    .join('\n\n')

  assertExtractedText(rawText)

  return {
    parsed: {
      title,
      chapters,
    },
    rawText,
  }
}

function extractHtmlChapter(html: string, index: number): Chapter {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, nav').forEach((node) => node.remove())
  doc.querySelectorAll('br').forEach((node) => node.replaceWith(doc.createTextNode('\n')))
  doc.querySelectorAll('p, div, section, article, li, h1, h2, h3, h4, h5, h6, blockquote').forEach((node) => {
    node.append(doc.createTextNode('\n'))
  })

  const heading = doc.querySelector('h1, h2, h3')?.textContent?.trim()
  const content = normalizeExtractedText(doc.body?.textContent || doc.documentElement.textContent || '')

  return {
    title: heading || `第${index}章`,
    content,
  }
}

function parseXml(text: string, label: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`${label} 解析失败`)
  }
  return doc
}

function getElementsByLocalName(doc: Document, localName: string): Element[] {
  return Array.from(doc.getElementsByTagName('*')).filter((item) => item.localName === localName)
}

function getFirstTextByLocalName(doc: Document, localName: string): string {
  return getElementsByLocalName(doc, localName)[0]?.textContent?.trim() || ''
}

function isReadableEpubItem(href: string, mediaType: string): boolean {
  return /x?html?$/i.test(href) || mediaType === 'application/xhtml+xml' || mediaType === 'text/html'
}

function readZipText(files: Record<string, Uint8Array>, path: string): string {
  const normalizedPath = normalizeZipPath(path)
  const bytes = files[normalizedPath] || files[safeDecodePath(normalizedPath)]
  if (!bytes) throw new Error(`EPUB 缺少文件：${path}`)

  try {
    return strFromU8(bytes)
  } catch (e) {
    return decodeText(new Uint8Array(bytes).buffer)
  }
}

function resolveZipPath(files: Record<string, Uint8Array>, baseDir: string, href: string): string {
  const path = normalizeZipPath(baseDir ? `${baseDir}/${href}` : href)
  if (files[path]) return path

  return safeDecodePath(path)
}

function safeDecodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch (e) {
    return path
  }
}

function getDirName(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function normalizeZipPath(path: string): string {
  const parts: string[] = []

  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
    } else {
      parts.push(part)
    }
  }

  return parts.join('/')
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/**
 * 将整篇小说文本按章节拆分
 */
export function parseTxt(fileName: string, text: string): ParsedBook {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 匹配常见章节标题正则 (添加“两”、“万”支持，并兼容“正文”“VIP章节”等前缀)
  const chapterRegex = /^\s*(?:正文\s+|VIP章节\s+|最新章节\s+|分卷\s+)?(第\s*[一二三四五六七八九十百千万两零0-9]+\s*[章节卷集部篇回].*)$/gm

  const matches: { index: number; title: string }[] = []
  let match

  while ((match = chapterRegex.exec(cleanText)) !== null) {
    matches.push({
      index: match.index,
      title: match[1].trim(),
    })
  }

  // 兜底逻辑：有些特别的网文可能用 "Chapter 1" 或纯数字 "01 " 作标题
  if (matches.length === 0) {
    const englishChapterRegex = /^\s*(Chapter\s*[0-9IVXLCDM]+.*)$/gmi
    while ((match = englishChapterRegex.exec(cleanText)) !== null) {
      matches.push({
        index: match.index,
        title: match[1].trim(),
      })
    }
  }

  if (matches.length === 0) {
    const numericChapterRegex = /^\s*([0-9]{1,4}\s+[^\d\n].{0,40})$/gm
    while ((match = numericChapterRegex.exec(cleanText)) !== null) {
      matches.push({
        index: match.index,
        title: match[1].trim(),
      })
    }
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
