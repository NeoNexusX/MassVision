import axios from 'axios';
import { downloadFile, getDownloadMetadata } from './file-api'

export type GetFallbackFilename = () => string | undefined

export type DownloadOptions = {
  getFallbackFilename?: GetFallbackFilename
  onProgress?: (percent: number) => void
}

/**
 * OSS download: fetch metadata → get oss_download_url → download from OSS → save.
 */
export async function ossDownloadAndSave(fileId: string, options?: DownloadOptions) {
  const { onProgress } = options || {}

  // Step 1: Get download metadata (JSON with oss_download_url, filename, etc.)
  const metaRes = await getDownloadMetadata(fileId)
  const meta = metaRes.data || metaRes
  const ossUrl: string | undefined = meta.oss_download_url
  const filename: string = meta.filename
    ? (meta.filename.toLowerCase().endsWith('.zip') ? meta.filename : `${meta.filename}.zip`)
    : `${fileId}.zip`

  if (!ossUrl) {
    throw new Error('Backend did not return oss_download_url')
  }

  // Step 2: Download file from OSS signed URL
  const response = await axios.get(ossUrl, {
    responseType: 'blob',
    onDownloadProgress: (progressEvent: any) => {
      if (progressEvent && progressEvent.total && typeof onProgress === 'function') {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        try { onProgress(percent) } catch (e) { /* ignore callback errors */ }
      }
    }
  })

  // Step 3: Save to local
  const blob = new Blob([response.data], { type: 'application/zip' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Legacy download: direct blob response from backend.
 */
export async function downloadAndSave(fileId: string, options?: DownloadOptions) {
  const { getFallbackFilename, onProgress } = options || {}

  try {
    const response = await downloadFile(fileId, (progressEvent: any) => {
      if (progressEvent && progressEvent.total && typeof onProgress === 'function') {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        try { onProgress(percent) } catch (e) { /* ignore callback errors */ }
      }
    })

    // Determine filename from headers, fallback to provided getter or id.zip
    let filename = `${fileId}.zip`
    const cd = (response.headers && (response.headers['content-disposition'] || response.headers['Content-Disposition'])) as string | undefined
    if (cd) {
      const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
      if (match && match[1]) filename = match[1].replace(/['"]/g, '').trim()
      const utf8Match = cd.match(/filename\*=utf-8''([^;\n]*)/i)
      if (utf8Match && utf8Match[1]) {
        try {
          filename = decodeURIComponent(utf8Match[1])
        } catch (e) {
          // Ignore malformed percent-encoding in header and keep previous filename
        }
      }
    } else if (getFallbackFilename) {
      const f = getFallbackFilename()
      if (f) filename = f.toLowerCase().endsWith('.zip') ? f : `${f}.zip`
    }

    const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    throw err
  }
}
