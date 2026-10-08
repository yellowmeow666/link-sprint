# 短链前端

React + Vite + TypeScript。页面负责创建短链、复制结果，以及列出当前浏览器创建过的记录。

## 环境

- Node.js 20
- npm

## 安装

```bash
npm ci
```

## 本地开发

后端需要先在 **3000** 端口运行。然后在 `frontend/` 目录执行：

```bash
npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)。Vite 只把 `/api` 代理到 `http://localhost:3000`，页面请求使用相对路径 `/api/...`。

## 检查

```bash
npm test
npm run lint
npm run build
```

`npm test` 使用 Vitest 的非 watch 模式（`vitest run`）。
