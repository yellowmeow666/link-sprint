import { describe, expect, it } from 'vitest';
import { BASE_URL, CLIENT_A, CLIENT_B, create, list, makeApp, sleep } from './helpers';

describe('GET /api/links 我的列表（验收 4）', () => {
  it('新用户返回 200 和空数组', async () => {
    const { app } = makeApp();
    const res = await list(app);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('按创建时间倒序，字段齐全', async () => {
    const { app } = makeApp();
    const created = [];
    for (const path of ['one', 'two', 'three']) {
      created.push((await create(app, `https://example.com/${path}`)).body);
      await sleep(15);
    }
    const res = await list(app);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: any) => i.code)).toEqual(created.map((c) => c.code).reverse());
    for (const item of res.body.items) {
      expect(Object.keys(item)).toEqual(expect.arrayContaining(['code', 'shortUrl', 'url', 'createdAt']));
      expect(item.shortUrl).toBe(`${BASE_URL}/${item.code}`);
    }
    const times = res.body.items.map((i: any) => Date.parse(i.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('两个 ID 交叉验证：互相看不到对方的记录', async () => {
    const { app } = makeApp();
    const a1 = (await create(app, 'https://a.example.com/1', CLIENT_A)).body.code;
    const a2 = (await create(app, 'https://a.example.com/2', CLIENT_A)).body.code;
    const b1 = (await create(app, 'https://b.example.com/1', CLIENT_B)).body.code;

    const la = (await list(app, CLIENT_A)).body.items.map((i: any) => i.code);
    const lb = (await list(app, CLIENT_B)).body.items.map((i: any) => i.code);
    expect(la.sort()).toEqual([a1, a2].sort());
    expect(lb).toEqual([b1]);
  });

  it('重复提交的长链接在列表里出现两条', async () => {
    const { app } = makeApp();
    await create(app, 'https://example.com/dup');
    await create(app, 'https://example.com/dup');
    const items = (await list(app)).body.items;
    expect(items).toHaveLength(2);
    expect(items[0].code).not.toBe(items[1].code);
  });

  it('不带 X-Client-Id 返回 400 MISSING_CLIENT_ID', async () => {
    const { app } = makeApp();
    const res = await list(app, null);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_CLIENT_ID');
  });

  it('X-Client-Id 不是 UUID 返回 400 MISSING_CLIENT_ID', async () => {
    const { app } = makeApp();
    const res = await list(app, 'not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_CLIENT_ID');
  });
});
