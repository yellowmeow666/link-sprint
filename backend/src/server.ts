import { createApp } from './app.js';
import { openDb } from './db.js';

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? 'data/links.db';

const db = openDb(dbPath);
const app = createApp({ db });

app.listen(port, () => {
  console.log(`link-sprint backend listening on http://localhost:${port} (db: ${dbPath})`);
});
