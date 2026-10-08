import { defineConfig, devices } from '@playwright/test';

// 冒烟测试默认连接已经按 README 启动好的前后端：前端 5173，后端 3000。
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_FRONTEND_URL ?? 'http://localhost:5173',
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
