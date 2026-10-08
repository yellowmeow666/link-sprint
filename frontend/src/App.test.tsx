import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'
import type { LinkRecord } from './types.ts'

const CLIENT_ID = '11111111-1111-4111-8111-111111111111'
const EMPTY_TEXT = '还没有短链，提交一个链接开始使用。'

const INVALID_URL_TEXT = '请输入有效的 http 或 https 链接，且长度不超过 2048 个字符。'
const MISSING_CLIENT_ID_TEXT = '缺少有效的客户端标识，请刷新页面后重试。'
const NOT_FOUND_TEXT = '没有找到对应的短链。'
const INTERNAL_TEXT = '服务暂时不可用，请稍后再试。'
const NETWORK_TEXT = '网络连接失败，请检查网络后重试。'
const UNPARSEABLE_TEXT = '服务器返回了无法解析的响应，请稍后重试。'
const UNKNOWN_TEXT = '请求失败，请稍后重试。'
const COPY_FAILED_TEXT = '复制失败，请手动选择短链复制。'

const fetchMock = vi.fn()
let clipboardWrite = vi.fn<(text: string) => Promise<void>>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status })
}

function link(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    code: 'postcode',
    shortUrl: 'http://localhost:3000/postcode',
    url: 'https://example.com/from-post',
    createdAt: '2026-10-08T03:04:00.000Z',
    ...overrides,
  }
}

function clientIdOf(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('X-Client-Id')
}

function methodOf(init: RequestInit | undefined): string {
  return init?.method ?? 'GET'
}

function installClipboard(): ReturnType<typeof userEvent.setup> {
  // user-event 会在 setup 时换成自己的 clipboard stub，要在那之后再接管 writeText
  const user = userEvent.setup()
  clipboardWrite = vi.fn<(text: string) => Promise<void>>()
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation((text) => clipboardWrite(text))
  return user
}

async function renderSettledList(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = installClipboard()
  render(<App />)
  await screen.findByText(EMPTY_TEXT)
  return user
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(CLIENT_ID)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('首次生成 clientId 并保存，之后复用，且请求都带 X-Client-Id', async () => {
    const randomUUID = vi.mocked(crypto.randomUUID)
    const first = render(<App />)
    await screen.findByText(EMPTY_TEXT)
    expect(localStorage.getItem('linkSprint.clientId')).toBe(CLIENT_ID)
    expect(randomUUID).toHaveBeenCalledTimes(1)
    first.unmount()

    render(<App />)
    await screen.findByText(EMPTY_TEXT)
    expect(localStorage.getItem('linkSprint.clientId')).toBe(CLIENT_ID)
    expect(randomUUID).toHaveBeenCalledTimes(1)

    expect(fetchMock).toHaveBeenCalled()
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined
      expect(call[0]).toBe('/api/links')
      expect(clientIdOf(init)).toBe(CLIENT_ID)
    }
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('创建成功后展示 shortUrl，并重新拉取列表而不是本地拼接', async () => {
    const created = link()
    const listed = link({
      code: 'listcode',
      shortUrl: 'http://localhost:3000/listcode',
      url: 'https://example.com/from-list',
      createdAt: '2026-10-08T04:05:00.000Z',
    })
    let gets = 0
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') return jsonResponse(created, 201)
      gets += 1
      if (gets === 1) return jsonResponse({ items: [] })
      return jsonResponse({ items: [listed] })
    })

    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), '  https://example.com/from-post  ')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('short-url')).toHaveTextContent(created.shortUrl)
    const item = await screen.findByTestId('link-item')
    expect(within(item).getByTestId('link-short-url')).toHaveTextContent(listed.shortUrl)
    expect(within(item).getByTestId('link-original-url')).toHaveTextContent(listed.url)
    expect(screen.queryByText(created.url)).not.toBeInTheDocument()
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()

    const posts = fetchMock.mock.calls.filter((call) => methodOf(call[1] as RequestInit) === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ url: 'https://example.com/from-post' }),
        headers: expect.objectContaining({
          'X-Client-Id': CLIENT_ID,
          'Content-Type': 'application/json',
        }) as unknown,
      }),
    )
    const listGets = fetchMock.mock.calls.filter((call) => methodOf(call[1] as RequestInit) === 'GET')
    expect(listGets).toHaveLength(2)
    expect(screen.getByTestId('submit-button')).toBeEnabled()
  })

  it('提交过程中禁用按钮，完成后恢复', async () => {
    const user = installClipboard()
    let releasePost: (value: Response) => void = () => {}
    const postGate = new Promise<Response>((resolve) => {
      releasePost = resolve
    })
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') return postGate
      return jsonResponse({ items: [] })
    })

    render(<App />)
    await screen.findByText(EMPTY_TEXT)
    await user.type(screen.getByTestId('url-input'), 'https://example.com/slow')
    const pendingClick = user.click(screen.getByTestId('submit-button'))
    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeDisabled()
    })
    releasePost(jsonResponse(link(), 201))
    await pendingClick
    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeEnabled()
    })
  })

  it('复制按钮把 shortUrl 写入剪贴板，并给出已复制反馈', async () => {
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') return jsonResponse(link(), 201)
      return jsonResponse({ items: [] })
    })
    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), 'https://example.com/from-post')
    await user.click(screen.getByTestId('submit-button'))
    await screen.findByTestId('short-url')

    await user.click(screen.getByTestId('copy-button'))
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(clipboardWrite).toHaveBeenCalledWith('http://localhost:3000/postcode')
    expect(await screen.findByText('已复制')).toBeInTheDocument()
  })

  it('复制失败时提示错误，且不显示已复制', async () => {
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') return jsonResponse(link(), 201)
      return jsonResponse({ items: [] })
    })
    const user = await renderSettledList()
    clipboardWrite.mockRejectedValue(new Error('denied'))
    await user.type(screen.getByTestId('url-input'), 'https://example.com/from-post')
    await user.click(screen.getByTestId('submit-button'))
    await screen.findByTestId('short-url')
    await user.click(screen.getByTestId('copy-button'))

    expect(await screen.findByTestId('error-message')).toHaveTextContent(COPY_FAILED_TEXT)
    expect(screen.queryByText('已复制')).not.toBeInTheDocument()
  })

  it.each([
    ['INVALID_URL', 400, INVALID_URL_TEXT, 'url must be an http(s) URL of at most 2048 characters'],
    ['MISSING_CLIENT_ID', 400, MISSING_CLIENT_ID_TEXT, 'X-Client-Id header must be a UUID'],
    ['NOT_FOUND', 404, NOT_FOUND_TEXT, 'not found'],
    ['INTERNAL', 500, INTERNAL_TEXT, 'internal server error'],
  ])('后端返回 %s 时显示对应中文，不展示后端 message', async (code, status, message, backendMessage) => {
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') {
        return jsonResponse({ error: { code, message: backendMessage } }, status)
      }
      return jsonResponse({ items: [] })
    })
    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), 'https://example.com/ok')
    await user.click(screen.getByTestId('submit-button'))

    const alert = await screen.findByTestId('error-message')
    expect(alert).toHaveTextContent(message)
    expect(alert).not.toHaveTextContent(backendMessage)
    expect(screen.queryByTestId('short-url')).not.toBeInTheDocument()
    expect(screen.getByTestId('submit-button')).toBeEnabled()
  })

  it('本地预校验不通过时不发 POST，并显示无效链接提示', async () => {
    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), 'javascript:alert(1)')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('error-message')).toHaveTextContent(INVALID_URL_TEXT)
    expect(fetchMock.mock.calls.some((call) => methodOf(call[1] as RequestInit) === 'POST')).toBe(false)
  })

  it('网络失败和无法解析的响应都有兜底提示', async () => {
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') throw new TypeError('failed to fetch')
      return jsonResponse({ items: [] })
    })
    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), 'https://example.com/ok')
    await user.click(screen.getByTestId('submit-button'))
    expect(await screen.findByTestId('error-message')).toHaveTextContent(NETWORK_TEXT)

    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') return textResponse('<html>nope</html>', 500)
      return jsonResponse({ items: [] })
    })
    await user.clear(screen.getByTestId('url-input'))
    await user.type(screen.getByTestId('url-input'), 'https://example.com/again')
    await user.click(screen.getByTestId('submit-button'))
    expect(await screen.findByTestId('error-message')).toHaveTextContent(UNPARSEABLE_TEXT)
  })

  it('未知错误码不展示后端 message', async () => {
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') {
        return jsonResponse({ error: { code: 'SOMETHING_ELSE', message: 'secret-backend-text' } }, 500)
      }
      return jsonResponse({ items: [] })
    })
    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), 'https://example.com/ok')
    await user.click(screen.getByTestId('submit-button'))
    const alert = await screen.findByTestId('error-message')
    expect(alert).toHaveTextContent(UNKNOWN_TEXT)
    expect(alert).not.toHaveTextContent('secret-backend-text')
  })

  it('列表按返回顺序渲染短链和原链接', async () => {
    const items = [
      link({
        code: 'bbbbbbb',
        shortUrl: 'http://localhost:3000/bbbbbbb',
        url: 'https://example.com/newer',
        createdAt: '2026-10-08T02:00:00.000Z',
      }),
      link({
        code: 'aaaaaaa',
        shortUrl: 'http://localhost:3000/aaaaaaa',
        url: 'https://example.com/older',
        createdAt: '2026-10-08T01:00:00.000Z',
      }),
    ]
    fetchMock.mockImplementation(async () => jsonResponse({ items }))
    render(<App />)

    const rows = await screen.findAllByTestId('link-item')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByTestId('link-short-url')).toHaveTextContent(items[0]!.shortUrl)
    expect(within(rows[0]!).getByTestId('link-short-url')).toHaveAttribute('href', items[0]!.shortUrl)
    expect(within(rows[0]!).getByTestId('link-original-url')).toHaveTextContent(items[0]!.url)
    expect(within(rows[1]!).getByTestId('link-short-url')).toHaveTextContent(items[1]!.shortUrl)
    expect(within(rows[1]!).getByTestId('link-original-url')).toHaveTextContent(items[1]!.url)
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument()
  })

  it('空列表显示空状态，且没有错误节点', async () => {
    render(<App />)
    expect(await screen.findByTestId('link-list')).toBeInTheDocument()
    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument()
    expect(screen.queryByTestId('link-item')).not.toBeInTheDocument()
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('列表加载失败时显示错误，不把失败当成空列表', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: { code: 'INTERNAL', message: 'internal server error' } }, 500),
    )
    render(<App />)
    const alert = await screen.findByTestId('error-message')
    expect(alert).toHaveTextContent(INTERNAL_TEXT)
    expect(alert).not.toHaveTextContent('internal server error')
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByTestId('link-item')).not.toBeInTheDocument()
  })

  it('列表刷新失败时仍展示刚创建的短链，且不本地插入记录', async () => {
    let gets = 0
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (methodOf(init) === 'POST') return jsonResponse(link(), 201)
      gets += 1
      if (gets === 1) return jsonResponse({ items: [] })
      return jsonResponse({ error: { code: 'INTERNAL', message: 'internal server error' } }, 500)
    })
    const user = await renderSettledList()
    await user.type(screen.getByTestId('url-input'), 'https://example.com/from-post')
    await user.click(screen.getByTestId('submit-button'))

    expect(await screen.findByTestId('short-url')).toHaveTextContent('http://localhost:3000/postcode')
    expect(await screen.findByTestId('error-message')).toHaveTextContent(INTERNAL_TEXT)
    expect(screen.queryByTestId('link-item')).not.toBeInTheDocument()
  })
})
