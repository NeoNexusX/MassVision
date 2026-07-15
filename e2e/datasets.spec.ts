import { test, expect } from '@playwright/test'
import { randomBytes } from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { sizeToMB, ALGO_MAX_MB } from './utils.js'

const MAX_DOWNLOAD_MB = 300

/**
 * Datasets E2E 测试 — 真实后端
 * ==============================
 * PublicDatasets：公开页 /datasets（依赖已有公开数据）
 * MyDatasets：需登录 /mydatasets（先上传一个文件，基于该文件测试所有功能，最后删除）
 */

// ============================================================
// My Datasets（需登录，自包含：上传 → 测试 → 删除）
// ============================================================

test.describe('My Datasets', () => {

  /**
   * Step 1 — 上传一个测试文件，确保账号上有数据供后续测试使用
   */
  test('upload — uploads a test dataset', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Linux WebKit 不支持 OPFS')

    const imzml = `<?xml version="1.0" encoding="utf-8"?>
<mzML xmlns="http://psi.hupo.org/ms/mzml" version="1.1">
  <cvList><cv id="MS" fullName="PSI-MS" version="4.1.7"/></cvList>
  <fileDescription><fileContent>
    <cvParam accession="MS:1000127" name="centroid spectrum" value=""/>
    <cvParam accession="IMS:1000030" name="continuous" value=""/>
  </fileContent></fileDescription>
  <referenceableParamGroupList>
    <referenceableParamGroup id="common">
      <cvParam accession="MS:1000130" name="positive scan" value=""/>
      <cvParam accession="MS:1000075" name="MALDI" value=""/>
      <cvParam accession="MS:1000084" name="TOF" value=""/>
      <cvParam name="pixel size x" value="50"/>
      <cvParam name="pixel size y" value="50"/>
    </referenceableParamGroup>
  </referenceableParamGroupList>
  <run id="test" defaultInstrumentConfigurationRef="IC1">
    <spectrumList count="0"/>
  </run>
</mzML>`

    const dir = mkdtempSync(join(tmpdir(), 'mv-upload-'))
    writeFileSync(join(dir, 'test_lyk_upload.imzML'), imzml)
    writeFileSync(join(dir, 'test_lyk_upload.ibd'), randomBytes(1024))

    try {
      await page.goto('/mydatasets')
      await page.getByRole('button', { name: 'Upload New Dataset' }).click()
      await expect(page.getByText('Upload New Dataset (imzML + ibd)')).toBeVisible()

      await page.locator('input[type="file"]').setInputFiles([
        join(dir, 'test_lyk_upload.imzML'),
        join(dir, 'test_lyk_upload.ibd'),
      ])

      await page.waitForTimeout(2000)
      // 默认勾了 public，测试文件只有 1KB 不够 10MB 门槛，取消勾选
      await page.locator('#is_public').uncheck()

      const pickLabels = ['Organism', 'Organism Part', 'Condition', 'Sample Stabilization', 'MALDI Matrix', 'MALDI Matrix Application']
      for (const label of pickLabels) {
        const area = page.locator('.modal-box').locator(`label:has-text("${label}")`).first().locator('..')
        await area.locator('select').click()
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(300)
      }

      const solventArea = page.locator('.modal-box').locator('label:has-text("Solvent")').locator('..')
      await solventArea.locator('select').click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      await solventArea.getByPlaceholder('e.g. 50').fill('50')
      await solventArea.getByPlaceholder('e.g. 50').press('Enter')

      await page.getByRole('button', { name: 'Confirm & Upload' }).click()

      // 等上传完成 → 弹窗关闭
      await expect(page.locator('.toast')).toContainText(/success|reused|complete/, { timeout: 120_000 })
      await expect(page.getByText('Upload New Dataset (imzML + ibd)')).not.toBeVisible()

      // 轮询 Refresh Status，等第一张卡变为 Uploaded
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      const deadline = Date.now() + 25_000
      while (Date.now() < deadline) {
        await page.getByRole('button', { name: 'Refresh Status' }).click()
        await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
        const hasUploading = await page.getByRole('button', { name: 'Delete' })
          .first()
          .locator('..')
          .getByText('Uploading')
          .isVisible()
          .catch(() => false)
        if (!hasUploading) break
        await page.waitForTimeout(5000)
      }
      await expect(
        page.getByRole('button', { name: 'Delete' }).first().locator('..').getByText(/Uploaded|Failed/)
      ).toBeVisible()
    } finally {
      try { rmSync(dir, { recursive: true }) } catch { /* ok */ }
    }
  })

  /**
   * Step 2 — 基于上传的数据测试页面加载
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
   * Step 3 — 卡片状态、可见性、删除按钮
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
   * Step 4 — 随机下载一张卡
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
   * Step 5 — Overview 跳转并验证内容，再 Back 返回
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
   * Step 6 — 排序切换
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
   * Step 7 — Filter 面板
   */
  test('filter bar — Add filter panel opens', async ({ page }) => {
    await page.goto('/mydatasets')

    await page.getByRole('button', { name: 'Add filter' }).click()

    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
  })

  /**
   * Step 8 — Make Public：把 Step 1 上传的私有测试数据集，在其详情页转为公开
   * 依赖：Step 1 上传的测试文件仍然存在（未被删除），且当前是 Private。
   * 后端会按元数据重新生成文件名，不能按文件名定位卡片；默认按提交时间倒序排列，
   * 该文件是本文件唯一会新建数据集的地方，因此它始终是第一张卡片。
   */
  test('make public — converts the uploaded private dataset to public from its overview page', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Linux WebKit 不支持 OPFS，没有上传的测试文件')

    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 只匹配数据集卡片的 h3（aria-label 以 "Dataset name:" 开头），
    // 避免匹配到页面里始终存在于 DOM 中、只是隐藏的 ConfirmDialog 弹窗标题 h3
    const targetCard = page.locator('h3[aria-label^="Dataset name:"]').first().locator('..').locator('..')
    await expect(targetCard).toBeVisible({ timeout: 10_000 })
    await expect(targetCard.getByText('Private')).toBeVisible()

    await targetCard.getByRole('button', { name: 'Overview' }).click()
    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()

    // 私有 + 自己的数据集 → 详情页显示 "Make Public" 按钮
    const makePublicBtn = page.getByRole('button', { name: 'Make Public' })
    await expect(makePublicBtn).toBeVisible()
    await makePublicBtn.click()

    // 二次确认弹窗（ConfirmDialog: title="Make Dataset Public", confirm-label="Make Public"）
    await expect(page.locator('.modal-box')).toContainText('Make Dataset Public')
    await expect(page.locator('.modal-box')).toContainText('This dataset will be moved to Public Data')
    await page.locator('.modal-box').getByRole('button', { name: 'Make Public' }).click()

    await expect(page.locator('.toast')).toContainText('Dataset is now public.')
    // 转公开成功后按钮因 dataset.isPublic 变化而消失
    await expect(makePublicBtn).not.toBeVisible()

    // 回到 My Datasets，确认该卡片的可见性徽章变为 Public
    await page.getByRole('button', { name: 'Back to My Datasets' }).click()
    await expect(page).toHaveURL(/\/mydatasets/)
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const updatedCard = page.locator('h3[aria-label^="Dataset name:"]').first().locator('..').locator('..')
    await expect(updatedCard.getByText('Public')).toBeVisible({ timeout: 10_000 })
  })

  /**
   * Step 9 — 清理：删除第一个数据集（Step 1 上传的测试文件）
   */
  test('delete — removes the first (newest) dataset on the page', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Linux WebKit 没有上传，跳过删除避免误删真实数据')
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByText('Are you sure you want to delete this dataset?')).toBeVisible()

    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText(/deleted/)
  })

  /**
   * Step 10 — Explore（processed 模式）：二次确认 → Workspace 创建任务（Direct conversion）
   * → 等待完成 → 查看 TIC 图 + 逐像素谱图交互 → 清理 Workspace 中的结果
   *
   * 放在 Step 1 上传的测试文件被删除之后，此时账号下只剩真实数据集，
   * 不必再排除本文件的合成测试数据，直接选第一张即可。
   */
  test('explore — creates direct-conversion task, verifies TIC image and per-pixel spectrum, then cleans up', async ({ page }) => {
    test.setTimeout(300_000)

    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const exploreBtns = page.getByRole('button', { name: 'Explore' })
    try {
      await exploreBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    } catch {
      test.skip(true, 'No explorable (processed) dataset available')
      return
    }

    const count = await exploreBtns.count()
    // 算法测试只选 < ALGO_MAX_MB 的数据集，避免大文件（如 1G 上传测试数据）跑算法超时
    const eligible: number[] = []
    for (let i = 0; i < count; i++) {
      const card = exploreBtns.nth(i).locator('..').locator('..')
      const sizeText = await card.locator('p:has-text("File Size:")').innerText()
      if (sizeToMB(sizeText) < ALGO_MAX_MB) eligible.push(i)
    }
    if (eligible.length === 0) {
      test.skip(true, `No explorable dataset < ${ALGO_MAX_MB}MB available`)
      return
    }
    const pick = eligible[Math.floor(Math.random() * eligible.length)]
    await exploreBtns.nth(pick).click()

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
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      await page.reload()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      await expect(page.locator('table tbody tr').first().locator('td').first())
        .not.toHaveText('Loading...', { timeout: 15_000 })
      const hasRunning = (await page.locator('table').getByText('Running').count()) > 0
      if (!hasRunning) break
      await page.waitForTimeout(10_000)
    }
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

    // 定位 TIC 图可点击区域（结构与 result-detail.spec.ts 的 clickSpectrum 一致：标题 → 上 3 层 → .overflow-hidden）
    const heading = page.locator('h3', { hasText: 'TIC Image' })
    const imageContainer = heading.locator('..').locator('..').locator('..').locator('.overflow-hidden')

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
