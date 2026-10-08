import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { create, makeApp, sequence } from './helpers';

function expectNotFound(res: request.Response) {
  expect(res.status).toBe(404);
  expect(res.body?.error?.code).toBe('NOT_FOUND');
}

describe('GET /:code 跳转（验收 3）', () => {
  it('已存在的短码返回 302，Location 是原链接，不需要 X-Client-Id', async () => {
    const { app } = makeApp();
    const url = 'https://example.com/target?x=1';
    const { code } = (await create(app, url)).body;
    const res = await request(app).get(`/${code}`).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(url);
  });

  it('别的用户创建的短码也能跳转', async () => {
    const { app } = makeApp();
    const { code } = (await create(app, 'https://example.com/shared')).body;
    const res = await request(app).get(`/${code}`).set('X-Client-Id', '22222222-2222-4222-8222-222222222222').redirects(0);
    expect(res.status).toBe(302);
  });

  it('格式正确但不存在的短码返回 404 NOT_FOUND', async () => {
    const { app } = makeApp();
    expectNotFound(await request(app).get('/Zz9Zz9Z').redirects(0));
  });

  it('短码区分大小写', async () => {
    const { app } = makeApp(sequence('AbCdEfG'));
    expect((await create(app, 'https://example.com/case')).body.code).toBe('AbCdEfG');
    expectNotFound(await request(app).get('/abcdefg').redirects(0));
  });

  it.each([
    ['6 位', '/abc123'],
    ['8 位', '/abc12345'],
    ['7 位含连字符', '/abc-123'],
    ['7 位含下划线', '/abc_123'],
    ['7 位含中文', `/${encodeURIComponent('abc中文12')}`],
    ['多级路径', '/abc1234/extra'],
  ])('格式不符（%s）返回 404 NOT_FOUND', async (_name, path) => {
    const { app } = makeApp();
    expectNotFound(await request(app).get(path).redirects(0));
  });
});
