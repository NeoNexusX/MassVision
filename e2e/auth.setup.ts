import { test as setup } from '@playwright/test'

/**
 * Auth Setup — 全局登录初始化
 * ============================
 * 在所有测试之前运行（playwright.config.ts 中 setup project），
 * 只跑一次，用真实账号登录后把 token/localStorage/cookie 保存到 .auth/user.json。
 *
 * 使用场景：
 *   - Authenticated 组的测试通过 storageState: '.auth/user.json' 复用此登录态
 *   - Unauthenticated 组的测试通过 storageState: { cookies: [], origins: [] } 清除
 *
 * .auth/ 目录已加入 .gitignore，不会提交。
 */
setup('authenticate', async ({ page }) => {
  await page.goto('/login')

  await page.fill('input[placeholder="Username"]', 'linyk')
  await page.fill('input[placeholder="Password"]', 'linyk123s')

  await page.click('button:has-text("Sign In")')

  // 等待登录完成并跳转到 /profile
  await page.waitForURL('/profile')
  await page.waitForLoadState('networkidle')

  // 保存浏览器状态（token、localStorage、cookie）供后续测试复用
  await page.context().storageState({ path: '.auth/user.json' })
})
