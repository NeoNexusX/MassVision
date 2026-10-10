import { test, expect } from '@playwright/test'

/**
 * 首页 E2E 测试
 * ============
 * 首页为公开页（无需登录），由 4 个滚动场景组成：
 *   Hero → Features → Stats → Footer
 * 页面使用 scroll-snap，每个场景占满视口。
 *
 * 首页内容来自 public/content.json + 后端 /stats/* 接口。
 * 后端不可用时，Stats 卡片标题仍然渲染，数字显示 loading 或 error。
 */

// ── Hero（首屏，无后端依赖）──

test('hero scene renders with title and join button', async ({ page }) => {
  await page.goto('/')

  // 页面根容器挂载
  await expect(page.locator('[aria-label="MassVision home scenes"]')).toBeVisible()

  // Hero 场景可见
  await expect(page.locator('#hero')).toBeVisible()

  // "Join to start" 按钮（已登录时不跳 /register，路由守卫会踢到 /profile）
  await expect(page.locator('a:has-text("Join to start")')).toBeVisible()

  // 向下滚动提示箭头
  await expect(page.locator('.scroll-cue')).toBeVisible()
})

// ── Features（第 2 屏，内容来自 public/content.json）──

test('features scene renders gallery and switches card on hover', async ({ page }) => {
  await page.goto('/')

  // 期望词表不硬编码：读与页面同源的 content.json（与 per-page 用例读 config.json 同法）
  const content = await (await page.request.get('/content.json')).json()
  const words: string[] = content.features.items.map((it: { word: string }) => it.word)
  const titles: string[] = content.features.items.map(
    (it: { title: { en: string } }) => it.title.en,
  )

  await page.locator('#features').scrollIntoViewIfNeeded()

  // 画廊词全部渲染；介绍卡默认显示第一项的标题（active=0）。
  // 词用 .first()：激活项的词同时出现在画廊格和下方介绍卡的 h3 里，双命中会炸 strict mode
  const scene = page.locator('#features')
  for (const word of words) {
    await expect(scene.getByText(word, { exact: true }).first()).toBeVisible()
  }
  await expect(scene.getByText(titles[0]!)).toBeVisible()

  // 悬停第二个词所在格 → 联动切换介绍卡（Transition out-in 换标题）
  await scene.getByText(words[1]!, { exact: true }).first().locator('..').hover()
  await expect(scene.getByText(titles[1]!)).toBeVisible({ timeout: 5_000 })
})

// ── Stats（第 3 屏，有后端数据 /stats/*）──

test('stats scene shows section heading and stat card labels', async ({ page }) => {
  await page.goto('/')

  // 滚动到 Stats 场景
  await page.locator('#stats').scrollIntoViewIfNeeded()

  // 标题
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()

  // 四个环形图卡片标题（固定文本，不依赖后端数据）
  for (const title of ['Organism', 'Organism Parts', 'Ion Source Types', 'Analyzer']) {
    await expect(page.locator('text=' + title).first()).toBeVisible()
  }

  // 四张 stat 卡片标题（固定文本）
  for (const title of ['Total Users', 'Total Datasets', 'Total Downloads', 'Website Visits']) {
    await expect(page.getByText(title)).toBeVisible()
  }

  // 数据加载完成 → 卡片数字有值（等待 loading spinner 消失）
  await expect(page.locator('.stat-value .loading')).toHaveCount(0)

  // 每张 stat 卡片旁边有数字
  const values = page.locator('.stat-value')
  for (let i = 0; i < 4; i++) {
    await expect(values.nth(i)).toContainText(/\d/)
  }
})

// ── Footer（末屏，无后端依赖）──

test('footer shows team info, powered by, and copyright', async ({ page }) => {
  await page.goto('/')

  // 滚动到底部（scroll-snap 页面，用键盘 End 键滚到底）
  await page.locator('.home-scroll').press('End')
  await page.waitForTimeout(500)

  // 团队标题
  await expect(page.getByText('The Team')).toBeVisible()
  await expect(page.getByText('Built by people who love science and engineering.')).toBeVisible()

  // Powered by
  await expect(page.getByText('Powered by')).toBeVisible()

  // 版权（年份动态，只断言固定部分）
  await expect(page.getByText('All rights reserved by Bionet')).toBeVisible()
})
