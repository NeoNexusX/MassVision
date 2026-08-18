import { test, expect, type Page } from '@playwright/test'
import { sizeToMB, ALGO_DATASET_NAMES } from './utils.js'

const MAX_DOWNLOAD_MB = 300

/**
 * 在 /mydatasets 搜索框里随机选一个 ALGO_DATASET_NAMES 中的真实数据集并返回其卡片。
 * 找不到返回 null（调用方据此 test.skip）。
 */
async function findMyDatasetCard(page: Page) {
  const name = ALGO_DATASET_NAMES[Math.floor(Math.random() * ALGO_DATASET_NAMES.length)]!
  const search = page.getByPlaceholder('Search my datasets')
  await search.fill(name)
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
  const card = page
    .locator('h3[aria-label^="Dataset name:"]')
    .filter({ hasText: name })
    .first()
    .locator('..')
    .locator('..')
  if ((await card.count()) > 0) return { card, name }
  return null
}

/** 清空 /mydatasets 搜索框并刷新列表 */
async function resetMyDatasetSearch(page: Page) {
  await page.getByPlaceholder('Search my datasets').fill('')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
}

/** 在 /workspace 等第一行任务不再是 Loading，然后轮询到 Running 消失 */
async function waitForWorkspaceTaskFinished(page: Page, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await page.reload()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })
    const hasRunning = (await page.locator('table').getByText('Running').count()) > 0
    if (!hasRunning) return
    await page.waitForTimeout(10_000)
  }
  throw new Error(`Workspace task still Running after ${timeoutMs / 1000}s`)
}

/**
 * Datasets E2E 测试 — 真实后端
 * ==============================
 * PublicDatasets：公开页 /datasets（依赖已有公开数据）
 * MyDatasets：需登录 /mydatasets（基于后端已有真实数据集）
 */

// ============================================================
// My Datasets（需登录，基于后端已有真实数据集）
// ============================================================

test.describe('My Datasets', () => {

  /**
   * 页面加载：quota bar + 数据集卡片
   */
  test('page loads with quota bar and dataset cards', async ({ page }) => {
    await page.goto('/mydatasets')

    await expect(page.locator('h1:has-text("My Datasets")')).toBeVisible()
    await expect(page.getByPlaceholder('Search my datasets')).toBeVisible()

    await expect(page.getByText(/Storage \d/)).toBeVisible()
    await expect(page.getByText(/Files \d/)).toBeVisible()
    await expect(page.getByText(/Processing \d/)).toBeVisible()
    await expect(page.getByText(/Downloads \d/)).toBeVisible()

    await expect(page.getByRole('button', { name: 'Upload New Dataset' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh Status' })).toBeVisible()

    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText('Organism:').first()).toBeVisible()
  })

  /**
   * 卡片状态、可见性、删除按钮
   */
  test('each card shows status, visibility, and delete button', async ({ page }) => {
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await expect(
      page.locator('button, div').filter({ hasText: /Uploaded|Uploading|Failed/ }).first()
    ).toBeVisible()

    await expect(
      page.locator('button, div').filter({ hasText: /Public|Private/ }).first()
    ).toBeVisible()

    await expect(page.getByRole('button', { name: 'Delete' }).first()).toBeVisible()
  })

  /**
   * 随机下载一张卡
   */
  test('download — triggers download on a random card', async ({ page }) => {
    test.setTimeout(60_000)  // WebKit 下载偶发较慢
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const downloadBtns = page.locator('button').filter({ hasText: /Download/ })
    await downloadBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await downloadBtns.count()

    // 过滤出文件 < 300MB 的卡片索引
    const eligible: number[] = []
    for (let i = 0; i < count; i++) {
      const card = downloadBtns.nth(i).locator('..').locator('..')
      const sizeText = await card.locator('p:has-text("File Size:")').innerText()
      if (sizeToMB(sizeText) < MAX_DOWNLOAD_MB) eligible.push(i)
    }
    const pick = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : 0

    const card = downloadBtns.nth(pick).locator('..').locator('..')
    const cardName = await card.locator('h3').innerText()
    await expect(card.locator('h3')).not.toBeEmpty()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtns.nth(pick).click(),
    ])

    const filename = download.suggestedFilename()
    expect(filename).toContain(cardName!.replace('Dataset name: ', ''))

    // 清理下载文件（WebKit 偶发超时，忽略）
    try { await download.delete() } catch { /* ok */ }
  })

  test('download rate limit — second download is blocked', async ({ page }) => {
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const btns = page.locator('button').filter({ hasText: /Download/ })
    const count = await btns.count()
    const idx1 = Math.floor(Math.random() * count)
    let idx2: number
    if (count > 1) {
      do { idx2 = Math.floor(Math.random() * count) } while (idx2 === idx1)
    } else {
      idx2 = idx1
    }

    await btns.nth(idx1).click()
    await expect(page.locator('.toast')).toContainText('Download started')
    await page.waitForTimeout(2000)

    await btns.nth(idx2).click()
    await expect(page.locator('.toast')).toContainText(/Download is limited/)
    await page.waitForTimeout(1000)
  })

  /**
   * Overview 跳转并验证内容，再 Back 返回
   */
  test('overview — navigates, shows content, then back', async ({ page }) => {
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const overviewBtns = page.getByRole('button', { name: 'Overview' })
    await overviewBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await overviewBtns.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await overviewBtns.nth(pick).click()
    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()

    const hasContent = await page.getByRole('button', { name: 'Download' }).isVisible().catch(() => false)
    if (hasContent) {
      await expect(page.getByText('Size', { exact: true })).toBeVisible()
      await expect(page.getByText(/Sample Info/)).toBeVisible()
      await expect(page.getByText('File Information')).toBeVisible()
    }

    const backBtn = page.getByRole('button', { name: 'Back to My Datasets' })
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    await expect(page).toHaveURL(/\/mydatasets/)
    await expect(page.getByText('Organism:').first()).toBeVisible()
  })

  /**
   * 排序切换
   */
  test('sort — toggles between submission time and file size', async ({ page }) => {
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const sortSelect = page.locator('select:has(option[value="size_bytes"])')
    await sortSelect.selectOption('size_bytes')
    await page.waitForTimeout(300)

    await expect(page.getByText('Organism:').first()).toBeVisible()
    await expect(page.getByText('File Size:').first()).toBeVisible()
  })

  /**
   * Filter 面板
   */
  test('filter bar — Add filter panel opens', async ({ page }) => {
    await page.goto('/mydatasets')

    await page.getByRole('button', { name: 'Add filter' }).click()

    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
  })

  /**
   * Explore（processed 模式）：二次确认 → Workspace 创建任务（Direct conversion）
   * → 等待完成 → 查看 TIC 图 + 逐像素谱图交互 → 清理 Workspace 中的结果
   *
   * 使用后端真实数据集（ALGO_DATASET_NAMES），不再上传 1KB 合成文件——
   * 合成文件 spectrumList count=0 + 随机 ibd，后端解析必然 Failed。
   */
  test('explore — creates direct-conversion task, verifies TIC image and per-pixel spectrum, then cleans up', async ({ page, browserName }) => {
    // 建任务的重后端操作只在 chromium 跑，firefox/webkit 跑纯 UI 即可，避免重复建任务
    test.skip(browserName !== 'chromium', 'raw-convert 任务只在 chromium 创建一次')
    test.setTimeout(300_000)

    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 按名称锁定真实数据集卡片
    const found = await findMyDatasetCard(page)
    if (!found) {
      test.skip(true, `No ALGO_DATASET_NAMES dataset found on this backend`)
      return
    }
    const { card, name } = found

    // 已转换过的卡按钮是 Visualize（直接跳结果页），只有 Explore 才会弹确认框创建任务
    const exploreBtn = card.getByRole('button', { name: 'Explore' })
    if (!(await exploreBtn.isVisible().catch(() => false))) {
      await resetMyDatasetSearch(page)
      test.skip(true, `"${name}" already has a default run (button is Visualize), cannot re-explore`)
      return
    }
    await exploreBtn.click()

    // 二次确认弹窗（ConfirmDialog: title="Prepare Visualization", confirm-label="Generate"）
    // My Datasets 页面同时挂载了 4 个 ConfirmDialog（Upload/Upload-public/Delete/Explore），
    // 都常驻 DOM 只是靠 class 控制显隐，必须用 .modal-open 限定当前真正打开的那一个
    const openDialog = page.locator('dialog.modal-open .modal-box')
    await expect(openDialog).toContainText('Prepare Visualization')
    await openDialog.getByRole('button', { name: 'Generate' }).click()
    await expect(page.locator('.toast')).toContainText('Task is in progress')

    // 创建者 → 跳转 Workspace
    await expect(page).toHaveURL(/\/workspace(?:\?|#|$)?/, { timeout: 30_000 })
    await expect(page.locator('h1:has-text("Workspace")')).toBeVisible()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })

    // Methods 列显示 "Direct conversion (no preprocessing)"
    const runningRow = page.locator('table tr').filter({ hasText: 'Running' }).first()
    await expect(runningRow).toBeVisible({ timeout: 15_000 })
    await expect(runningRow.locator('td').filter({ hasText: 'Direct conversion' })).toBeVisible()

    // 轮询刷新，等待任务完成（最多 3 分钟）
    await waitForWorkspaceTaskFinished(page, 180_000)
    await expect(page.locator('table').getByText('Running')).not.toBeVisible()
    // Recent Results 里可能已有其他历史 Completed 记录，用 .getByText('Completed') 裸查会撞 strict mode，
    // 直接断言最新（第一行）已经变成 Completed
    await expect(page.locator('table tbody tr').first()).toContainText('Completed')

    // 查看结果（后端按最新在前返回，刚完成的任务在第一行）
    const completedRow = page.locator('table tr').filter({ hasText: 'Completed' }).first()
    await completedRow.getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/workspace\/results/)

    // TIC 图（processed 模式绘图标题）
    await expect(page.getByText('Computing TIC image, please wait a moment...')).not.toBeVisible({ timeout: 30_000 })
    await expect(page.locator('h3:has-text("TIC Image")')).toBeVisible()

    // 点击前：尚未选中像素，显示引导文案
    await expect(page.getByText('Click a pixel on the TIC image to view its spectrum')).toBeVisible()

    const imageContainer = page.getByTestId('ion-image-viewer')

    // 读取真实网格尺寸（ColorBar Statistic 区块的 "Dimensions" 行，格式 "cols × rows"），
    // 按 IonImageViewer.vue onContainerClick 里同样的居中缩放公式换算像素中心的屏幕坐标——
    // 图像按比例居中绘制在容器里，任意百分比点击都可能落在留白区域而不触发选中
    const dimensionsLabel = page.getByText('Dimensions', { exact: true })
    const dimensionsText = await dimensionsLabel.locator('..').locator('span').nth(1).innerText()
    const dimMatch = dimensionsText.match(/(\d+)\s*×\s*(\d+)/)
    if (!dimMatch) throw new Error(`Could not parse image dimensions from "${dimensionsText}"`)
    const gridCols = parseInt(dimMatch[1]!, 10)
    const gridRows = parseInt(dimMatch[2]!, 10)

    function pixelCenter(box: { x: number; y: number; width: number; height: number }, col: number, row: number) {
      const pad = 0.04
      const availW = box.width * (1 - pad * 2)
      const availH = box.height * (1 - pad * 2)
      const scale = Math.min(availW / gridCols, availH / gridRows)
      const drawW = Math.floor(gridCols * scale)
      const drawH = Math.floor(gridRows * scale)
      const ox = Math.floor((box.width - drawW) / 2)
      const oy = Math.floor((box.height - drawH) / 2)
      return {
        x: box.x + ox + (col + 0.5) * (drawW / gridCols),
        y: box.y + oy + (row + 0.5) * (drawH / gridRows),
      }
    }

    // 首次点击中心像素（中心更可能在组织上、有真实谱图，且远离边界）—— 首次加载耗时较久，给较长的等待时间
    let box = await imageContainer.boundingBox()
    if (!box) throw new Error('TIC image container bounding box not found')
    const centerCol = Math.floor(gridCols / 2)
    const centerRow = Math.floor(gridRows / 2)
    let point = pixelCenter(box, centerCol, centerRow)
    await page.mouse.click(point.x, point.y)
    await expect(page.getByText('Click a pixel on the TIC image to view its spectrum')).not.toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Loading spectrum...')).not.toBeVisible({ timeout: 60_000 })

    const pixelStat = page.locator('span').filter({ hasText: /^Pixel:/ })
    const firstPixelText = await pixelStat.innerText()

    // 切换到中心附近的像素（左上偏移一格），下方谱图应更新
    box = await imageContainer.boundingBox()
    if (!box) throw new Error('TIC image container bounding box not found')
    point = pixelCenter(box, Math.max(0, centerCol - 1), Math.max(0, centerRow - 1))
    await page.mouse.click(point.x, point.y)
    await expect(page.getByText('Loading spectrum...')).not.toBeVisible({ timeout: 30_000 })
    await expect(pixelStat).not.toHaveText(firstPixelText, { timeout: 15_000 })

    // 右侧元数据面板（与 new-analysis 类似，判断该有的信息是否都在）
    await expect(page.getByText('Polarity')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Analyzer')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Ionisation Source')).toBeVisible({ timeout: 10_000 })

    // 清理：回 Workspace 删除刚创建的结果
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await page.locator('table tbody tr').first().getByRole('button', { name: 'Delete' }).click()
    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText('Result deleted', { timeout: 10_000 })
  })
})

// ============================================================
// Public Datasets（依赖已有的公开数据）
// ============================================================

test.describe('Public Datasets', () => {

  test('page loads and renders dataset cards with metadata', async ({ page }) => {
    await page.goto('/datasets')

    await expect(page.locator('h1:has-text("Public Datasets")')).toBeVisible()
    await expect(page.getByPlaceholder('Search Datasets')).toBeVisible()

    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await expect(page.getByText('Organism:').first()).toBeVisible()
    await expect(page.getByText('Organism Part:').first()).toBeVisible()
    await expect(page.getByText('Ionisation Source:').first()).toBeVisible()
    await expect(page.getByText('Analyzer:').first()).toBeVisible()
    await expect(page.getByText('File Size:').first()).toBeVisible()
    await expect(page.getByText('Submitted by:').first()).toBeVisible()
    await expect(page.getByText('Submit Time:').first()).toBeVisible()
  })

  test('pagination shows page info and can go to next page', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const perPageSelect = page.locator('label:has-text("Per page")').locator('..').locator('select')
    await perPageSelect.selectOption('5')

    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible()
    await expect(page.getByText(/records/)).toBeVisible()

    const nextBtn = page.getByRole('button', { name: 'Next' })
    if (await nextBtn.isEnabled()) {
      await nextBtn.click()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      await expect(page.getByText('Organism:').first()).toBeVisible()
    }
  })

  test('sort — toggles between submission time and file size', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const sortSelect = page.locator('select:has(option[value="size_bytes"])')
    await sortSelect.selectOption('size_bytes')
    await page.waitForTimeout(300)

    await expect(page.getByText('Organism:').first()).toBeVisible()
    await expect(page.getByText('File Size:').first()).toBeVisible()
  })

  test('clicking a card navigates to dataset overview', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const overviewBtns = page.getByRole('button', { name: 'Overview' })
    await overviewBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await overviewBtns.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await overviewBtns.nth(pick).click()

    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()

    const hasContent = await page.getByRole('button', { name: 'Download' }).isVisible().catch(() => false)
    if (hasContent) {
      await expect(page.getByText('Size', { exact: true })).toBeVisible()
      await expect(page.getByText(/Sample Info/)).toBeVisible()
      await expect(page.getByText('File Information')).toBeVisible()
    }
  })

  test('overview back button — returns to Public Datasets', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const overviewBtns = page.getByRole('button', { name: 'Overview' })
    await overviewBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await overviewBtns.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await overviewBtns.nth(pick).click()
    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })

    const backBtn = page.getByRole('button', { name: 'Back to Public Datasets' })
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    await expect(page).toHaveURL(/\/datasets/)
    await expect(page.getByText('Organism:').first()).toBeVisible()
  })

  test('filter bar — Add filter panel opens', async ({ page }) => {
    await page.goto('/datasets')

    await page.getByRole('button', { name: 'Add filter' }).click()

    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
  })

  test('download — triggers download on a random card', async ({ page }) => {
    test.setTimeout(60_000)  // WebKit 下载偶发较慢
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const downloadBtns = page.locator('button').filter({ hasText: /Download/ })
    await downloadBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await downloadBtns.count()

    const eligible: number[] = []
    for (let i = 0; i < count; i++) {
      const card = downloadBtns.nth(i).locator('..').locator('..')
      const sizeText = await card.locator('p:has-text("File Size:")').innerText()
      if (sizeToMB(sizeText) < MAX_DOWNLOAD_MB) eligible.push(i)
    }
    const pick = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : 0

    const cardName = await downloadBtns.nth(pick).locator('..').locator('..')
      .locator('h3').innerText()
    await expect(downloadBtns.nth(pick).locator('..').locator('..').locator('h3')).not.toBeEmpty()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtns.nth(pick).click(),
    ])

    const filename = download.suggestedFilename()
    expect(filename).toContain(cardName!.replace('Dataset name: ', ''))

    // 清理下载文件（WebKit 偶发超时，忽略）
    try { await download.delete() } catch { /* ok */ }
  })

  test('download rate limit — second download is blocked', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const btns = page.locator('button').filter({ hasText: /Download/ })
    const count = await btns.count()
    const idx1 = Math.floor(Math.random() * count)
    let idx2: number
    if (count > 1) {
      do { idx2 = Math.floor(Math.random() * count) } while (idx2 === idx1)
    } else {
      idx2 = idx1
    }

    await btns.nth(idx1).click()
    await expect(page.locator('.toast')).toContainText('Download started')
    await page.waitForTimeout(2000)

    await btns.nth(idx2).click()
    await expect(page.locator('.toast')).toContainText(/Download is limited/)
    await page.waitForTimeout(1000)
  })
})
