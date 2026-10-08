import { describe, expect, it } from 'vitest';
import { BASE_URL, CODE_RE, create, makeApp } from './helpers';

function expectErrorBody(res: { status: number; body: any }, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('error');
  expect(res.body.error.code).toBe(code);
  expect(typeof res.body.error.message).toBe('string');
}

describe('POST /api/links 创建短链（验收 1、2）', () => {
  it('合法 https 链接返回 201 和完整字段', async () => {
    const { app } = makeApp();
    const url = 'https://example.com/path?q=1#frag';
    const res = await create(app, url);
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(CODE_RE);
    expect(res.body.url).toBe(url);
    expect(res.body.shortUrl).toBe(`${BASE_URL}/${res.body.code}`);
    expect(Number.isNaN(Date.parse(res.body.createdAt))).toBe(false);
  });

  it('合法 http 链接返回 201', async () => {
    const { app } = makeApp();
    const res = await create(app, 'http://example.com');
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(CODE_RE);
  });

  it('首尾空格先去掉再校验，返回 201', async () => {
    const { app } = makeApp();
    const res = await create(app, '   https://example.com/trim   ');
    expect(res.status).toBe(201);
  });

  it('长度正好 2048 合法', async () => {
    const { app } = makeApp();
    const prefix = 'https://example.com/';
    const url = prefix + 'a'.repeat(2048 - prefix.length);
    expect(url.length).toBe(2048);
    const res = await create(app, url);
    expect(res.status).toBe(201);
  });

  it('长度 2049 返回 400 INVALID_URL', async () => {
    const { app } = makeApp();
    const prefix = 'https://example.com/';
    const url = prefix + 'a'.repeat(2049 - prefix.length);
    expect(url.length).toBe(2049);
    expectErrorBody(await create(app, url), 400, 'INVALID_URL');
  });

  it.each([
    ['缺少 url 字段', undefined],
    ['空字符串', ''],
    ['只有空格', '   '],
    ['不是字符串', 12345],
    ['null', null],
    ['无法解析', 'not a url'],
    ['缺协议', 'example.com'],
    ['ftp 协议', 'ftp://example.com/file'],
    ['javascript 协议', 'javascript:alert(1)'],
    ['data 协议', 'data:text/html,<b>x</b>'],
    ['mailto 协议', 'mailto:a@example.com'],
  ])('非法链接（%s）返回 400 INVALID_URL', async (_name, url) => {
    const { app } = makeApp();
    expectErrorBody(await create(app, url), 400, 'INVALID_URL');
  });

  it('不带 X-Client-Id 返回 400 MISSING_CLIENT_ID', async () => {
    const { app } = makeApp();
    expectErrorBody(await create(app, 'https://example.com', null), 400, 'MISSING_CLIENT_ID');
  });

  it.each([['空值', ''], ['非 UUID', 'abc'], ['UUID 少一位', '11111111-1111-4111-8111-11111111111']])(
    'X-Client-Id 不是 UUID（%s）返回 400 MISSING_CLIENT_ID',
    async (_name, id) => {
      const { app } = makeApp();
      expectErrorBody(await create(app, 'https://example.com', id), 400, 'MISSING_CLIENT_ID');
    },
  );

  it('同一长链接提交两次生成两个不同短码', async () => {
    const { app } = makeApp();
    const a = await create(app, 'https://example.com/dup');
    const b = await create(app, 'https://example.com/dup');
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.code).not.toBe(b.body.code);
  });

  it('默认短码生成器：连续 200 次都是 7 位字母数字且互不重复', async () => {
    const { app } = makeApp();
    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const res = await create(app, `https://example.com/${i}`);
      expect(res.status).toBe(201);
      expect(res.body.code).toMatch(CODE_RE);
      codes.add(res.body.code);
    }
    expect(codes.size).toBe(200);
  });
});
