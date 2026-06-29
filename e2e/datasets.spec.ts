import { test, expect } from '@playwright/test'
import { randomBytes } from 'crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Datasets E2E 测试 — 真实后端
 * ==============================
 * PublicDatasets：公开页 /datasets
 * MyDatasets：需登录 /mydatasets
 *
 * 两页共用 DatasetList / DatasetCard / DatasetFilterBar / PaginationBar。
 *
 * 不测：空状态 / 错误状态（无法触发）、真删（不可逆）
 */

// ============================================================
// Public Datasets
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

    // 改成每页 5 条，确保能翻页
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

  test('clicking a card navigates to dataset overview', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Overview' }).first().click()

    await expect(page).toHaveURL(/\/overview/)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()

    // 有数据或空状态都能过
    const hasContent = await page.getByText('Biological Metadata').isVisible().catch(() => false)
    if (hasContent) {
      await expect(page.getByText('MALDI Information')).toBeVisible()
      await expect(page.getByText('Technical Details')).toBeVisible()
    }
  })

  test('filter bar — Add filter panel opens', async ({ page }) => {
    await page.goto('/datasets')

    await page.getByRole('button', { name: 'Add filter' }).click()

    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
  })

  test('download — triggers download on first card', async ({ page }) => {
    await page.goto('/datasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Download' }).first().click()

    await expect(page.locator('.toast')).toContainText(/Download/)
  })
})

// ============================================================
// My Datasets（需登录）
// ============================================================

test.describe.skip('My Datasets', () => {

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

  test('download — triggers download on first card', async ({ page }) => {
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Download' }).first().click()

    await expect(page.locator('.toast')).toContainText(/Download/)
  })

  test.skip('upload — uploads a test dataset then deletes it', async ({ page, browserName }) => {
    // Playwright 在 Linux 上自带的 WebKit 不支持 OPFS（navigator.storage.getDirectory），
    // 上传流程依赖 OPFS 压缩，故在 webkit 跳过。chromium / firefox 正常覆盖。
    test.skip(browserName === 'webkit', 'Linux WebKit 不支持 OPFS')

    // 含 cvParam 的 imzML，客户端自动解析填掉 7 个字段
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

    // 创建临时文件，测试结束后从磁盘清理
    const dir = mkdtempSync(join(tmpdir(), 'mv-upload-'))
    writeFileSync(join(dir, 'test_lyk_upload.imzML'), imzml)
    writeFileSync(join(dir, 'test_lyk_upload.ibd'), randomBytes(1024))

    try {
      // ── 上传 ──
      await page.goto('/mydatasets')
      await page.getByRole('button', { name: 'Upload New Dataset' }).click()
      await expect(page.getByText('Upload New Dataset (imzML + ibd)')).toBeVisible()

      await page.locator('input[type="file"]').setInputFiles([
        join(dir, 'test_lyk_upload.imzML'),
        join(dir, 'test_lyk_upload.ibd'),
      ])

      // 等文件解析完成
      await page.waitForTimeout(2000)
      await expect(page.locator('#is_public')).not.toBeChecked()

      // Vue SelectWithOther 不响应 selectOption，用点击 + 键盘选择（限 modal 内）
      const pickLabels = ['Organism', 'Organism Part', 'Condition', 'Sample Stabilization']
      for (const label of pickLabels) {
        const area = page.locator('.modal-box').locator(`label:has-text("${label}")`).first().locator('..')
        await area.locator('select').click()
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(300)
      }

      // SolventPicker：选溶剂 → 填百分比 → 按 Enter 添加
      const solventArea = page.locator('.modal-box').locator('label:has-text("Solvent")').locator('..')
      await solventArea.locator('select').click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      await solventArea.getByPlaceholder('e.g. 50').fill('50')
      await solventArea.getByPlaceholder('e.g. 50').press('Enter')

      await page.getByRole('button', { name: 'Confirm & Upload' }).click()

      // 等上传完成 → 弹窗关闭 → 列表刷新
      await expect(page.locator('.toast')).toContainText(/success|reused|complete/, { timeout: 120_000 })
      await expect(page.getByText('Upload New Dataset (imzML + ibd)')).not.toBeVisible()

      // ── 删除刚才上传的数据集 ──
      // 轮询 Refresh Status 直到 Uploading 消失（最长 1 分钟）
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        await page.getByRole('button', { name: 'Refresh Status' }).click()
        await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
        if (await page.locator('text=Uploading').count() === 0) break
        await page.waitForTimeout(5000)
      }
      await expect(page.locator('text=Uploading')).toHaveCount(0)

      // 删列表中第一个
      await page.getByRole('button', { name: 'Delete' }).first().click()
      await expect(page.getByText('Are you sure you want to delete this dataset?')).toBeVisible()

      // 确认删除（限 modal-box 内，避免 backdrop close 按钮拦截）
      await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
      await expect(page.locator('.toast')).toContainText(/deleted/)
    } finally {
      try { rmSync(dir, { recursive: true }) } catch { /* ok */ }
    }
  })
})
