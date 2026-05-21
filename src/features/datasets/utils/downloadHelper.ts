import { getDownloadMetadata } from '@/features/datasets/api/datasetApi'

/**
 * OSS download: fetch metadata → get oss_download_url → trigger browser download.
 */
export async function ossDownloadAndSave(
  fileId: string,
  options?: { getFallbackFilename?: () => string | undefined },
) {
  // Step 1: Get download metadata (JSON with oss_download_url, filename, etc.)
  const metaRes = await getDownloadMetadata(fileId)
  const meta = metaRes.data || metaRes
  const ossUrl: string | undefined = meta.oss_download_url
  const filename: string = meta.filename
    ? meta.filename.toLowerCase().endsWith('.zip')
      ? meta.filename
      : `${meta.filename}.zip`
    : options?.getFallbackFilename?.() || `${fileId}.zip`

  if (!ossUrl) {
    throw new Error('Backend did not return oss_download_url')
  }

  // Step 2: Direct browser download via OSS signed URL
  const link = document.createElement('a')
  link.href = ossUrl
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
