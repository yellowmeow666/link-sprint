import request from 'supertest';
import { createApp } from '../../backend/src/app.js';
import { openDb } from '../../backend/src/db.js';

export const BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
export const CODE_RE = /^[0-9A-Za-z]{7}$/;

export const CLIENT_A = '11111111-1111-4111-8111-111111111111';
export const CLIENT_B = '22222222-2222-4222-8222-222222222222';

/** 每个用例一份独立的内存库，互不影响。 */
export function makeApp(generateCode?: () => string) {
  const db = openDb(':memory:');
  const app = generateCode ? createApp({ db, generateCode }) : createApp({ db });
  return { app, db };
}

/** 依次返回给定短码，用完后一直返回最后一个；calls 记录被调用次数。 */
export function sequence(...codes: string[]) {
  const state = { calls: 0 };
  const fn = () => {
    const code = codes[Math.min(state.calls, codes.length - 1)];
    state.calls += 1;
    return code;
  };
  return Object.assign(fn, { state });
}

export function create(app: Parameters<typeof request>[0], url: unknown, clientId: string | null = CLIENT_A) {
  const req = request(app).post('/api/links').set('Content-Type', 'application/json');
  if (clientId !== null) req.set('X-Client-Id', clientId);
  return req.send(url === undefined ? {} : { url });
}

export function list(app: Parameters<typeof request>[0], clientId: string | null = CLIENT_A) {
  const req = request(app).get('/api/links');
  if (clientId !== null) req.set('X-Client-Id', clientId);
  return req;
}


export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
