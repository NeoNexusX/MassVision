import { getDownloadRaw } from '@/features/datasets/api/datasetApi'
import { t } from '@/i18n'

/**
 * Trigger a browser download inside its own browsing context via a hidden iframe.
 *
 * Each download gets a dedicated iframe, so starting the next download cannot
 * abort a still-in-flight previous one. Clicking several top-level <a> elements
 * in the same window did have that failure mode: the second navigation cancels
 * the first before its response commits, which on slower links (e.g. a farther
 * OSS region) silently dropped the first file (imzML) while the last one (ibd)
 * won.
 *
 * The download and its filename both come from the OSS pre-signed URL's
 * `Content-Disposition: attachment` header — the cross-origin `download`
 * attribute is ignored by browsers, so no anchor is needed.
 *
 * The iframe is removed only after the response has had time to detach to the
 * browser's download manager; removing it earlier would cancel the transfer.
 */
function triggerIframeDownload(url: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  window.setTimeout(() => iframe.remove(), 60_000)
}

/**
 * RAW pre-signed download: GET /files/{file_id}/download_raw → imzML + ibd URLs.
 * No polling — pre-signed URLs are returned immediately.
 * Each file downloads in its own hidden iframe so they can't cancel each other.
 */
export async function ossDownloadRaw(
  fileId: string,
  _options?: { getFallbackFilename?: () => string | undefined },
) {
  const { files } = await getDownloadRaw(fileId)

  if (!files || !files.length) {
    throw new Error(t('datasets.download.noUrls'))
  }

  for (const entry of files) {
    triggerIframeDownload(entry.url)
  }
}
