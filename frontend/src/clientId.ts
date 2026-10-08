const STORAGE_KEY = 'linkSprint.clientId'

/**
 * 匿名身份。
 * 首次打开用 crypto.randomUUID() 生成，写入 localStorage 的 linkSprint.clientId，之后一直复用。
 * 每次请求 /api/links 都放到请求头 X-Client-Id。缺头或不是 UUID 时后端返回 MISSING_CLIENT_ID。
 */
export function getOrCreateClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing

  const id = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}
