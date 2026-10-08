import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

export interface LinkRow {
  code: string;
  url: string;
  clientId: string;
  createdAt: string;
}

export function openDb(dbPath: string): Db {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       TEXT    NOT NULL UNIQUE,
      url        TEXT    NOT NULL,
      client_id  TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_links_client_created
      ON links (client_id, created_at DESC, id DESC);
  `);
  return db;
}
