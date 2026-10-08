import { expect, test } from '@playwright/test';

// 验收 7 的完整流程：提交、复制、访问跳转、出现在列表。
// 选择器以前端约定的 data-testid 为准，见 tests/README.md。
test('提交长链接、复制短链、访问跳转、出现在我的列表', async ({ page, request }) => {
  const target = `https://example.com/e2e-${Date.now()}`;

  await page.goto('/');
  await page.getByTestId('url-input').fill(target);
  await page.getByTestId('submit-button').click();

  const shortUrlEl = page.getByTestId('short-url');
  await expect(shortUrlEl).toBeVisible();
  const shortUrl = (await shortUrlEl.textContent())?.trim() ?? '';
  expect(shortUrl).toMatch(/\/[0-9A-Za-z]{7}$/);

  await page.getByTestId('copy-button').click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(shortUrl);

  const res = await request.get(shortUrl, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toBe(target);

  const firstRow = page.getByTestId('link-list').getByTestId('link-item').first();
  await expect(firstRow.getByTestId('link-short-url')).toHaveText(shortUrl);
  await expect(firstRow.getByTestId('link-original-url')).toHaveText(target);
});

test('非法链接显示可读错误', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('error-message')).toHaveCount(0);
  await page.getByTestId('url-input').fill('ftp://example.com');
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('error-message')).toBeVisible();
  await expect(page.getByTestId('error-message')).not.toBeEmpty();
});
