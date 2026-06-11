import { test, expect } from '@playwright/test';

// 首页（/）渲染场景式滚动容器 HomeView.vue，其根节点带 aria-label="MassVision home scenes"。
// 不断言具体文案（hero taglines 会轮播），只验证应用成功 bootstrap 并挂载首页。
test('visits the app root url', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[aria-label="MassVision home scenes"]')).toBeVisible();
})
