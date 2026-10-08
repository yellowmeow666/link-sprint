/** 按错误码映射的中文提示。界面不使用后端 message 文案。 */
export const ERROR_MESSAGES = {
  INVALID_URL: '请输入有效的 http 或 https 链接，且长度不超过 2048 个字符。',
  MISSING_CLIENT_ID: '缺少有效的客户端标识，请刷新页面后重试。',
  NOT_FOUND: '没有找到对应的短链。',
  INTERNAL: '服务暂时不可用，请稍后再试。',
  NETWORK: '网络连接失败，请检查网络后重试。',
  UNPARSEABLE: '服务器返回了无法解析的响应，请稍后重试。',
  UNKNOWN: '请求失败，请稍后重试。',
  COPY_FAILED: '复制失败，请手动选择短链复制。',
} as const

export class ApiError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 把异常收成可读中文。未知错误码、网络失败、无法解析的响应都走兜底，不展示后端原文。 */
export function toUserMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return ERROR_MESSAGES.NETWORK

  switch (error.code) {
    case 'INVALID_URL':
      return ERROR_MESSAGES.INVALID_URL
    case 'MISSING_CLIENT_ID':
      return ERROR_MESSAGES.MISSING_CLIENT_ID
    case 'NOT_FOUND':
      return ERROR_MESSAGES.NOT_FOUND
    case 'INTERNAL':
      return ERROR_MESSAGES.INTERNAL
    case 'NETWORK':
      return ERROR_MESSAGES.NETWORK
    case 'UNPARSEABLE':
      return ERROR_MESSAGES.UNPARSEABLE
    default:
      return ERROR_MESSAGES.UNKNOWN
  }
}
