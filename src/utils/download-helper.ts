import { downloadFile } from './file-api'

export type GetFallbackFilename = () => string | undefined

export type DownloadOptions = {
  getFallbackFilename?: GetFallbackFilename
  onProgress?: (percent: number) => void
}

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
