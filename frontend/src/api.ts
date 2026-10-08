import { ApiError } from './errors.ts'
import type { LinkRecord } from './types.ts'

const LINKS_PATH = '/api/links'

function clientHeaders(clientId: string, extra?: Record<string, string>): HeadersInit {
  return {
    'X-Client-Id': clientId,
    ...extra,
  }
}

function errorFromPayload(body: unknown): ApiError {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const code = (body as { error?: { code?: unknown } }).error?.code
    // 只认 error.code。message 留给界面按码映射，避免直接展示后端文案。
    if (typeof code === 'string' && code.length > 0) return new ApiError(code)
  }
  return new ApiError('UNPARSEABLE')
}

function isLinkRecord(value: unknown): value is LinkRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.code === 'string' &&
    typeof record.shortUrl === 'string' &&
    typeof record.url === 'string' &&
    typeof record.createdAt === 'string'
  )
}

/**
 * 请求 /api/links。网络层抛错、空响应或非 JSON 都转成 ApiError，由界面统一提示。
 * 路径用相对地址，开发时由 Vite 代理到 localhost:3000。
 */
async function request(init: RequestInit & { clientId: string }): Promise<unknown> {
  const { clientId, headers, ...rest } = init
  let response: Response
  try {
    response = await fetch(LINKS_PATH, {
      ...rest,
      headers: clientHeaders(clientId, headers as Record<string, string> | undefined),
    })
  } catch {
    throw new ApiError('NETWORK')
  }

  let body: unknown
  try {
    const text = await response.text()
    body = text.trim() === '' ? null : (JSON.parse(text) as unknown)
  } catch {
    throw new ApiError('UNPARSEABLE')
  }

  if (!response.ok) throw errorFromPayload(body)
  return body
}

export async function createLink(clientId: string, url: string): Promise<LinkRecord> {
  const body = await request({
    clientId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!isLinkRecord(body)) throw new ApiError('UNPARSEABLE')
  return body
}

export async function listLinks(clientId: string): Promise<LinkRecord[]> {
  const body = await request({
    clientId,
    method: 'GET',
  })
  if (typeof body !== 'object' || body === null || !('items' in body)) {
    throw new ApiError('UNPARSEABLE')
  }
  const items = (body as { items?: unknown }).items
  if (!Array.isArray(items) || !items.every(isLinkRecord)) throw new ApiError('UNPARSEABLE')
  return items
}
