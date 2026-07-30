export function cleanAssistantContent(content: string) {
  return content
    .replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation\s*>/gi, '')
    .replace(/<annotation\b[^>]*>[\s\S]*$/gi, '')
    .replace(/<\/annotation\s*>/gi, '')
    .trim()
}
