import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DOWNLOAD_LIMIT } from '@/shared/config/defaults'

export const useDownloadStore = defineStore('download', () => {
  /** Timestamp of the last successful download (ms) — cooldown only after success */
  const lastDownloadTime = ref(0)
  /** File ID of the last download */
  const lastDownloadId = ref('')
  /** Whether a download is currently in progress */
  const downloading = ref(false)

  /** Seconds remaining before next download is allowed */
  function cooldownRemaining(): number {
    if (!lastDownloadTime.value) return 0
    const elapsed = (Date.now() - lastDownloadTime.value) / 1000
    return Math.max(0, DOWNLOAD_LIMIT.cooldownSeconds - elapsed)
  }

  /** Whether any download is currently allowed */
  function canDownload(): boolean {
    if (downloading.value) return false
    return cooldownRemaining() <= 0
  }

  /** Record that a download has started */
  function startDownload(fileId: string) {
    downloading.value = true
    lastDownloadId.value = fileId
  }

  /** Record that a download has completed successfully — starts the cooldown */
  function completeDownload() {
    downloading.value = false
    lastDownloadTime.value = Date.now()
  }

  /** Record that a download has failed — no cooldown, user can retry immediately */
  function failDownload() {
    downloading.value = false
  }

  return {
    lastDownloadTime,
    lastDownloadId,
    downloading,
    cooldownRemaining,
    canDownload,
    startDownload,
    completeDownload,
    failDownload,
  }
})
