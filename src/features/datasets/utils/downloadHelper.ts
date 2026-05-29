import { getDownloadMetadata } from '@/features/datasets/api/datasetApi'

async function pollDownloadUrl(
  fileId: string,
  options?: {
    interval?: number
    maxRetries?: number
  },
): Promise<{ ossUrl: string; rawFilename?: string }> {
  const interval = options?.interval ?? 2000
  const maxRetries = options?.maxRetries ?? 30

  for (let i = 0; i <= maxRetries; i++) {
    const metaRes = await getDownloadMetadata(fileId)
    const meta = metaRes.data || metaRes
    const ossUrl: string | undefined = meta.oss_download_url

    if (ossUrl && ossUrl !== '<PACKING>') {
      return { ossUrl, rawFilename: meta.filename }
    }

    if (i < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  throw new Error('Download preparation timed out, please try again later')
}

/**
 * OSS download: poll for oss_download_url → trigger browser download.
 */
export async function ossDownloadAndSave(
  fileId: string,
  options?: { getFallbackFilename?: () => string | undefined },
) {
  const { ossUrl, rawFilename } = await pollDownloadUrl(fileId)

  const filename: string = rawFilename
    ? rawFilename.toLowerCase().endsWith('.zip')
      ? rawFilename
      : `${rawFilename}.zip`
    : options?.getFallbackFilename?.() || `${fileId}.zip`

  const link = document.createElement('a')
  link.href = ossUrl
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
