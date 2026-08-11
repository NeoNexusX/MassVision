import { computed, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { CalendarItem, TooltipFormatter } from 'vue3-calendar-heatmap'
import { useTheme } from '@/shared/composables/useTheme'
import {
  fetchCommitHeatmap,
  toDateStr,
} from '../api/githubApi'
import type { FetchCommitHeatmapOptions, HeatValue } from '@/features/home/types/github'

// 颜色梯度：库的 getColorIndex 返回 0~5，必须给满 6 个颜色。
// 索引：0=无数据(区间外) 1=当天 0 条 2/3/4=低/中/高 5=达到 max。
// ⚠️ 少于 6 个会让 count==max 的格子读到 undefined → 渲染成黑色。
const LIGHT_COLORS = ['#ebedf0', '#ebedf0', '#c4d4fb', '#8caaf8', '#4b72e4', '#2d4fc0']
const DARK_COLORS = ['#161b22', '#161b22', '#1a3070', '#2d52c4', '#4f72f0', '#7ca2fb']

/**
 * 提交热力图的响应式状态封装。
 *
 * 传入一个返回参数的 getter（owner/repo/branch/days 变化会自动重新拉取）。
 * 数据获取、缓存、限流处理都在 {@link fetchCommitHeatmap} 里，这里只把结果接到响应式状态、
 * 并派生出热力图组件需要的 max / 配色 / tooltip。
 */
export function useCommitHeatmap(params: MaybeRefOrGetter<FetchCommitHeatmapOptions>) {
  const { isDark } = useTheme()

  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const values = ref<HeatValue[]>([])
  const total = ref(0)
  const activeDays = ref(0)

  // Computed（供 <CalendarHeatmap> 绑定）
  const maxCount = computed(() => Math.max(1, ...values.value.map((v) => v.count)))
  const rangeColor = computed(() => (isDark.value ? DARK_COLORS : LIGHT_COLORS))
  const endDate = computed(() => toDateStr(new Date()))

  // tooltip：2026-06-10: 3 commits
  const tooltipFormatter: TooltipFormatter = (item: CalendarItem, unit: string) =>
    `${toDateStr(item.date)}: ${item.count ?? 0} ${unit}`

  // Methods
  async function load() {
    loading.value = true
    error.value = null
    try {
      const r = await fetchCommitHeatmap(toValue(params))
      values.value = r.values
      total.value = r.total
      activeDays.value = r.activeDays
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取数据失败'
    } finally {
      loading.value = false
    }
  }

  // owner/repo/branch/days 任一变化即重新拉取
  watch(
    () => {
      const p = toValue(params)
      return [p.owner, p.repo, p.branch, p.days] as const
    },
    load,
  )
  onMounted(load)

  return {
    loading,
    error,
    values,
    total,
    activeDays,
    maxCount,
    rangeColor,
    endDate,
    tooltipFormatter,
    isDark,
  }
}
