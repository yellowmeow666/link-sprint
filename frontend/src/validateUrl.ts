/** 与后端一致：去掉首尾空格后的长度上限，正好 2048 合法。按 JS 字符串长度计。 */
const MAX_URL_LENGTH = 2048

/**
 * 轻量预校验，规则与后端 normalizeUrl 对齐，不放宽也不收紧：
 * 先去掉首尾空格，必须能被 new URL 解析，协议只能是 http 或 https。
 * 通过时返回去掉空格后的 URL，失败返回 null。最终仍以后端结果为准。
 */
export function normalizeUrl(input: string): string | null {
  const url = input.trim()
  if (url.length === 0 || url.length > MAX_URL_LENGTH) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  return url
}
