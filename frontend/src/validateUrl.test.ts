import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './validateUrl.ts'

function urlOfLength(length: number): string {
  const prefix = 'https://example.com/'
  return prefix + 'a'.repeat(length - prefix.length)
}

describe('normalizeUrl', () => {
  it('接受 http 和 https，并去掉首尾空格', () => {
    expect(normalizeUrl('  https://example.com/a  ')).toBe('https://example.com/a')
    expect(normalizeUrl('http://localhost:3000/path')).toBe('http://localhost:3000/path')
    // new URL 会把协议规范成 http:，这和后端一样，不能额外要求必须写成小写或带 //
    expect(normalizeUrl('HTTP://example.com')).toBe('HTTP://example.com')
    expect(normalizeUrl('http:example.com')).toBe('http:example.com')
  })

  it('正好 2048 合法，2049 以及去掉空格后超长都不合法', () => {
    const exact = urlOfLength(2048)
    expect(exact).toHaveLength(2048)
    expect(normalizeUrl(exact)).toBe(exact)
    expect(normalizeUrl(` ${exact} `)).toBe(exact)
    expect(normalizeUrl(urlOfLength(2049))).toBeNull()
  })

  it('拒绝空串、无法解析的文本，以及非 http(s) 协议', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
    expect(normalizeUrl('example.com')).toBeNull()
    expect(normalizeUrl('http://')).toBeNull()
    expect(normalizeUrl('ftp://example.com')).toBeNull()
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
  })
})
