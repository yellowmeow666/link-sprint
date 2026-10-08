import type { Response } from 'express';

export type ErrorCode =
  | 'INVALID_URL'
  | 'MISSING_CLIENT_ID'
  | 'NOT_FOUND'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  INVALID_URL: 400,
  MISSING_CLIENT_ID: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

const MESSAGE: Record<ErrorCode, string> = {
  INVALID_URL: 'url must be an http(s) URL of at most 2048 characters',
  MISSING_CLIENT_ID: 'X-Client-Id header must be a UUID',
  NOT_FOUND: 'not found',
  INTERNAL: 'internal server error',
};

export function sendError(res: Response, code: ErrorCode, message?: string): void {
  res.status(STATUS[code]).json({ error: { code, message: message ?? MESSAGE[code] } });
}
