# link-sprint

短链服务的最小可用版本（MVP）：把一条长链接换成 7 位短码，再通过短码跳回原地址。

## 功能

- 提交一条长 URL，服务端生成 **7 位 base62** 短码。
- 只列出**当前浏览器创建过**的链接。身份是一个匿名 UUID，存在浏览器 `localStorage` 的 `linkSprint.clientId` 键里，每次请求通过 `X-Client-Id` 请求头发给后端。
- 访问后端 `GET /:code`：短码存在则 **302** 跳到目标地址，不存在则 **404**。
- 不包含登录、访问统计、自定义短码。
- 不包含部署。本仓库只覆盖本地开发与 CI。

## 目录

```
.
├── backend/    Node.js + Express + TypeScript，短链 API 与跳转
├── frontend/   React + Vite + TypeScript，创建与列表页面
├── tests/      API 验收测试，以及可选的 Playwright 端到端测试
├── .github/    GitHub Actions CI
├── README.md
└── .gitignore
```

`backend/`、`frontend/`、`tests/` 由对应负责人提交到同一分支 `feat/link-mvp`。

## 环境要求

- Node.js 20
- npm

## 本地运行

开两个终端。

后端（监听 3000）：

```bash
cd backend && npm ci && npm run dev
```

| 环境变量 | 默认值 |
| --- | --- |
| `PORT` | `3000` |
| `PUBLIC_BASE_URL` | `http://localhost:3000` |
| `DATABASE_PATH` | `backend/data/links.db` |

前端（Vite 开发服务器在 5173，并把 `/api` 代理到 3000）：

```bash
cd frontend && npm ci && npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)。

## 测试

在 `backend/` 和 `frontend/` 各自执行：

```bash
npm run lint
npm run test
npm run build
```

API 验收测试需要先装好 `backend/` 的依赖：

```bash
cd tests && npm ci && npm run test:api
```

Playwright 端到端测试是可选项，**不是** CI 门禁。CI 会跑 backend、frontend 的 lint / test / build，以及 `tests` 里的 API 验收测试。

## API

请求创建与列表接口时带上 `X-Client-Id`（即浏览器里的匿名 UUID）。

### 创建短链

`POST /api/links`

```json
{ "url": "https://example.com/very/long/path" }
```

成功 **201**：

```json
{
  "code": "aB3xY9q",
  "shortUrl": "http://localhost:3000/aB3xY9q",
  "url": "https://example.com/very/long/path",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

`code` 为 7 位 base62。`shortUrl` 由 `PUBLIC_BASE_URL` 拼出。

### 列出当前客户端的短链

`GET /api/links`

成功 **200**：

```json
{ "items": [] }
```

`items` 只包含该 `X-Client-Id` 创建过的链接。

### 跳转

`GET /:code`

- 短码存在：**302**，`Location` 为目标 URL。
- 短码不存在：**404**。

### 错误

错误体统一为：

```json
{ "error": { "code": "INVALID_URL", "message": "..." } }
```

| `error.code` | HTTP 状态 |
| --- | --- |
| `INVALID_URL` | 400 |
| `MISSING_CLIENT_ID` | 400 |
| `NOT_FOUND` | 404 |
| `INTERNAL` | 500 |
