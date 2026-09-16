import { test, expect, type Page } from '@playwright/test'
import { ALGO_DATASET_NAMES } from './utils.js'

/**
 * New Analysis + Peak Alignment 全链路 E2E — 真实后端
 * =====================================================
 * 覆盖页面：/workspace/new（创建分析）、/workspace（任务列表）、
 * /vizworkbench（可视化工作台）。
 *
 * 核心链路：submit 在 chromium 上用真实数据集创建 Peak Alignment 任务并等它完成
 * → 两个用例进入 vizworkbench 验证渲染与交互 → 末尾 Cleanup 删除任务。
 * 链路在同一文件内按声明顺序执行（查看用例包在 test.describe.serial 里，
 * 组内某用例失败时后续查看用例自动 skip，不再各自傻等 180s 超时）。
 *
 * 状态传递：submit 在任务创建成功（表格出现该数据集的 Running 行）后，
 * 把数据集名记入模块变量 createdDataset；后续用例与 Cleanup 只按它定位本轮
 * 创建的任务（Peak Alignment + 数据集名双重过滤，排除历史任务）。submit 被
 * skip（数据集缺失 / 不支持 align / 非 chromium）或创建前失败时变量保持 null，
 * 依赖用例随之 skip、Cleanup 不删任何行——不会误删 Workspace 里的历史任务。
 *
 * Cleanup 放在 serial 组之外：查看用例失败不该挡住清理（与合并前行为一致），
 * 但 submit 创建前就失败/被 skip 时 Cleanup 自然 skip。
 *
 * 注意：真实 Peak Alignment 后端任务在非 chromium 浏览器上经常 180s 都未完成，
 * 且显著拖长 CI，故链路只在 chromium 跑；firefox/webkit 只覆盖不依赖真实任务
 * 的用例（表单、Workspace、vizworkbench 空态）。
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
 * 定位 Workspace 表格里的 Peak Alignment 任务行。
 * - 必须按 Methods 列 "Peak Alignment" 过滤，不能取第一条 Completed——
 *   残留的 raw-convert（processed）任务没有 selected-mz（仅 continuous 模式渲染），
 *   取错行会让 ion-image/谱图交互断言全部超时。
 * - `dataset`（submit 记录的数据集名）进一步排除历史 Peak Alignment 任务。
 */
function peakAlignmentRow(page: Page, dataset?: string) {
  let row = page.locator('table tbody tr').filter({ hasText: 'Peak Alignment' })
  if (dataset) row = row.filter({ hasText: dataset })
  return row.first()
}

/**
 * 本轮 submit 创建的 Peak Alignment 任务的数据集名（见文件头"状态传递"）。
 * 模块变量只在同一 worker 进程内有效——三个浏览器项目各自重新加载本文件，
 * chromium 之外的项目的值不会被读到（链路用例先被 browserName skip 拦下）。
 */
let createdDataset: string | null = null

/**
 * Peak Alignment 后端任务的最长等待时间。
 *
 * 这条链路里最耗时的就是后端跑 align，其余步骤都快，所以所有与之相关的预算
 * 都由这一个数推导，避免各处对不上（之前 submit 轮询 120s / 全局 180s、
 * helper 轮询 180s / 全局也是 180s、Cleanup 干脆没设全局用默认 30s ——
 * 等待上限 ≥ 全局超时，条件永远等不到）。
 *
 * 实测：同一数据集两次跑分别 108s、176s，波动大且会超过 2 分钟，
 * 所以留足余量取 5 分钟，避免差几秒就误判失败。
 */
const ALIGN_WAIT_MS = 300_000
/** 轮询预算 + 页面加载/断言余量。 */
const ALIGN_TEST_TIMEOUT_MS = ALIGN_WAIT_MS + 120_000

/**
 * 等待 submit 创建的 Peak Alignment 任务从 Running 变为 Completed 可查看。
 * 任务创建后要排队+计算，不会立刻 Completed，10s 内的 toBeVisible 断言会误报。
 * 轮询刷新（与 Cleanup 的等待逻辑一致），直到该行 Status 列变成 Completed。
 * 只等"可查看"（status !== 'processing'）是不够的——Failed 任务也有 View 按钮，
 * 这里要求真正 Completed，进入 viz-workbench 后离子图/谱图断言才成立。
 * 本轮 submit 没有创建任务（skip / 创建前失败）时直接 skip；
 * 找不到时抛错，跳过静默地把定位失败吞掉——这能让「submit 被 skip / 后端无此数据集」这类真实原因暴露出来。
 */
async function waitForPeakAlignmentReady(page: Page) {
  if (!createdDataset) {
    // test.skip(true, ...) 抛出 skip 异常结束测试；throw 只为让 TS 收窄类型
    test.skip(true, '本轮 submit 未创建 Peak Alignment 任务（skip / 创建前失败）')
    throw new Error('skipped')
  }
  const deadline = Date.now() + ALIGN_WAIT_MS
  while (Date.now() < deadline) {
    const row = peakAlignmentRow(page, createdDataset)
    if ((await row.getByText('Completed').count()) > 0) return row
    await page.reload()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first())
      .not.toHaveText('Loading...', { timeout: 15_000 })
    await page.waitForTimeout(5_000)
  }
  throw new Error(`Peak Alignment task did not become Completed within ${ALIGN_WAIT_MS / 1000}s`)
}

// ============================================================
// 创建分析页面（表单，无后端任务依赖）
// ============================================================

test.describe('New Analysis', () => {

  test('page loads with exactly the two pipeline steps', async ({ page }) => {
    await page.goto('/workspace/new')

    await expect(page.locator('h1:has-text("Create New Analysis")')).toBeVisible()
    await expect(page.getByText('Step 1: Data Source')).toBeVisible()
    await expect(page.getByText('Step 2: Preprocessing Pipeline')).toBeVisible()

    // 向导只有两步。原来这里断言 "Step 3: Annotation Settings" 不可见，
    // 但该文案早已从代码里删除，断言恒真、测不到任何回归。
    await expect(page.getByText(/^Step \d+:/)).toHaveCount(2)
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
    await expect(summarySection.getByText(firstName!.trim())).toBeHidden()
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
    await expect(page.getByText('No dataset selected')).toBeHidden()

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
    await expect(page.getByText('Select dataset and configure pipeline first')).toBeHidden()
  })
})

// ============================================================
// Peak Alignment 链路（serial：submit → 查看两用例）
// ============================================================

test.describe.serial('Peak Alignment journey', () => {

  // 重后端 Peak Alignment 任务只在 chromium 创建（firefox/webkit 后端完成时间不可控，
  // 180s 等不到位，还拖长 CI）。后续查看用例与 Cleanup 做了同样的 chromium-only skip。
  test('submit — creates Peak Alignment task and waits for completion', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建一次（后端完成时间不可控）')
    test.setTimeout(ALIGN_TEST_TIMEOUT_MS)
    await page.goto('/workspace/new')
    await page.locator('.tab:has-text("My Datasets")').click()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })

    // 用真实数据集跑算法（不再随机挑 <ALGO_MAX_MB 的卡——可能选中 1KB 合成测试文件，
    // 后端解析必然 Failed）。从 ALGO_DATASET_NAMES 里随机选一个，用搜索框按名称过滤后选中。
    // 注意 placeholder 与 DataSourceStep 里的 SearchInput 保持一致（"Search datasets"）。
    const search = page.getByPlaceholder('Search datasets')
    const name = ALGO_DATASET_NAMES[Math.floor(Math.random() * ALGO_DATASET_NAMES.length)]!
    await search.fill(name)

    // 按**数据集名**定位那一行再点。两种"等就绪"的写法都不能用：
    //   - 等 .animate-pulse：DataSourceStep 的加载态是 loading-spinner，页面没有骨架屏元素，
    //     toHaveCount(0) 会立刻通过；
    //   - 等"第一个 radio 可见"：列表还没被过滤时，初始那批 radio 就已经可见，会点到列表
    //     第一行（曾因此给 Rat_Liver 建了任务，却去找 Human_Kidney 的行）。
    // 按名字过滤则与过滤是否已生效无关——命中的一定是目标数据集那一行。
    const datasetRow = page.locator('li').filter({ hasText: name }).first()
    const found = await datasetRow
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    if (!found) {
      test.skip(true, `Dataset "${name}" not found on this backend`)
      return
    }
    await datasetRow.click()

    // 明确选中 Peak Alignment，而不是"点最后一个方法"——随机数据集下最后一个方法未必是 align。
    // profile 数据要先选中 Peak Picking 才会暴露 Peak Alignment；centroid+continuous 则根本不支持 align。
    // 定位方式：align 组的唯一方法 label 是 "Python Backend"（见 usePreprocessingMethods.ts align 组）。
    const alignMethod = page.locator('details[open] label').filter({ hasText: 'Python Backend' })
    if ((await alignMethod.count()) === 0) {
      const pickMethod = page.locator('details[open] label').filter({ hasText: 'Standard Peak Detection' })
      if ((await pickMethod.count()) > 0) {
        await pickMethod.click()
        await expect(alignMethod).toBeVisible({ timeout: 5_000 })
      }
    }
    if ((await alignMethod.count()) === 0) {
      test.skip(true, `Dataset "${name}" 不支持 Peak Alignment，无法构建对齐任务`)
      return
    }
    await alignMethod.click()

    await page.getByRole('button', { name: 'Start Analysis' }).click()

    await expect(page).toHaveURL(/\/workspace(?:\?|#|$)?/, { timeout: 30_000 })
    await expect(page.locator('h1:has-text("Workspace")')).toBeVisible()

    // 等刚创建的进程出现在表格里（状态为 Running）。
    // 按数据集名锁定行——Workspace 表可能同时有别人/并发留下的 Running 任务，
    // 裸等 'Running'.first() 会锁定到错误的行（Dataset 列显示去扩展名的数据集名）。
    const runningRow = page.locator('table tr')
      .filter({ hasText: name })
      .filter({ hasText: 'Running' })
      .first()
    await expect(runningRow).toBeVisible({ timeout: 15_000 })

    // 任务创建成功：记录数据集名，后续查看用例与 Cleanup 只认它（见文件头"状态传递"）
    createdDataset = name

    // 轮询刷新，等本次任务（按数据集名定位，不依赖"第一行=最新"的假设）
    // Running 消失。locator 是惰性的，reload 后无需重新构造。
    const myRow = page.locator('table tbody tr').filter({ hasText: name }).first()
    const deadline = Date.now() + ALIGN_WAIT_MS
    while (Date.now() < deadline) {
      await page.reload()
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
      // 等表格数据真正加载完（不再是 "Loading..."）
      await expect(myRow.locator('td').first())
        .not.toHaveText('Loading...', { timeout: 15_000 })
      if ((await myRow.getByText('Running').count()) === 0) break
      await page.waitForTimeout(10_000)
    }
    // 轮询用尽仍未结束才算失败（给足等待，避免刚过 deadline 就断言、差几秒误判）
    await expect(myRow.getByText('Running')).not.toBeVisible({ timeout: 10_000 })
  })

  test('vizworkbench — loads ion image, spectrum, metadata, and responds to click', async ({ page, browserName }) => {
    // 依赖上一用例在 chromium 提交的 Peak Alignment 任务；非 chromium 下任务不创建，skip 一致
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建，依赖它的断言不跨浏览器')
    test.setTimeout(ALIGN_TEST_TIMEOUT_MS)
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.locator('table tbody tr').first().locator('td').first()).not.toHaveText(
      'Loading...',
      { timeout: 10_000 },
    )

    // 定位 submit 创建的 Peak Alignment 任务（continuous 模式，有 selected-mz）。
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
    await expect(page.getByText(/Failed to (load|update) ion image/)).toBeHidden()

    // 确认点击后页面没崩：谱图仍在。
    await expect(page.getByRole('heading', { name: 'Spectrum View' })).toBeVisible()
  })

  test('vizworkbench — switches colormap and keeps ion image stable', async ({ page, browserName }) => {
    // 同上：依赖 chromium 提交的 Peak Alignment 任务，skip 保持一致
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建，依赖它的断言不跨浏览器')
    test.setTimeout(ALIGN_TEST_TIMEOUT_MS)
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
    await expect(page.getByText(/^Loading ion image/)).toBeHidden()
  })
})

// ============================================================
// Cleanup（serial 组之外：查看用例失败不挡清理）
// ============================================================
// 删除 submit 创建的任务。按"Methods 列 Peak Alignment + createdDataset 的
// 数据集名"定位——不能用"第一条 Completed"，工作区里可能残留 raw-convert
// （processed，无 selected-mz）等其它任务，也可能有历史 Peak Alignment 任务。

test.describe('Cleanup', () => {
  test('delete completed result', async ({ page, browserName }) => {
    // 与 submit 对应：任务只在 chromium 建，这里也只在 chromium 删
    test.skip(browserName !== 'chromium', 'Peak Alignment 任务只在 chromium 创建，清理也只在 chromium')
    // 之前这里没设全局超时 → 用配置默认 30s，而轮询预算就有 120s，任务没提前跑完必炸
    test.setTimeout(ALIGN_TEST_TIMEOUT_MS)
    // submit 没有创建任务（skip / 创建前失败）时不删任何行——
    // 宁可留下未清理的任务，也不误删历史数据
    if (!createdDataset) {
      test.skip(true, '本轮 submit 未创建 Peak Alignment 任务，不删除任何行以免误删历史数据')
      throw new Error('skipped')
    }
    await page.goto('/workspace')
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 10_000 })

    // 等本次 Peak Alignment 任务跑完（那行 Running 消失）
    const row = peakAlignmentRow(page, createdDataset)
    const deadline = Date.now() + ALIGN_WAIT_MS
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
    await expect(page.locator('.toast')).toContainText('Deleted', { timeout: 10_000 })
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

// ============================================================
// 可视化工作台（空态，无后端任务依赖，全浏览器）
// ============================================================

test.describe('Result Detail', () => {
  test('shows stale state when accessed directly', async ({ page }) => {
    await page.goto('/vizworkbench')
    await expect(page.getByText('No result selected')).toBeVisible()
  })
})
