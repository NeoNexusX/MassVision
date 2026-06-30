import { test, expect } from '@playwright/test'
import { randomBytes } from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/** 解析 "File Size:X.X KB/MB/GB" 为 MB */
function sizeToMB(text: string | null): number {
  if (!text) return Infinity
  const m = text.match(/([\d.]+)\s*(KB|MB|GB|TB)/i)
  if (!m) return Infinity
  const v = parseFloat(m[1])
  switch (m[2].toUpperCase()) {
    case 'KB': return v / 1024
    case 'MB': return v
    case 'GB': return v * 1024
    case 'TB': return v * 1024 * 1024
    default: return Infinity
  }
}

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
      await expect(page.locator('#is_public')).not.toBeChecked()

      const pickLabels = ['Organism', 'Organism Part', 'Condition', 'Sample Stabilization']
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
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const downloadBtns = page.locator('button').filter({ hasText: /Download/ })
    await downloadBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await downloadBtns.count()

    // 过滤出文件 < 300MB 的卡片索引
    const eligible: number[] = []
    for (let i = 0; i < count; i++) {
      const card = downloadBtns.nth(i).locator('..').locator('..')
      const sizeText = await card.locator('text=/File Size:/').textContent()
      if (sizeToMB(sizeText) < MAX_DOWNLOAD_MB) eligible.push(i)
    }
    const pick = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : 0

    const card = downloadBtns.nth(pick).locator('..').locator('..')
    const cardName = await card.locator('h3').textContent()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtns.nth(pick).click(),
    ])

    const filename = download.suggestedFilename()
    expect(cardName).toBeTruthy()
    expect(filename).toContain(cardName!.replace('Dataset name: ', ''))

    await download.delete()
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
    const count = await overviewBtns.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await overviewBtns.nth(pick).click()
    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()

    const hasContent = await page.getByRole('button', { name: 'Download' }).isVisible().catch(() => false)
    if (hasContent) {
      await expect(page.getByText('Size', { exact: true })).toBeVisible()
      await expect(page.getByText('MALDI Information')).toBeVisible()
      await expect(page.getByText('Technical Details')).toBeVisible()
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
   * Step 8 — 清理：删除第一个数据集
   */
  test('delete — removes a dataset', async ({ page }) => {
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByText('Are you sure you want to delete this dataset?')).toBeVisible()

    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText(/deleted/)
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
    const count = await overviewBtns.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await overviewBtns.nth(pick).click()

    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()

    const hasContent = await page.getByRole('button', { name: 'Download' }).isVisible().catch(() => false)
    if (hasContent) {
      await expect(page.getByText('Size', { exact: true })).toBeVisible()
      await expect(page.getByText('MALDI Information')).toBeVisible()
      await expect(page.getByText('Technical Details')).toBeVisible()
    }
  })

  test('overview back button — returns to Public Datasets', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const overviewBtns = page.getByRole('button', { name: 'Overview' })
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
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const downloadBtns = page.locator('button').filter({ hasText: /Download/ })
    await downloadBtns.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await downloadBtns.count()

    const eligible: number[] = []
    for (let i = 0; i < count; i++) {
      const card = downloadBtns.nth(i).locator('..').locator('..')
      const sizeText = await card.locator('text=/File Size:/').textContent()
      if (sizeToMB(sizeText) < MAX_DOWNLOAD_MB) eligible.push(i)
    }
    const pick = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : 0

    const cardName = await downloadBtns.nth(pick).locator('..').locator('..')
      .locator('h3').textContent()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtns.nth(pick).click(),
    ])

    const filename = download.suggestedFilename()
    expect(cardName).toBeTruthy()
    expect(filename).toContain(cardName!.replace('Dataset name: ', ''))

    await download.delete()
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
