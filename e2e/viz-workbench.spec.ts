import { test, expect, type Page } from '@playwright/test'

/**
 * Result Detail E2E 测试 — 真实后端
 * ================================
 * 可视化工作台 /vizworkbench
 *
 * 依赖：workspace 中有至少一个已完成的进程
 *
 * 跨文件依赖：这个"已完成的进程"由 new-analysis.spec.ts 最后一个测试
 * （"submit, wait for completion, then delete"）创建并等待完成，但那个测试本身
 * 不删除它——本文件的测试直接查看/操作"当前最新的 Completed 结果"，
 * 最后由本文件末尾的 "Cleanup > delete completed result" 统一删除。
 * 注意：真实 Peak Alignment 后端任务只在 chromium 创建一次（new-analysis 里同款 skip），
 * 且该任务在 firefox/webkit 后端完成时间不可控（180s 都等不到），故本文件 3 个依赖
 * 真实任务的用例也在 chromium 跑（loads ion image / switches colormap / 以及 Cleanup），
 * firefox/webkit 只覆盖不依赖真实任务的 "shows stale state when accessed directly"。
 * 必须两个文件一起跑（按文件名字母序，new-analysis 在本文件之前）才是完整链路。
 * 如果单独只跑本文件，Cleanup 会删除 Workspace 里"当前最新的 Completed 结果"——
 * 若没有 new-analysis 留下的任务，可能会误删真实数据，请勿单独运行本文件。
 */

/** 用真实鼠标点击 ECharts 谱图 canvas */
async function clickSpectrum(page: Page, xRatio = 0.6) {
  // 谱图容器自带 testid（AverageSpectrum.vue），不要靠 h3 往上数祖先——
  // 标题区一改层级，locator('..') 链就会静默指到别的元素上
  const chart = page.getByTestId('average-spectrum-chart')

  const box = await chart.boundingBox()
  if (!box) throw new Error('Spectrum chart bounding box not found')

  // grid.left=64，点中心偏右
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * 0.4)
}

/**
 * 定位 Workspace 表格里本次 new-analysis submit 创建的那条 Peak Alignment 任务。
 * 必须按 Methods 列 "Peak Alignment" 过滤，不能取第一条 Completed——
 * 残留的 raw-convert（processed）任务没有 selected-mz（仅 continuous 模式渲染），
 * 取错行会让 ion-image/谱图交互断言全部超时。
 */
function peakAlignmentRow(page: Page) {
  return page.locator('table tbody tr').filter({ hasText: 'Peak Alignment' }).first()
}

/**
 * 等待本次 submit 创建的 Peak Alignment 任务从 Running 变为 Completed 可查看。
 * 任务创建后要排队+计算，不会立刻 Completed，10s 内的 toBeVisible 断言会误报。
 * 轮询刷新（与 Cleanup 的等待逻辑一致），直到该行 Status 列变成 Completed。
 * 只等"可查看"（status !== 'processing'）是不够的——Failed 任务也有 View 按钮，
 * 这里要求真正 Completed，进入 viz-workbench 后离子图/谱图断言才成立。
 * 找不到时抛错，跳过静默地把定位失败吞掉——这能让「submit 被 skip / 后端无此数据集」这类真实原因暴露出来。
 */
async function waitForPeakAlignmentReady(page: Page) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const row = peakAlignmentRow(page)
    if ((await row.getByText('Completed').count()) > 0) return row
    await page.reload()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })
    await page.waitForTimeout(5_000)
  }
  throw new Error('Peak Alignment task did not become Completed within 180s')
}

test.describe('Result Detail', () => {
  test('shows stale state when accessed directly', async ({ page }) => {
    await page.goto('/vizworkbench')
    await expect(page.getByText('No result selected')).toBeVisible()
  })

  test('loads ion image, spectrum, metadata, and responds to click', async ({ page, browserName }) => {
    // 依赖 new-analysis.spec.ts 在 chromium 提交的 Peak Alignment 任务。
    // 该任务只在 chromium 创建（new-analysis 做了同款 skip），且真实任务在 firefox/webkit
    // 后端完成时间不可控（180s 都等不到），故这里同样只跑 chromium。
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建，依赖它的断言不跨浏览器')
    test.setTimeout(180_000)
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first()).not.toHaveText(
      'Loading...',
      { timeout: 10_000 },
    )

    // 定位本次 submit 创建的 Peak Alignment 任务（continuous 模式，有 selected-mz）。
    // 任务创建后要排队+计算，不会立刻 Completed，用轮询等它可查看（见 waitForPeakAlignmentReady）。
    const completedRow = await waitForPeakAlignmentReady(page)
    await expect(completedRow).toBeVisible({ timeout: 10_000 })

    await completedRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/vizworkbench/)

    // header
    await expect(page.locator('h1')).not.toBeEmpty()
    await expect(page.getByText('completed')).toBeVisible()

    // ion image + spectrum 加载完成。UI 文案是 "Loading ion image, please wait a moment..."，
    // 用正则前缀匹配，同时兼容旧文案（"Loading ion image..."）。
    await expect(page.getByText(/^Loading ion image/)).not.toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/^Loading average spectrum/)).not.toBeVisible({ timeout: 30_000 })

    // 平均谱图
    await expect(page.getByRole('heading', { name: 'Spectrum View' })).toBeVisible()
    await expect(page.getByText(/peaks/)).toBeVisible()

    // 右侧信息栏元数据（zarr 加载可能较慢）
    await expect(page.getByText('Polarity')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Analyzer')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Ionisation Source')).toBeVisible({ timeout: 10_000 })

    // 用真实鼠标点击谱图两处，确认选中的真实 m/z 确实发生变化。
    // selected-mz 只在 dataMode === 'continuous' 时渲染（zarr 加载完成前不存在），
    // 所以先显式等它出现，再点击谱图。（m/z 框是可填写的搜索输入框，用 inputValue 读取。）
    const selectedMz = page.getByTestId('selected-mz')
    await expect(selectedMz).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1000)
    await clickSpectrum(page, 0.2)
    const firstSelectedMz = await selectedMz.inputValue()
    await clickSpectrum(page, 0.8)
    await expect(selectedMz).not.toHaveValue(firstSelectedMz, { timeout: 10_000 })
    // 等 ion image 响应完成，并确认没有进入显式错误态。
    await expect(page.getByTestId('ion-image-section')).toHaveAttribute('data-loading', 'false', {
      timeout: 30_000,
    })
    await expect(page.getByText(/Failed to (load|update) ion image/)).not.toBeVisible()

    // 确认点击后页面没崩：谱图仍在。
    await expect(page.getByRole('heading', { name: 'Spectrum View' })).toBeVisible()
  })

  test('switches colormap and keeps ion image stable', async ({ page, browserName }) => {
    // 同上：依赖 chromium 提交的 Peak Alignment 任务，二者 skip 保持一致
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建，依赖它的断言不跨浏览器')
    test.setTimeout(180_000)
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first()).not.toHaveText(
      'Loading...',
      { timeout: 10_000 },
    )

    // 同上一个测试：锁定 Peak Alignment（continuous）任务，等它可查看
    const completedRow = await waitForPeakAlignmentReady(page)
    await expect(completedRow).toBeVisible({ timeout: 10_000 })
    await completedRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/vizworkbench/)

    await expect(page.getByText(/^Loading ion image/)).not.toBeVisible({ timeout: 30_000 })

    // 切换到 Viridis（colormap-select 在 ion image 渲染后才存在）
    const colormapSelect = page.getByTestId('colormap-select')
    await expect(colormapSelect).toBeVisible({ timeout: 30_000 })
    await colormapSelect.selectOption('viridis')
    await page.waitForTimeout(500)

    // ion image 没崩
    await expect(page.getByText(/^Loading ion image/)).not.toBeVisible()
  })
})

// ============================================================
// Cleanup
// ============================================================
// 删除 new-analysis.spec.ts 创建的那个任务（见文件头的跨文件依赖说明）。
// 按 Methods 列 "Peak Alignment" 定位本次创建的任务——不能用"第一条 Completed"，
// 工作区里可能残留 raw-convert（processed，无 selected-mz）等其它任务。

test.describe('Cleanup', () => {
  test('delete completed result', async ({ page, browserName }) => {
    // 与 new-analysis submit 对应：任务只在 chromium 建，这里也只在 chromium 删
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建，清理也只在 chromium')
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })

    // 等本次 Peak Alignment 任务跑完（那行 Running 消失），最多 2 分钟。
    // 按 Methods 列定位，不看第一行——第一行可能是别人/并发留下的任务。
    const row = peakAlignmentRow(page)
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      await page.reload()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      await expect(page.locator('table tbody tr').first().locator('td').first())
        .not.toHaveText('Loading...', { timeout: 15_000 })
      if ((await row.getByText('Running').count()) === 0) break
      await page.waitForTimeout(10_000)
    }

    const openModal = page.locator('dialog.modal-open')
    if (await openModal.isVisible().catch(() => false)) {
      await openModal.getByRole('button').first().click()
    }

    // 删除本次创建的 Peak Alignment 任务（Completed）
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.getByRole('button', { name: 'Delete' }).click()

    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText('Result deleted', { timeout: 10_000 })
  })
})
