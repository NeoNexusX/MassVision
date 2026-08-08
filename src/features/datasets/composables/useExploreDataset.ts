import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { rawConvertProcess } from '@/features/datasets/api/datasetApi'
import { parseAlgorithms } from '@/features/workspace/utils/methodsNormalize'
import { useToast } from '@/shared/composables/useToast'
import { useAuthStore } from '@/shared/auth/authStore'
import { extractBackendError } from '@/shared/api/httpClient'
import type { File } from '@/features/datasets/types/dataset'

export function useExploreDataset() {
  const router = useRouter()
  const { showToast } = useToast()
  const auth = useAuthStore()

  const showExploreConfirm = ref(false)
  const exploringDataset = ref<File | null>(null)
  const isConverting = ref(false)

  const openExploreConfirm = (dataset: File) => {
    exploringDataset.value = dataset
    showExploreConfirm.value = true
  }

  const cancelExplore = () => {
    showExploreConfirm.value = false
    exploringDataset.value = null
  }

  const confirmExplore = async () => {
    const ds = exploringDataset.value
    if (!ds) return
    isConverting.value = true
    try {
      const result = await rawConvertProcess(ds.id)
      const runId = result.id
      // 更新本地数据集记录，下次点击直接进 View
      ds.defaultRunId = runId

      // 判断当前用户是否为该任务的创建者
      const currentUserId = auth.user?.id
      const isOwner = currentUserId != null && result.user_id === currentUserId

      // 不管是首次还是重复调用，成功提示都一样
      showToast('Task is in progress, please wait.', 'success')

      if (isOwner) {
        // 创建者 → 跳转到 Workspace
        router.push({
          name: 'Workspace',
          state: { runId, datasetName: ds.filename || ds.name, fileId: ds.id },
        })
      }
    } catch (error) {
      const message = extractBackendError(error, 'Failed to create visualization task')
      showToast(message, 'error')
      console.error('raw-convert failed:', error)
    } finally {
      isConverting.value = false
      showExploreConfirm.value = false
      exploringDataset.value = null
    }
  }

  /**
   * 根据 Dataset 的状态决定 Explore 的行为：
   * - 有 defaultRunId → 直接跳转 ResultDetail
   * - 无 defaultRunId → 弹出确认对话框创建新任务
   */
  const handleExplore = (fileId: string, datasets: File[]) => {
    const ds = datasets.find((d) => d.id === fileId)
    if (!ds) return

    if (ds.defaultRunId) {
      // 已有可视化任务 → 直接查看结果
      router.push({
        name: 'WorkspaceResultDetail',
        state: {
          runId: String(ds.defaultRunId),
          datasetName: ds.filename || ds.name,
          fileId: Number(ds.id),
          // defaultRunId 恒为 raw-convert 可视化任务（rawConvertProcess 创建），
          // 其 params_json 约定为 '__RAW_CONVERT__'；与 workspace 列表解析出的 methods 一致
          methods: parseAlgorithms('__RAW_CONVERT__'),
        },
      })
    } else {
      // 无任务 → 弹出确认框
      openExploreConfirm(ds)
    }
  }

  return {
    showExploreConfirm,
    exploringDataset,
    isConverting,
    openExploreConfirm,
    cancelExplore,
    confirmExplore,
    handleExplore,
  }
}
