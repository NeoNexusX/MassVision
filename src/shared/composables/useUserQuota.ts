import { ref, computed } from 'vue'
import { getUserQuota, type UserQuota } from '@/features/datasets/api/datasetApi'
import { formatBytes } from '@/shared/utils/format'

export function useUserQuota() {
  const quotaData = ref<UserQuota | null>(null)
  const loading = ref(false)

  const quota = computed(() => {
    const q = quotaData.value
    if (!q) {
      return {
        uploadUsed: '—',
        uploadMax: '—',
        uploadPercent: 0,
        fileCount: '—',
        maxFiles: '—',
        filePercent: 0,
        procUsed: '—',
        procMax: '—',
        procPercent: 0,
      }
    }
    const uploadPercent = q.max_file_size_gb
      ? Math.min(100, (q.total_uploaded_size_bytes / (q.max_file_size_gb * 1024 ** 3)) * 100)
      : 0
    const filePercent = q.max_files_per_user
      ? Math.min(100, (q.file_count / q.max_files_per_user) * 100)
      : 0
    const procPercent = q.max_processing_size_gb
      ? Math.min(
          100,
          (q.total_processed_size_bytes / (q.max_processing_size_gb * 1024 ** 3)) * 100,
        )
      : 0
    return {
      uploadUsed: formatBytes(q.total_uploaded_size_bytes),
      uploadMax: `${q.max_file_size_gb} GB`,
      uploadPercent,
      fileCount: String(q.file_count),
      maxFiles: String(q.max_files_per_user),
      filePercent,
      procUsed: formatBytes(q.total_processed_size_bytes),
      procMax: `${q.max_processing_size_gb} GB`,
      procPercent,
    }
  })

  async function fetchQuota() {
    loading.value = true
    try {
      quotaData.value = await getUserQuota()
    } catch {
      /* ignore */
    } finally {
      loading.value = false
    }
  }

  return { quotaData, quota, loading, fetchQuota }
}
