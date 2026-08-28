import { test, expect } from '@playwright/test'
import { ALGO_DATASET_NAMES } from './utils.js'

/**
 * NewAnalysis E2E 测试 — 真实后端
 * ================================
 * 创建分析页面 /workspace/new
 *
 * 依赖：用户已登录且有至少一个 dataset
 *
 * 跨文件依赖：本文件最后一个测试（"submit, wait for completion, then delete"）会创建一个
 * 分析任务并等它跑完，但不会删除——清理工作留给了 result-detail.spec.ts 末尾的
 * "Cleanup > delete completed result"。两个文件必须一起跑（按文件名字母序，
 * new-analysis 在 result-detail 之前）才能形成完整的创建 → 查看 → 删除链路。
 * 如果单独只跑 result-detail.spec.ts，它的 Cleanup 测试会删除 Workspace 里
 * "当前最新的 Completed 结果"——如果没有本文件留下的任务，可能会误删真实数据。
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
    await radios.first().waitFor({ state: 'visible', timeout: 10_000 })
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
    await expect(nameEl).not.toBeEmpty()

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

  // 注意：测试名里的 "delete" 指的是 result-detail.spec.ts 末尾的 Cleanup 测试，
  // 本测试自己只创建任务、等待完成，不做删除（见文件头的跨文件依赖说明）
  test('submit, wait for completion, then delete', async ({ page, browserName }) => {
    // 建任务的重后端操作只在 chromium 跑，避免 firefox/webkit 重复建 Peak Alignment 任务
    test.skip(browserName !== 'chromium', '分析任务只在 chromium 创建一次')
    test.setTimeout(180_000)
    await page.goto('/workspace/new')
    await page.locator('.tab:has-text("My Datasets")').click()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 用真实数据集跑算法（不再随机挑 <ALGO_MAX_MB 的卡——可能选中 1KB 合成测试文件，
    // 后端解析必然 Failed）。从 ALGO_DATASET_NAMES 里随机选一个，用搜索框按名称过滤后选中。
    const search = page.getByPlaceholder('Search...')
    const name = ALGO_DATASET_NAMES[Math.floor(Math.random() * ALGO_DATASET_NAMES.length)]!
    await search.fill(name)
    await page.waitForTimeout(500) // datasetQuery 有 300ms 防抖
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    const radio = page.locator('input[name="selectedDataset"]').first()
    if (!(await radio.isVisible().catch(() => false))) {
      test.skip(true, `Dataset "${name}" not found on this backend`)
      return
    }
    await radio.locator('..').click()

    const methodLabels = page.locator('details[open] label')
    await methodLabels.nth(await methodLabels.count() - 1).click()

    await page.getByRole('button', { name: 'Start Analysis' }).click()

    await expect(page).toHaveURL(/\/workspace(?:\?|#|$)?/, { timeout: 30_000 })
    await expect(page.locator('h1:has-text("Workspace")')).toBeVisible()

    // 等刚创建的进程出现在表格里（状态为 Running）
    const runningRow = page.locator('table tr').filter({ hasText: 'Running' }).first()
    await expect(runningRow).toBeVisible({ timeout: 15_000 })

    // 轮询刷新，等第一行（最新一条，即本次创建的任务）Running 消失，最多 2 分钟。
    // 不能等全表 Running 清零——Workspace 里可能有别人/并发留下的 Running 任务。
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      await page.reload()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      // 等表格数据真正加载完（不再是 "Loading..."）
      const firstRow = page.locator('table tbody tr').first()
      await expect(firstRow.locator('td').first())
        .not.toHaveText('Loading...', { timeout: 15_000 })
      const firstRunning = (await firstRow.getByText('Running').count()) > 0
      if (!firstRunning) break
      await page.waitForTimeout(10_000)
    }
    await expect(page.locator('table tbody tr').first().getByText('Running')).not.toBeVisible()
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
