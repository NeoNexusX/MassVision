import { test, expect } from '@playwright/test'

/**
 * Auth E2E 测试
 * =============
 * 覆盖登录、注册校验、忘记密码、Profile 页面、路由守卫。
 *
 * 架构：
 *   auth.setup.ts  → 先登录一次，存入 .auth/user.json
 *   Unauthenticated → 清除 storageState，模拟未登录（登录、注册、忘记密码测试）
 *   Authenticated   → 复用 .auth/user.json，直接进已登录页面（Profile、弹窗校验）
 *
 * 测试环境：
 *   本地：npm run dev  → Vite proxy /api/* → .env.development 中的 VITE_BACKEND_URL
 *   CI：  npm run preview → Vite proxy /api/* → .env.production 中的 VITE_BACKEND_URL
 *
 * 需后端：登录、Profile 数据加载、Profile 保存
 * 纯前端：注册校验、忘记密码校验、弹窗校验（不提交，只测前端逻辑）
 *
 */

// ============================================================
// 组 1：未登录状态（清除 storageState → 模拟新用户）
// ============================================================

test.describe('Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  // ── 登录 ──
  // 账号密码与 auth.setup.ts 保持一致，从环境变量读取（CI: GitHub Secrets，本地: .env.local）

  test('can login with valid credentials', async ({ page }) => {
    const username = process.env.E2E_USERNAME
    const password = process.env.E2E_PASSWORD
    if (!username || !password) {
      throw new Error('缺少 E2E_USERNAME / E2E_PASSWORD 环境变量，请在 CI secrets 或本地 .env.local 中配置')
    }

    await page.goto('/login')

    await page.fill('input[placeholder="Username"]', process.env.E2E_USERNAME!)
    await page.fill('input[placeholder="Password"]', process.env.E2E_PASSWORD!)

    await page.click('button:has-text("Sign In")')

    // 成功 toast + 跳转 /profile
    await expect(page.locator('.toast')).toContainText('Login successful')
    await expect(page).toHaveURL('/profile')
  })

  test('shows error with invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[placeholder="Username"]', 'nonexistent_user_12345')
    await page.fill('input[placeholder="Password"]', 'wrongpassword')

    await page.click('button:has-text("Sign In")')

    // 后端返回 "Incorrect username or password"
    await expect(page.locator('.toast')).toContainText('Incorrect')
  })

  test('route guard — redirects to login when accessing protected page', async ({ page }) => {
    await page.goto('/profile')

    // 未登录 → 踢到 /login，URL 带 redirect 参数
    await expect(page).toHaveURL(/\/login/)
    await expect(page.url()).toContain('redirect=')
  })

  // ── 注册页表单校验（不提交，不调后端）──

  test('register form — validates password mismatch', async ({ page }) => {
    await page.goto('/register')

    await page.fill('input[placeholder="Password"]', 'StrongPass1')
    await page.fill('input[placeholder="Confirm Password"]', 'DifferentPass2')
    await page.locator('input[placeholder="Confirm Password"]').blur()

    // 两次密码不一致 → 行内错误
    await expect(page.getByText('Passwords do not match')).toBeVisible()
  })

  test('register form — shows password strength meter', async ({ page }) => {
    await page.goto('/register')

    // 8 位纯小写字母 → score=1 → "Very Weak"
    await page.fill('input[placeholder="Password"]', 'abcdefgh')
    await expect(page.getByText('Very Weak')).toBeVisible()

    // 12+ 位含大小写+数字+特殊字符 → score=5 → "Strong"
    await page.fill('input[placeholder="Password"]', 'VeryStr0ng!Pass')
    await expect(page.getByText('Strong')).toBeVisible()
  })

  test('register form — validates ORCID format', async ({ page }) => {
    await page.goto('/register')

    // ORCID 在右侧栏，需先滚动到可见
    const orcidInput = page.locator('input[placeholder="ORCID (Optional)"]')
    await orcidInput.scrollIntoViewIfNeeded()
    await orcidInput.fill('bad-format')
    await orcidInput.blur()

    // 非法格式 → 行内错误，完整提示含示例
    await expect(page.getByText('Invalid ORCID format (e.g. 0000-0000-0000-0000)')).toBeVisible()
  })

  test('register form — requires account info before sending code', async ({ page }) => {
    await page.goto('/register')

    // 账号信息没填完就点发送验证码
    await page.click('button:has-text("Send Code")')

    // toast 提示先填完账号信息
    await expect(page.locator('.toast')).toContainText('complete the account information')
  })

  // ── 忘记密码页校验（不提交，不调后端）──

  test('forgot password — validates invalid email', async ({ page }) => {
    await page.goto('/forgotpassword')

    await page.fill('input[placeholder="Email"]', 'not-an-email')
    await page.locator('input[placeholder="Email"]').blur()
    await page.click('button:has-text("Send Verification Code")')

    // 非法邮箱格式 → toast
    await expect(page.locator('.toast')).toContainText('valid email')
  })
})

// ============================================================
// 组 2：已登录状态（auth.setup.ts 已注入 token）
// ============================================================

test.describe('Authenticated', () => {

  // ── Profile 页面 ──

  test('profile page loads user data after login', async ({ page }) => {
    await page.goto('/profile')

    // 验证 Profile 页核心区块渲染（数据来自真实后端 /api/user）
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible()
    await expect(page.locator('text=Quota Usage')).toBeVisible()
    await expect(page.locator('text=Academic Profile')).toBeVisible()
  })

  test('can edit academic profile and save', async ({ page }) => {
    // ⚠️ 此测试会通过 POST /api/user_change 真实写入数据库
    await page.goto('/profile')

    await page.fill('input[placeholder="University Name"]', 'Test University')
    await page.fill('input[placeholder="e.g. Computer Vision"]', 'Testing')

    await page.click('button:has-text("Save All Changes")')

    // 保存成功 → toast
    await expect(page.locator('.toast')).toContainText('Profile info updated')
  })

  // ── 路由守卫 + 持久化 ──

  test('route guard — visiting /login redirects to /profile', async ({ page }) => {
    await page.goto('/profile')    // 确保已登录
    await page.goto('/login')

    // 已登录 → 踢回 /profile
    await expect(page).toHaveURL('/profile')
  })

  test('token persistence — survives page reload', async ({ page }) => {
    await page.goto('/profile')
    await page.reload()
    await page.waitForURL('/profile')

    // token 从 localStorage 恢复，仍然在 /profile
    await expect(page).toHaveURL('/profile')
    await expect(page.locator('text=Quota Usage')).toBeVisible()
  })

  // ── 邮箱弹窗（不提交，只测前端校验）──

  test('change email modal — validates empty fields', async ({ page }) => {
    await page.goto('/profile')

    // 打开弹窗
    await page.click('button:has-text("Change Email")')
    await expect(page.locator('h3:has-text("Change Email")')).toBeVisible()

    // 不填内容直接点 Confirm
    await page.click('.modal-box button:has-text("Confirm")')
    await expect(page.locator('.toast')).toContainText('Please enter new email')
  })

  // ── 密码弹窗（不提交，只测前端校验）──

  test('change password modal — validates mismatch', async ({ page }) => {
    await page.goto('/profile')

    await page.click('button:has-text("Change Password")')
    await expect(page.locator('h3:has-text("Change Password")')).toBeVisible()

    // 两次密码不一致
    await page.fill('.modal-box input[placeholder="Enter new password"]', 'StrongPass1')
    await page.fill('.modal-box input[placeholder="Re-enter new password"]', 'DifferentPass2')

    // 确认按钮被禁用 + 行内不匹配提示
    const confirmBtn = page.locator('.modal-box .modal-action button:has-text("Change Password")')
    await expect(confirmBtn).toBeDisabled()
    await expect(page.locator('text="Passwords do not match"')).toBeVisible()
  })

  test('change password modal — shows strength meter', async ({ page }) => {
    await page.goto('/profile')

    await page.click('button:has-text("Change Password")')

    // 弱密码 → "Very Weak"
    await page.fill('.modal-box input[placeholder="Enter new password"]', 'abcdefgh')
    await expect(page.getByText('Very Weak')).toBeVisible()

    // 强密码 → "Strong"
    await page.fill('.modal-box input[placeholder="Enter new password"]', 'VeryStr0ng!Pass')
    await expect(page.getByText('Strong')).toBeVisible()
  })
})
