import { test, expect } from '@playwright/test'

/**
 * NewAnalysis E2E 测试 — 真实后端
 * ================================
 * 创建分析页面 /workspace/new
 *
 * 依赖：用户已登录且有至少一个 dataset
 */

test.describe('New Analysis', () => {

  test('page loads with Step 1, Step 2 visible and Step 3 hidden', async ({ page }) => {
    await page.goto('/workspace/new')

    await expect(page.locator('h1:has-text("Create New Analysis")')).toBeVisible()
    await expect(page.getByText('Step 1: Data Source')).toBeVisible()
    await expect(page.getByText('Step 2: Preprocessing Pipeline')).toBeVisible()

    // Step 3 已隐藏
    await expect(page.getByText('Step 3: Annotation Settings')).not.toBeVisible()
  })

  test('summary panel shows disabled state when no dataset selected', async ({ page }) => {
    await page.goto('/workspace/new')

    await expect(page.getByText('Analysis Summary')).toBeVisible()
    await expect(page.getByText('No dataset selected')).toBeVisible()

    const startBtn = page.getByRole('button', { name: 'Start Analysis' })
    await expect(startBtn).toBeDisabled()

    await expect(page.getByText('Select dataset and configure pipeline first')).toBeVisible()
  })

  test('switching dataset updates summary panel', async ({ page }) => {
    await page.goto('/workspace/new')
    await page.locator('.tab:has-text("My Datasets")').click()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 至少需要 2 个数据集
    const radios = page.locator('input[name="selectedDataset"]')
    const count = await radios.count()
    if (count < 2) {
      test.skip(true, `Only ${count} dataset(s), need ≥ 2 to test switching`)
      return
    }

    // 选第一个
    const firstLi = radios.first().locator('..')
    const firstName = await firstLi.locator('.font-medium').innerText()
    await firstLi.click()
    await expect(firstLi.locator('input[type="radio"]')).toBeChecked()

    // Summary 显示第一个名称
    const summarySection = page.locator('.lg\\:col-span-1')
    await expect(summarySection.getByText(firstName!.trim())).toBeVisible()

    // 换选第二个
    const secondLi = radios.nth(1).locator('..')
    const secondName = await secondLi.locator('.font-medium').innerText()
    await secondLi.click()

    // 第二个 radio 选中，第一个取消
    await expect(secondLi.locator('input[type="radio"]')).toBeChecked()
    await expect(firstLi.locator('input[type="radio"]')).not.toBeChecked()

    // Summary 更新为第二个名称
    await expect(summarySection.getByText(secondName!.trim())).toBeVisible()
    await expect(summarySection.getByText(firstName!.trim())).not.toBeVisible()
  })

  test('selecting a dataset updates summary panel', async ({ page }) => {
    await page.goto('/workspace/new')

    // 切换到 My Datasets tab
    await page.locator('.tab:has-text("My Datasets")').click()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 取第一个数据集的名称，通过 radio 所在的 li 定位
    const firstLi = page.locator('input[name="selectedDataset"]').first().locator('..')
    const nameEl = firstLi.locator('.font-medium')
    const datasetName = await nameEl.innerText()
    expect(datasetName).toBeTruthy()

    // 点击数据集行
    await firstLi.click()

    // radio 变为选中
    await expect(firstLi.locator('input[type="radio"]')).toBeChecked()

    // Summary panel 不再显示 "No dataset selected"
    await expect(page.getByText('No dataset selected')).not.toBeVisible()

    // Summary panel 的 "Selected dataset" 区域显示该名称
    const summarySection = page.locator('.lg\\:col-span-1')
    await expect(summarySection.getByText(datasetName!.trim())).toBeVisible()

    // Dataset metadata 区域出现（自动回填了 MS 设置）
    await expect(page.getByText('Dataset metadata')).toBeVisible()
  })

  test('selecting a preprocessing method enables submit', async ({ page }) => {
    await page.goto('/workspace/new')
    await page.locator('.tab:has-text("My Datasets")').click()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 先选数据集（通过 radio input 定位）
    const radios = page.locator('input[name="selectedDataset"]')
    await radios.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await radios.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await radios.nth(pick).locator('..').click()

    // Start Analysis 仍然 disabled（没选 method）
    await expect(page.getByRole('button', { name: 'Start Analysis' })).toBeDisabled()

    // 点击最后一个预处理方法（Peak Alignment）
    const methodLabels = page.locator('details[open] label')
    const lastMethodLabel = methodLabels.nth(await methodLabels.count() - 1)
    await lastMethodLabel.click()

    // 方法选中后按钮应变为可用
    await expect(page.getByRole('button', { name: 'Start Analysis' })).toBeEnabled()
    await expect(page.getByText('Select dataset and configure pipeline first')).not.toBeVisible()
  })

  test('submit, wait for completion, then delete', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto('/workspace/new')
    await page.locator('.tab:has-text("My Datasets")').click()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const radios = page.locator('input[name="selectedDataset"]')
    await radios.first().waitFor({ state: 'visible', timeout: 10_000 })
    const count = await radios.count()
    const pick = count > 1 ? Math.floor(Math.random() * count) : 0
    await radios.nth(pick).locator('..').click()

    const methodLabels = page.locator('details[open] label')
    await methodLabels.nth(await methodLabels.count() - 1).click()

    await page.getByRole('button', { name: 'Start Analysis' }).click()

    await expect(page).toHaveURL(/\/workspace(?:\?|#|$)?/, { timeout: 30_000 })
    await expect(page.locator('h1:has-text("Workspace")')).toBeVisible()

    // 等刚创建的进程出现在表格里（状态为 Running）
    const runningRow = page.locator('table tr').filter({ hasText: 'Running' }).first()
    await expect(runningRow).toBeVisible({ timeout: 15_000 })

    // 轮询刷新，等到 Running 消失，最多 2 分钟
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      await page.reload()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      // 等表格数据真正加载完（不再是 "Loading..."）
      await expect(page.locator('table tbody tr').first().locator('td').first())
        .not.toHaveText('Loading...', { timeout: 15_000 })
      const hasRunning = await page.locator('table')
        .getByText('Running')
        .isVisible()
        .catch(() => false)
      if (!hasRunning) break
      await page.waitForTimeout(10_000)
    }
    await expect(page.locator('table').getByText('Running')).not.toBeVisible()

    await page.locator('table tbody tr').first()
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page.locator('table').getByText('Running')).not.toBeVisible()

    await page.locator('table tbody tr').first()
      .getByRole('button', { name: 'Delete' })
      .click()

    await page.locator('.modal-box').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.toast')).toContainText('Result deleted', { timeout: 10_000 })
  })
})

// ============================================================
// Workspace
// ============================================================

test.describe('Workspace', () => {

  test('page loads with summary cards and recent results', async ({ page }) => {
    await page.goto('/workspace')

    await expect(page.locator('h1:has-text("Workspace")')).toBeVisible()

    // 三张 SummaryCard（通过唯一副标题区分）
    await expect(page.getByText('Active preprocessing tasks')).toBeVisible()
    await expect(page.getByText('Successfully completed')).toBeVisible()
    await expect(page.getByText('Requires review')).toBeVisible()

    // Recent Results 区块
    await expect(page.getByText('Recent Results')).toBeVisible()
  })

  test('New Task — navigates to create analysis page', async ({ page }) => {
    await page.goto('/workspace')

    await page.getByRole('link', { name: 'New Task' }).click()

    await expect(page).toHaveURL(/\/workspace\/new/)
    await expect(page.locator('h1:has-text("Create New Analysis")')).toBeVisible()
  })

  test('Go to MyDatasets — navigates to my datasets page', async ({ page }) => {
    await page.goto('/workspace')

    await page.getByRole('link', { name: 'Go to MyDatasets' }).click()

    await expect(page).toHaveURL(/\/mydatasets/)
    await expect(page.locator('h1:has-text("My Datasets")')).toBeVisible()
  })
})
