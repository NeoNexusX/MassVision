import { computed, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { CalendarItem, Locale as HeatmapLocale, TooltipFormatter } from 'vue3-calendar-heatmap'
import { i18n, t } from '@/i18n'
import { useTheme } from '@/shared/composables/useTheme'
import { formatTime } from '@/shared/utils/format'
import { fetchCommitHeatmap, toDateStr } from '../api/githubApi'
import { GithubRateLimitError } from '../types/github'
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
  const error = ref<unknown>(null)
  const values = ref<HeatValue[]>([])
  const total = ref(0)
  const activeDays = ref(0)

  let requestId = 0

  // Computed（供 <CalendarHeatmap> 绑定）
  const maxCount = computed(() => Math.max(1, ...values.value.map((v) => v.count)))
  const rangeColor = computed(() => (isDark.value ? DARK_COLORS : LIGHT_COLORS))
  const endDate = computed(() => toDateStr(new Date()))

  // tooltip：2026-06-10: 3 commits
  // 单/复数合并成一条带 `|` 的消息（choice===1 取前段，其余取后段；zh 只有一段，不受影响）
  const tooltipFormatter: TooltipFormatter = (item: CalendarItem) =>
    t('home.heatmap.tooltip', { date: toDateStr(item.date), count: item.count ?? 0 }, item.count ?? 0)

  // 库自带的月份 / 星期 / 图例文字写死英文。月份和星期交给 Intl 按界面语言生成（zh 为「9月」「周一」），
  // 只有图例的 Less / More 需要进语言包；`on` 只用于库的默认 tooltip，已被上面的 formatter 取代。
  const heatmapLocale = computed<Partial<HeatmapLocale>>(() => {
    const lang = i18n.global.locale.value
    const month = new Intl.DateTimeFormat(lang, { month: 'short' })
    const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' })
    return {
      months: Array.from({ length: 12 }, (_, m) => month.format(new Date(2026, m, 1))),
      // 库按周日开头取下标；2026-01-04 是周日
      days: Array.from({ length: 7 }, (_, d) => weekday.format(new Date(2026, 0, 4 + d))),
      less: t('home.heatmap.less'),
      more: t('home.heatmap.more'),
    }
  })

  // Methods
  async function load() {
    const currentRequest = ++requestId
    loading.value = true
    error.value = null
    try {
      const r = await fetchCommitHeatmap(toValue(params))
      if (currentRequest !== requestId) return
      values.value = r.values
      total.value = r.total
      activeDays.value = r.activeDays
    } catch (e) {
      if (currentRequest !== requestId) return
      error.value = e
    } finally {
      if (currentRequest === requestId) loading.value = false
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

  // 存错误对象、在 computed 里出文案：切换语言后报错文字也跟着变
  const errorMessage = computed(() => {
    const e = error.value
    if (e instanceof GithubRateLimitError) {
      const time = e.resetAt ? formatTime(e.resetAt) : t('home.heatmap.unknownTime')
      return t('home.heatmap.rateLimited', { remaining: e.remaining, time })
    }
    // GitHub 返回的 message 原样透传
    if (e instanceof Error) return e.message
    return e ? t('home.heatmap.loadFailed') : ''
  })

  return {
    loading,
    error: errorMessage,
    values,
    total,
    activeDays,
    maxCount,
    rangeColor,
    endDate,
    tooltipFormatter,
    heatmapLocale,
    isDark,
  }
}
