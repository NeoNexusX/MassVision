import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * 公开 Overview 分享链接 E2E — 真实后端
 * ====================================
 * 路由 /s/:encodedId（router/index.ts 的 SharedDatasetOverview）。
 * encodedId 是 file_id 的 URL-safe Base64，解析规则见
 * features/datasets/utils/overviewShareLink.ts。
 *
 * 分享链接面向未登录访客：这里显式清空登录态，走匿名的公开接口，
 * 与「登录用户从列表页进入 Overview」是两条不同的路径。
 */

test.use({ storageState: { cookies: [], origins: [] } })

/** URL-safe Base64（与 encodeOverviewFileId 同规则） */
function encodeFileId(fileId: number | string): string {
  return Buffer.from(String(fileId))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** 从后端取一个真实的公开数据集，取不到则由调用方 test.skip */
async function firstPublicFile(request: APIRequestContext) {
  const res = await request.post('/api/files/list_files?page=1&size=1', { data: {} })
  if (!res.ok()) return null
  const body = await res.json()
  const item = body?.data?.[0]
  return item ? { fileId: item.file_id as number, filename: item.filename as string } : null
}

test.describe('Shared Dataset Overview', () => {
  test('opens a public dataset for a signed-out visitor', async ({ page, request }) => {
    const file = await firstPublicFile(request)
    if (!file) {
      test.skip(true, 'No public dataset available on this backend')
      return
    }

    await page.goto(`/s/${encodeFileId(file.fileId)}`)

    await expect(page.locator('h1:has-text("Dataset Overview")')).toBeVisible()
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })

    await expect(page.getByText(file.filename).first()).toBeVisible()
    await expect(page.getByText('File Information')).toBeVisible()
    await expect(page.getByText('Invalid share link')).toHaveCount(0)
  })

  test('treats a malformed id as an invalid link', async ({ page }) => {
    await page.goto('/s/not-base64-%20')

    await expect(page.getByText('Invalid share link')).toBeVisible()
    await expect(page.getByText('This public overview link is invalid.')).toBeVisible()
  })

  test('reports a link that decodes but points nowhere', async ({ page }) => {
    // 合法编码、后端无此公开文件 → 不是「链接无效」，而是「查不到数据」
    await page.goto(`/s/${encodeFileId(999_999_999)}`)

    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText('No data available')).toBeVisible()
  })

  test('sends the visitor back to the public dataset list', async ({ page, request }) => {
    const file = await firstPublicFile(request)
    if (!file) {
      test.skip(true, 'No public dataset available on this backend')
      return
    }

    await page.goto(`/s/${encodeFileId(file.fileId)}`)
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Back to Public Datasets' }).click()

    await expect(page).toHaveURL(/\/datasets/)
    await expect(page.locator('h1:has-text("Public Datasets")')).toBeVisible()
  })
})
