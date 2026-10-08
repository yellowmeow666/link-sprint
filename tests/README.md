# tests

测试工程师维护的测试目录，只放测试代码，不改 `frontend/` 和 `backend/`。

## 接口测试（CI 必过）

在进程内导入 `backend/src/app.ts` 的 `createApp` 和 `backend/src/db.ts` 的 `openDb`，每个用例使用独立的 `:memory:` 数据库，不需要启动服务。

```bash
cd backend && npm ci && cd ../tests && npm ci && npm run test:api
```

覆盖：创建（合法、非法、长度边界 2048/2049、缺少或非法 `X-Client-Id`、重复长链接）、撞码重试与 500、我的列表（倒序、字段、两个 ID 互相不可见）、跳转（302、404、大小写、格式不符的路径）。

## 端到端冒烟（不进必过门禁）

先按根目录 README 启动后端（3000）和前端（5173），然后：

```bash
cd tests && npx playwright install chromium && npm run test:e2e
```

前端需要提供这些 `data-testid`：`url-input`、`submit-button`、`short-url`、`copy-button`、`error-message`、`link-list`、`link-item`，以及每条记录里的 `link-short-url`、`link-original-url`。
