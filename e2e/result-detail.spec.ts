import { test, expect, type Page } from '@playwright/test'

/**
 * Result Detail E2E 测试 — 真实后端
 * ================================
 * 结果详情页 /workspace/results
 *
 * 依赖：workspace 中有至少一个已完成的进程
 *
 * 跨文件依赖：这个"已完成的进程"由 new-analysis.spec.ts 最后一个测试
 * （"submit, wait for completion, then delete"）创建并等待完成，但那个测试本身
 * 不删除它——本文件的测试直接查看/操作"当前最新的 Completed 结果"，
 * 最后由本文件末尾的 "Cleanup > delete completed result" 统一删除。
 * 必须两个文件一起跑（按文件名字母序，new-analysis 在本文件之前）才是完整链路。
 * 如果单独只跑本文件，Cleanup 会删除 Workspace 里"当前最新的 Completed 结果"——
 * 若没有 new-analysis 留下的任务，可能会误删真实数据，请勿单独运行本文件。
 */

/** 用真实鼠标点击 ECharts 谱图 canvas */
async function clickSpectrum(page: Page, xRatio = 0.6) {
  // 从 Average Spectrum 标题找到谱图容器
  const heading = page.getByRole('heading', { name: 'Average Spectrum' })
  // 结构：h3 → div → div.header → div.root → .overflow-hidden
  const chart = heading.locator('..').locator('..').locator('..').locator('.overflow-hidden')

  const box = await chart.boundingBox()
  if (!box) throw new Error('Spectrum chart bounding box not found')

  // grid.left=64，点中心偏右
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * 0.4)
}

test.describe('Result Detail', () => {
  test('shows stale state when accessed directly', async ({ page }) => {
    await page.goto('/workspace/results')
    await expect(page.getByText('No result selected')).toBeVisible()
  })

  test('loads ion image, spectrum, metadata, and responds to click', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first()).not.toHaveText(
      'Loading...',
      { timeout: 10_000 },
    )

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
    await expect(page.getByRole('heading', { name: 'Average Spectrum' })).toBeVisible()
    await expect(page.getByText(/peaks/)).toBeVisible()

    // 右侧 ColorBar 元数据（zarr 加载可能较慢）
    await expect(page.getByText('Polarity')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Analyzer')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Ionisation Source')).toBeVisible({ timeout: 10_000 })

    // 用真实鼠标点击谱图两处，确认选中的真实 m/z 确实发生变化。
    const selectedMz = page.getByTestId('selected-mz')
    await page.waitForTimeout(1000)
    await clickSpectrum(page, 0.2)
    const firstSelectedMz = await selectedMz.innerText()
    await clickSpectrum(page, 0.8)
    await expect(selectedMz).not.toHaveText(firstSelectedMz, { timeout: 10_000 })
    // 等 ion image 响应完成，并确认没有进入显式错误态。
    await expect(page.getByTestId('ion-image-section')).toHaveAttribute('data-loading', 'false', {
      timeout: 30_000,
    })
    await expect(page.getByText(/Failed to (load|update) ion image/)).not.toBeVisible()

    // 确认点击后页面没崩：谱图仍在。
    await expect(page.getByRole('heading', { name: 'Average Spectrum' })).toBeVisible()
  })

  test('switches colormap and keeps ion image stable', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first()).not.toHaveText(
      'Loading...',
      { timeout: 10_000 },
    )

    const completedRow = page.locator('table tr').filter({ hasText: 'Completed' }).first()
    await expect(completedRow).toBeVisible({ timeout: 10_000 })
    await completedRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/workspace\/results/)

    await expect(page.getByText('Loading ion image...')).not.toBeVisible({ timeout: 30_000 })

    // 切换到 Viridis
    const colormapSelect = page.getByTestId('colormap-select')
    await colormapSelect.selectOption('viridis')
    await page.waitForTimeout(500)

    // ion image 没崩
    await expect(page.getByText('Loading ion image...')).not.toBeVisible()
  })
})

// ============================================================
// Cleanup
// ============================================================
// 删除 new-analysis.spec.ts 创建的那个任务（见文件头的跨文件依赖说明）。
// 不检查这一行是不是本次测试创建的，只按"最新一行"删，单独运行本文件时有误删真实数据的风险。

test.describe('Cleanup', () => {
  test('delete completed result', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first()).not.toHaveText(
      'Loading...',
      { timeout: 10_000 },
    )

    const openModal = page.locator('dialog.modal-open')
    if (await openModal.isVisible().catch(() => false)) {
      await openModal.getByRole('button').first().click()
    }

    await page.locator('table tbody tr').first().getByRole('button', { name: 'Delete' }).click()

    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText('Result deleted', { timeout: 10_000 })
  })
})
