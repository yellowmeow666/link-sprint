# link-sprint backend

Express + TypeScript + SQLite（`better-sqlite3`）实现的短链服务端。

## 环境要求

- Node.js 20（CI 同版本）
- npm 10（Node 20 自带）

`better-sqlite3` 锁定在 `12.9.0`：12.10 起不再提供 Node 20 预编译包，升级前请先确认 CI 的 Node 版本。

## 本地启动

```bash
cd backend
npm ci
npm run dev        # tsx watch，默认 http://localhost:3000
```

生产方式：`npm run build && npm start`。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 监听端口 |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | 拼接 `shortUrl` 的前缀，末尾斜杠会被去掉 |
| `DATABASE_PATH` | `data/links.db`（相对 `backend/`） | SQLite 文件路径，目录不存在会自动创建；测试用 `:memory:` |

参考 `.env.example`。服务不会自动读取 `.env` 文件，需要时在命令前设置，例如 `PORT=4000 npm run dev`。

## 脚本

| 脚本 | 作用 |
|---|---|
| `npm run lint` | ESLint + `tsc --noEmit` 类型检查 |
| `npm test` | Vitest + supertest，全部用内存库 |
| `npm run build` | 编译到 `dist/` |

## 接口

所有错误统一返回 `{ "error": { "code", "message" } }`。

| 方法与路径 | 说明 |
|---|---|
| `POST /api/links` | 请求头 `X-Client-Id`（UUID），请求体 `{ "url" }`。成功 201，返回 `{ code, shortUrl, url, createdAt }` |
| `GET /api/links` | 请求头 `X-Client-Id`。返回 200 `{ items: [...] }`，只含该 ID 创建的记录，按创建时间倒序 |
| `GET /:code` | `code` 须匹配 `^[0-9A-Za-z]{7}$`。存在则 302 跳转，否则 404 |

错误码：`INVALID_URL`（400）、`MISSING_CLIENT_ID`（400）、`NOT_FOUND`（404）、`INTERNAL`（500）。

链接校验：去掉首尾空格后，须能被 `new URL` 解析，协议为 http 或 https，长度不超过 2048（2048 合法，2049 非法）。请求体不是合法 JSON 时也按 `INVALID_URL` 处理。

## 供测试导入

```ts
import { createApp } from './src/app.js';
import { openDb } from './src/db.js';

const app = createApp({
  db: openDb(':memory:'),          // better-sqlite3 Database，openDb 负责建表
  generateCode: () => 'AAAAAAA',   // 可选，默认加密随机 7 位
  publicBaseUrl: 'http://x.test',  // 可选，默认读 PUBLIC_BASE_URL
});
```

`createApp` 不监听端口，监听在 `src/server.ts`。撞码时首次尝试 1 次、再最多重试 5 次（共调用 `generateCode` 至多 6 次），6 次全冲突返回 500 `INTERNAL`。
