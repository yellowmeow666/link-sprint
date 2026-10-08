import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createLink, listLinks } from './api.ts'
import { getOrCreateClientId } from './clientId.ts'
import { ERROR_MESSAGES, toUserMessage } from './errors.ts'
import { formatCreatedAt } from './format.ts'
import type { LinkRecord } from './types.ts'
import { normalizeUrl } from './validateUrl.ts'
import './App.css'

const EMPTY_LIST_TEXT = '还没有短链，提交一个链接开始使用。'

export function App() {
  // 懒初始化只在首次渲染执行：生成或复用 localStorage 里的匿名 ID
  const [clientId] = useState(() => getOrCreateClientId())
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<LinkRecord | null>(null)
  const [items, setItems] = useState<LinkRecord[]>([])
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // 按钮的 disabled 要等重绘才生效，ref 用来挡住同一次点击堆叠出来的重复提交
  const submittingRef = useRef(false)
  const listRequestId = useRef(0)

  const loadList = useCallback((): Promise<string | null> => {
    const requestId = ++listRequestId.current
    // setState 放在请求回调里，避免在 effect 调用栈上同步触发渲染
    return listLinks(clientId)
      .then((nextItems) => {
        // 忽略已经过期的响应，避免慢的列表请求覆盖更新的结果
        if (requestId !== listRequestId.current) return null
        setItems(nextItems)
        setListStatus('ready')
        return null
      })
      .catch((loadError: unknown) => {
        if (requestId !== listRequestId.current) return null
        setListStatus('error')
        return toUserMessage(loadError)
      })
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    // 页面加载时拉取当前 clientId 的列表，展示顺序以后端返回为准
    void loadList().then((message) => {
      if (cancelled || !message) return
      setError(message)
    })
    return () => {
      cancelled = true
    }
  }, [loadList])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setCopied(false)
    setError(null)

    try {
      const normalized = normalizeUrl(url)
      // 预校验失败不发请求；规则与后端一致，真正结果仍以后端为准
      if (normalized === null) {
        setError(ERROR_MESSAGES.INVALID_URL)
        return
      }

      const createdLink = await createLink(clientId, normalized)
      setCreated(createdLink)
      // 创建成功后重新 GET 列表，不用本次响应在前端拼一条记录
      const listError = await loadList()
      if (listError) setError(listError)
    } catch (submitError) {
      setError(toUserMessage(submitError))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!created) return
    try {
      // 复制后端返回的完整短链，不在本地重新拼接
      await navigator.clipboard.writeText(created.shortUrl)
      setCopied(true)
    } catch {
      setCopied(false)
      setError(ERROR_MESSAGES.COPY_FAILED)
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1>短链</h1>
        <p className="lede">把长链接换成短链接。列表里只显示这台浏览器创建过的记录。</p>
      </header>

      <form className="panel" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label htmlFor="url-input">长链接</label>
        <div className="form-row">
          <input
            id="url-input"
            data-testid="url-input"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://example.com/very/long/path"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button type="submit" data-testid="submit-button" disabled={submitting}>
            {submitting ? '生成中…' : '生成短链'}
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" data-testid="error-message" className="error">
          {error}
        </p>
      ) : null}

      {created ? (
        <section className="panel result" aria-label="生成结果">
          <h2>短链已生成</h2>
          <div className="result-row">
            <a
              data-testid="short-url"
              className="short-url"
              href={created.shortUrl}
              target="_blank"
              rel="noreferrer"
            >
              {created.shortUrl}
            </a>
            <button type="button" data-testid="copy-button" className="copy-button" onClick={() => void handleCopy()}>
              复制
            </button>
          </div>
          {copied ? (
            <p role="status" className="copied">
              已复制
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="list" aria-labelledby="list-heading">
        <h2 id="list-heading">我的短链</h2>
        <div data-testid="link-list" className="panel list-panel">
          {listStatus === 'loading' ? <p className="muted">正在加载短链列表…</p> : null}
          {listStatus === 'ready' && items.length === 0 ? <p className="muted">{EMPTY_LIST_TEXT}</p> : null}
          {items.length > 0 ? (
            <ul className="items">
              {items.map((item) => (
                <li key={item.code} data-testid="link-item" className="item">
                  <a
                    data-testid="link-short-url"
                    className="item-short"
                    href={item.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.shortUrl}
                  </a>
                  <p className="item-line">
                    <span className="item-label">原链接</span>
                    <a
                      data-testid="link-original-url"
                      className="item-original"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.url}
                    </a>
                  </p>
                  <p className="item-time">
                    <span className="item-label">创建时间</span>
                    <time dateTime={item.createdAt}>{formatCreatedAt(item.createdAt)}</time>
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </main>
  )
}
