import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp, MAX_CODE_ATTEMPTS } from '../src/app.js';
import { openDb, type Db } from '../src/db.js';
import { generateCode, CODE_PATTERN } from '../src/code.js';

const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const BASE = 'http://sho.rt';

let db: Db;
let app: Express;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db, publicBaseUrl: BASE });
});

const create = (url: unknown, clientId: string | null = CLIENT_A) => {
  const req = request(app).post('/api/links');
  if (clientId !== null) req.set('X-Client-Id', clientId);
  return req.send({ url });
};

describe('generateCode', () => {
  it('produces 7 alphanumeric characters', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(CODE_PATTERN);
  });
});

describe('POST /api/links', () => {
  it('creates a link and returns 201 with the full short URL', async () => {
    const res = await create('https://example.com/a?b=1');
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(CODE_PATTERN);
    expect(res.body.shortUrl).toBe(`${BASE}/${res.body.code}`);
    expect(res.body.url).toBe('https://example.com/a?b=1');
    expect(Number.isNaN(Date.parse(res.body.createdAt))).toBe(false);
  });

  it('trims surrounding whitespace', async () => {
    const res = await create('  http://example.com  ');
    expect(res.status).toBe(201);
    expect(res.body.url).toBe('http://example.com');
  });

  it('issues a new code each time the same URL is submitted', async () => {
    const a = await create('https://example.com');
    const b = await create('https://example.com');
    expect(a.body.code).not.toBe(b.body.code);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['missing', undefined],
    ['not a string', 123],
    ['not a URL', 'not a url'],
    ['ftp scheme', 'ftp://example.com/file'],
    ['javascript scheme', 'javascript:alert(1)'],
  ])('rejects %s with 400 INVALID_URL', async (_label, url) => {
    const res = await create(url);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_URL', message: expect.any(String) } });
  });

  it('accepts exactly 2048 characters and rejects 2049', async () => {
    const prefix = 'https://example.com/';
    const ok = prefix + 'a'.repeat(2048 - prefix.length);
    const tooLong = ok + 'a';
    expect(ok.length).toBe(2048);
    expect((await create(ok)).status).toBe(201);
    const res = await create(tooLong);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('rejects malformed JSON with 400 INVALID_URL', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('X-Client-Id', CLIENT_A)
      .set('Content-Type', 'application/json')
      .send('{"url":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it.each([
    ['missing', null],
    ['not a UUID', 'abc'],
  ])('returns 400 MISSING_CLIENT_ID when X-Client-Id is %s', async (_label, id) => {
    const res = await create('https://example.com', id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_CLIENT_ID');
  });

  it('retries on code collision and succeeds', async () => {
    const seq = ['AAAAAAA', 'AAAAAAA', 'BBBBBBB'];
    app = createApp({ db, publicBaseUrl: BASE, generateCode: () => seq.shift()! });
    expect((await create('https://a.example')).body.code).toBe('AAAAAAA');
    const res = await create('https://b.example');
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('BBBBBBB');
  });

  it(`returns 500 INTERNAL after ${MAX_CODE_ATTEMPTS} collisions`, async () => {
    let calls = 0;
    app = createApp({
      db,
      publicBaseUrl: BASE,
      generateCode: () => {
        calls++;
        return 'CCCCCCC';
      },
    });
    expect((await create('https://a.example')).status).toBe(201);
    calls = 0;
    const res = await create('https://b.example');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(calls).toBe(MAX_CODE_ATTEMPTS);
  });
});

describe('GET /api/links', () => {
  it('lists only the caller’s links, newest first', async () => {
    const first = await create('https://one.example', CLIENT_A);
    await new Promise((r) => setTimeout(r, 5));
    const second = await create('https://two.example', CLIENT_A);
    await create('https://other.example', CLIENT_B);

    const res = await request(app).get('/api/links').set('X-Client-Id', CLIENT_A);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { code: string }) => i.code)).toEqual([
      second.body.code,
      first.body.code,
    ]);
    expect(res.body.items[0]).toEqual({
      code: second.body.code,
      shortUrl: `${BASE}/${second.body.code}`,
      url: 'https://two.example',
      createdAt: second.body.createdAt,
    });

    const resB = await request(app).get('/api/links').set('X-Client-Id', CLIENT_B);
    expect(resB.body.items).toHaveLength(1);
    expect(resB.body.items[0].url).toBe('https://other.example');
  });

  it('returns an empty list for a new client', async () => {
    const res = await request(app).get('/api/links').set('X-Client-Id', CLIENT_B);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('returns 400 MISSING_CLIENT_ID without the header', async () => {
    const res = await request(app).get('/api/links');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_CLIENT_ID');
  });
});

describe('GET /:code', () => {
  it('redirects 302 to the original URL', async () => {
    const { body } = await create('https://example.com/target');
    const res = await request(app).get(`/${body.code}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/target');
  });

  it('returns 404 NOT_FOUND for an unknown code', async () => {
    const res = await request(app).get('/Zz9Zz9Z');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', 'abcdefgh', 'abc-def', 'abc%20de'])(
    'returns 404 NOT_FOUND for malformed code %s',
    async (code) => {
      const res = await request(app).get(`/${code}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    },
  );
});
