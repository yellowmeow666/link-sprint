import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { Db, LinkRow } from './db.js';
import { CODE_PATTERN, generateCode as defaultGenerateCode } from './code.js';
import { isValidClientId, normalizeUrl } from './validate.js';
import { sendError } from './errors.js';

export interface CreateAppOptions {
  db: Db;
  generateCode?: () => string;
  publicBaseUrl?: string;
}

/** 首次尝试 1 次，撞码后最多再重试 5 次，共调用 generateCode 至多 6 次。 */
export const MAX_CODE_RETRIES = 5;
export const MAX_CODE_ATTEMPTS = 1 + MAX_CODE_RETRIES;

interface LinkDto {
  code: string;
  shortUrl: string;
  url: string;
  createdAt: string;
}

export function createApp({
  db,
  generateCode = defaultGenerateCode,
  publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
}: CreateAppOptions): express.Express {
  const baseUrl = publicBaseUrl.replace(/\/+$/, '');
  const toDto = (row: LinkRow): LinkDto => ({
    code: row.code,
    shortUrl: `${baseUrl}/${row.code}`,
    url: row.url,
    createdAt: row.createdAt,
  });

  const insert = db.prepare(
    'INSERT INTO links (code, url, client_id, created_at) VALUES (?, ?, ?, ?)',
  );
  const listByClient = db.prepare(
    `SELECT code, url, client_id AS clientId, created_at AS createdAt
       FROM links WHERE client_id = ?
      ORDER BY created_at DESC, id DESC`,
  );
  const findByCode = db.prepare('SELECT url FROM links WHERE code = ?');

  const app = express();
  app.disable('x-powered-by');
  app.use('/api', express.json({ limit: '16kb' }));

  const requireClientId = (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.get('X-Client-Id');
    if (!isValidClientId(clientId)) {
      sendError(res, 'MISSING_CLIENT_ID');
      return;
    }
    res.locals.clientId = clientId;
    next();
  };

  app.post('/api/links', requireClientId, (req, res) => {
    const url = normalizeUrl((req.body as { url?: unknown } | undefined)?.url);
    if (url === null) {
      sendError(res, 'INVALID_URL');
      return;
    }
    const clientId = res.locals.clientId as string;
    const createdAt = new Date().toISOString();

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      try {
        insert.run(code, url, clientId, createdAt);
        res.status(201).json(toDto({ code, url, clientId, createdAt }));
        return;
      } catch (err) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') continue;
        throw err;
      }
    }
    sendError(res, 'INTERNAL');
  });

  app.get('/api/links', requireClientId, (_req, res) => {
    const rows = listByClient.all(res.locals.clientId as string) as LinkRow[];
    res.json({ items: rows.map(toDto) });
  });

  app.get('/:code', (req, res) => {
    const { code } = req.params;
    if (!CODE_PATTERN.test(code)) {
      sendError(res, 'NOT_FOUND');
      return;
    }
    const row = findByCode.get(code) as { url: string } | undefined;
    if (!row) {
      sendError(res, 'NOT_FOUND');
      return;
    }
    res.redirect(302, row.url);
  });

  app.use((_req, res) => sendError(res, 'NOT_FOUND'));

  // Express error handler (4 args required). Malformed JSON bodies count as invalid input.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number };
    if (e.type === 'entity.parse.failed' || e.type === 'entity.too.large') {
      sendError(res, 'INVALID_URL');
      return;
    }
    console.error(err);
    sendError(res, 'INTERNAL');
  });

  return app;
}
