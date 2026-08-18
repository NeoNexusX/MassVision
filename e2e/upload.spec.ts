import { test, expect, type Download, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Upload Round-Trip E2E 测试 — 真实后端
 * ======================================
 * 下载真实数据集（imzML + ibd）-> 从服务器删除 -> 用下载的文件重新上传 -> 验证恢复
 *
 * 文件名按字母序在 result-detail.spec.ts 之后、vue.spec.ts 之前执行，
 * 确保所有依赖数据集的测试（datasets / new-analysis / result-detail）已跑完。
 *
 * 覆盖两个数据集：
 * - Arabidopsis_Spleen_MALDI_10_Negative_f9d339（小，Organism=Arabidopsis / Part=Spleen）
 * - Rat_Liver_MALDI_40_Positive_9ce4d1（大，压缩后约 360MB，Organism=Rat / Part=Liver）
 *
 * 相同内容 + 相同 metadata = 相同文件名，重传后数据集自动恢复，不需要额外清理。
 *
 * 注意：这是破坏性测试——删除后如果重传失败，真实数据会丢失。
 */

interface RoundTripParams {
  filename: string
  organism: string
  organismPart: string
  /** Polarity 有些数据的 imzML 解析不出来，需要手动填；与文件名中的 Positive/Negative 对应 */
  polarity: string
  /** Ionisation Source 有些数据需要手动填（如 imzML 没解析到的情况）；不提供则依赖 imzML 自动解析 */
  ionisationSource?: string
  /** Timeout for waiting both downloads to start (ms) */
  downloadTimeout: number
  /** Timeout for the upload pipeline to complete (toast) (ms) */
  uploadTimeout: number
  /** Polling interval for Refresh Status (ms) */
  pollInterval: number
  /** Polling total duration for Refresh Status (ms) */
  pollDuration: number
}

interface DatasetCase {
  name: string
  testTimeout: number
  params: RoundTripParams
}

/**
 * 执行一次 download -> delete -> re-upload 流程。
 * @returns true 表示成功完成，false 表示目标数据集不存在（需要 skip）
 */
async function runUploadRoundTrip(page: Page, params: RoundTripParams): Promise<boolean> {
  const dir = mkdtempSync(join(tmpdir(), 'mv-roundtrip-'))
  try {
    // ============================================================
    // Step 1: 定位目标数据集
    // ============================================================
    await page.goto('/mydatasets')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const cardHeading = page.locator(`h3[aria-label*="${params.filename}"]`).first()
    try {
      await cardHeading.waitFor({ state: 'visible', timeout: 10_000 })
    } catch {
      return false
    }
    const targetCard = cardHeading.locator('..').locator('..')

    // ============================================================
    // Step 2: 下载 imzML + ibd
    // ossDownloadRaw 对两个文件各起一个 iframe，触发两个 download 事件。
    // 用 page.on('download') 持续收集，避免两个 waitForEvent 抢同一个事件。
    // ============================================================
    const collected: Download[] = []
    page.on('download', (dl) => collected.push(dl))

    await targetCard.getByRole('button', { name: 'Download' }).click()

    // 等两个下载都触发（imzML + ibd）
    await expect.poll(
      () => collected.length,
      { timeout: params.downloadTimeout, intervals: [500, 1000, 2000] },
    ).toBeGreaterThanOrEqual(2)

    // 保存到临时目录（保持 suggestedFilename 原名，imzML/ibd 的 basename 配对不变）
    const savedPaths: string[] = []
    for (const dl of collected) {
      const dest = join(dir, dl.suggestedFilename())
      await dl.saveAs(dest)
      savedPaths.push(dest)
    }
    const files = readdirSync(dir)
    const hasImzml = files.some(f => /\.imzml$/i.test(f))
    const hasIbd = files.some(f => /\.ibd$/i.test(f))
    if (!hasImzml || !hasIbd) {
      throw new Error(`Expected imzML + ibd, got: ${files.join(', ')}`)
    }

    // ============================================================
    // Step 3: 删除该数据集（硬删除，重传时不会被判定为 reuse）
    // ============================================================
    await targetCard.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Are you sure you want to delete this dataset?')).toBeVisible()
    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText(/deleted/)
    await expect(cardHeading).not.toBeVisible({ timeout: 15_000 })

    // ============================================================
    // Step 4: 重新上传下载到的文件
    // ============================================================
    await page.getByRole('button', { name: 'Upload New Dataset' }).click()
    await expect(page.getByText('Upload New Dataset (imzML + ibd)')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles(savedPaths)
    await page.waitForTimeout(2000) // 等 imzML 元数据解析完

    // 默认勾了 public，取消
    await page.locator('#is_public').uncheck()

    const modalBox = page.locator('.modal-box')

    // Polarity（有些数据 imzML 解析不到文件名中的 Positive/Negative，需要手动设）
    await modalBox.locator('label:has-text("Polarity")').first().locator('..').locator('select')
      .selectOption(params.polarity)

    // Ionisation Source（有些数据需要手动设，如 SIMS；imzML 解析不到时使用）
    if (params.ionisationSource) {
      await modalBox.locator('label:has-text("Ionisation Source")').first().locator('..').locator('select')
        .selectOption(params.ionisationSource)
    }

    // Organism
    await modalBox.locator('label:has-text("Organism")').first().locator('..').locator('select')
      .selectOption(params.organism)

    // Organism Part
    await modalBox.locator('label:has-text("Organism Part")').first().locator('..').locator('select')
      .selectOption(params.organismPart)

    // 其他必填项选第一个（Condition / Sample Stabilization / MALDI Matrix / MALDI Matrix Application）
    // 这些字段不影响文件名，选第一项即可通过表单校验
    for (const label of ['Condition', 'Sample Stabilization', 'MALDI Matrix', 'MALDI Matrix Application']) {
      const area = modalBox.locator(`label:has-text("${label}")`).first().locator('..')
      await area.locator('select').click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
    }

    // Solvent（select + 文本输入）
    const solventArea = modalBox.locator('label:has-text("Solvent")').locator('..')
    await solventArea.locator('select').click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await solventArea.getByPlaceholder('e.g. 50').fill('50')
    await solventArea.getByPlaceholder('e.g. 50').press('Enter')

    await page.getByRole('button', { name: 'Confirm & Upload' }).click()

    // ============================================================
    // Step 5: 验证重传成功
    // 相同内容 + 相同 metadata -> 相同文件名，卡片以原名重新出现
    // ============================================================
    await expect(page.locator('.toast')).toContainText(/success|reused|complete/, { timeout: params.uploadTimeout })
    await expect(page.getByText('Upload New Dataset (imzML + ibd)')).not.toBeVisible()

    // 轮询 Refresh Status，等数据集卡片出现并变为 Uploaded
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    const deadline = Date.now() + params.pollDuration
    while (Date.now() < deadline) {
      await page.getByRole('button', { name: 'Refresh Status' }).click()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      const isTargetVisible = await cardHeading.isVisible().catch(() => false)
      if (isTargetVisible) {
        const restoredCard = cardHeading.locator('..').locator('..')
        const stillUploading = await restoredCard.getByText('Uploading').isVisible().catch(() => false)
        if (!stillUploading) break
      }
      await page.waitForTimeout(params.pollInterval)
    }

    await expect(cardHeading).toBeVisible({ timeout: 10_000 })
    const restoredCard = cardHeading.locator('..').locator('..')
    await expect(restoredCard.getByText(/Uploaded|Failed/)).toBeVisible()

    return true
  } finally {
    try { rmSync(dir, { recursive: true }) } catch { /* ok */ }
  }
}

// ============================================================
// 测试用例
// ============================================================

const CASES: DatasetCase[] = [
  {
    name: 'small: Arabidopsis_Spleen_MALDI_10_Negative',
    testTimeout: 300_000, // 5 min
    params: {
      filename: 'Arabidopsis_Spleen_MALDI_10_Negative_f9d339',
      organism: 'Arabidopsis (Arabidopsis thaliana)',
      organismPart: 'Spleen',
      polarity: 'Negative',
      downloadTimeout: 60_000,   // 1 min for downloads to start
      uploadTimeout: 120_000,    // 2 min for upload pipeline
      pollInterval: 5000,        // 5s between polls
      pollDuration: 50_000,      // 50s total (≈10 polls)
    },
  },
]

test.describe('Upload Round-Trip', () => {
  for (const ds of CASES) {
    test(`download -> delete -> re-upload (${ds.name})`, async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'Linux WebKit 不支持 OPFS 且 headless 下载不稳定')
      test.setTimeout(ds.testTimeout)

      const found = await runUploadRoundTrip(page, ds.params)
      if (!found) {
        test.skip(true, `Target dataset ${ds.params.filename} not found`)
      }
    })
  }
})
