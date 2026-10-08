import { describe, expect, it } from 'vitest';
import { create, makeApp, sequence } from './helpers';

describe('撞码重试（验收 2）', () => {
  it('先撞已存在的码，重试后用新码成功', async () => {
    const gen = sequence('AAAAAAA', 'AAAAAAA', 'AAAAAAA', 'BBBBBBB');
    const { app } = makeApp(gen);
    const first = await create(app, 'https://example.com/1');
    expect(first.status).toBe(201);
    expect(first.body.code).toBe('AAAAAAA');

    const second = await create(app, 'https://example.com/2');
    expect(second.status).toBe(201);
    expect(second.body.code).toBe('BBBBBBB');
    expect(gen.state.calls).toBe(4);
  });

  it('一直撞码时最多重试 5 次，然后返回 500 INTERNAL', async () => {
    const gen = sequence('CCCCCCC');
    const { app } = makeApp(gen);
    expect((await create(app, 'https://example.com/1')).status).toBe(201);

    gen.state.calls = 0;
    const res = await create(app, 'https://example.com/2');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(typeof res.body.error.message).toBe('string');
    // 首次尝试 1 次 + 重试 5 次 = 6 次
    expect(gen.state.calls).toBe(6);
  });
});
