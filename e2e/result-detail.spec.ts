import { test, expect, type Page } from '@playwright/test'

/**
 * Result Detail E2E 测试 — 真实后端
 * ================================
 * 结果详情页 /workspace/results
 *
 * 依赖：workspace 中有至少一个已完成的进程
 */

/** 用真实鼠标点击 ECharts 谱图 canvas */
async function clickSpectrum(page: Page) {
  // 从 Average Spectrum 标题找到谱图容器
  const heading = page.getByText('Average Spectrum')
  // 结构：h3 → div → div.header → div.root → .overflow-hidden
  const chart = heading.locator('..').locator('..').locator('..').locator('.overflow-hidden')

  const box = await chart.boundingBox()
  if (!box) throw new Error('Spectrum chart bounding box not found')

  // grid.left=64，点中心偏右
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4)
}

test.describe('Result Detail', () => {

  test('shows stale state when accessed directly', async ({ page }) => {
    await page.goto('/workspace/results')
    await expect(page.getByText('No result selected')).toBeVisible()
  })

  test('loads ion image, spectrum, metadata, and responds to click', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })

    const completedRow = page.locator('table tr').filter({ hasText: 'Completed' }).first()
    await expect(completedRow).toBeVisible({ timeout: 10_000 })

    await completedRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/workspace\/results/)

    // header
    await expect(page.locator('h1')).not.toBeEmpty()
    await expect(page.getByText('completed')).toBeVisible()

    // ion image + spectrum 加载完成
    await expect(page.getByText('Loading ion image...')).not.toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Loading average spectrum...')).not.toBeVisible({ timeout: 30_000 })

    // 平均谱图
    await expect(page.getByText('Average Spectrum')).toBeVisible()
    await expect(page.getByText(/peaks/)).toBeVisible()

    // 右侧 ColorBar 元数据（zarr 加载可能较慢）
    await expect(page.getByText('Polarity')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Analyzer')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Ionisation Source')).toBeVisible({ timeout: 15_000 })

    // 用真实鼠标点击谱图选 m/z
    await page.waitForTimeout(1000)
    await clickSpectrum(page)
    await page.waitForTimeout(1000)
    // 等 ion image 响应（如果有变化会重新加载）
    await expect(page.getByText('Loading ion image...')).not.toBeVisible()
    await page.waitForTimeout(1000)

    // 确认点击后页面没崩：谱图在、ion image 没退到 Loading
    await expect(page.getByText('Average Spectrum')).toBeVisible()
    await expect(page.getByText('Loading ion image...')).not.toBeVisible()
  })

  test('switches colormap and keeps ion image stable', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })

    const completedRow = page.locator('table tr').filter({ hasText: 'Completed' }).first()
    await expect(completedRow).toBeVisible({ timeout: 10_000 })
    await completedRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/workspace\/results/)

    await expect(page.getByText('Loading ion image...')).not.toBeVisible({ timeout: 30_000 })

    // 切换到 Viridis
    const colormapSelect = page.locator('select').first()
    await colormapSelect.selectOption('viridis')
    await page.waitForTimeout(500)

    // ion image 没崩
    await expect(page.getByText('Loading ion image...')).not.toBeVisible()
  })
})

// ============================================================
// Cleanup
// ============================================================

test.describe('Cleanup', () => {

  test('delete completed result', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })

    const openModal = page.locator('dialog.modal-open')
    if (await openModal.isVisible().catch(() => false)) {
      await openModal.getByRole('button').first().click()
    }

    await page.locator('table tbody tr').first()
      .getByRole('button', { name: 'Delete' })
      .click()

    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText('Result deleted', { timeout: 10_000 })
  })
})
