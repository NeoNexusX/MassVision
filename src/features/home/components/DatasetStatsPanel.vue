<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import DonutStatSection from './DonutStatSection.vue'
import {
  useOrganismStats,
  useDatasetCategoryStats,
  useDatasetIonSourceStats,
  useAnalyzerStats,
  usePlatformOverview,
  useVisitsStats,
} from '../composables/useHomeStats'

/**
 * StatsScene 左侧统计面板：三张独立卡片纵向堆叠
 * - 卡片①：数据集分类分布环形图（{@link DonutStatSection}）
 * - 卡片②：数据集离子源类型分布环形图
 * - 卡片③：四个 DaisyUI stat（总用户 / 总数据集 / 总下载 / 网站访问量）
 *
 * 大屏（lg）高度由父容器（StatsScene）统一约束为 90dvh，
 * 与右侧 {@link RepoCommitHeatmap} 通过父容器保持等高；
 * 两张环形图卡片 flex-1 等分剩余高度，stat 卡片随内容。
 */

// 环形图数据（4 个 2×2 排列）
const org = useOrganismStats()
const cat = useDatasetCategoryStats()
const ion = useDatasetIonSourceStats()
const ana = useAnalyzerStats()
const donutSections = [
  { title: 'Organism', total: org.total, loading: org.loading, error: org.error, isEmpty: org.isEmpty, items: org.items, reload: org.reload },
  { title: 'Organism Parts', total: cat.total, loading: cat.loading, error: cat.error, isEmpty: cat.isEmpty, items: cat.items, reload: cat.reload },
  { title: 'Ion Source Types', total: ion.total, loading: ion.loading, error: ion.error, isEmpty: ion.isEmpty, items: ion.items, reload: ion.reload },
  { title: 'Analyzer', total: ana.total, loading: ana.loading, error: ana.error, isEmpty: ana.isEmpty, items: ana.items, reload: ana.reload },
]

// 平台总览
const { loading: ovLoading, error: ovError, stats: ov, reload: reloadOv } = usePlatformOverview()

// 全站访问量
const { loading: visitsLoading, error: visitsError, stats: visitStats, reload: reloadVisits } = useVisitsStats()

function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString()
}

// stat 卡片项（总用户 / 总数据集 / 总下载 / 网站访问量）
const statItems = computed(() => [
  { icon: 'heroicons:user-group', color: 'text-primary', title: 'Total Users', value: ov.value?.total_users },
  { icon: 'heroicons:circle-stack', color: 'text-secondary', title: 'Total Datasets', value: ov.value?.total_files },
  { icon: 'heroicons:arrow-down-tray', color: 'text-accent', title: 'Total Downloads', value: ov.value?.total_downloads },
  { icon: 'heroicons:arrow-trending-up', color: 'text-info', title: 'Website Visits', value: visitStats.value?.total },
])
</script>

<template>
  <!-- 三张独立卡片纵向堆叠；大屏高度由父容器统一约束，与右侧等高 -->
  <div class="flex w-full flex-col gap-6 lg:h-full">
    <!-- 4 张环形图卡片 2×2 排列，等分剩余高度 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-6 flex-1 min-h-0">
      <div
        v-for="s in donutSections"
        :key="s.title"
        class="card border border-base-300 bg-base-100 shadow-sm min-h-0"
      >
        <div class="card-body p-6 text-[clamp(1rem,12vw,4rem)] min-h-0 flex flex-col">
          <DonutStatSection
            :title="s.title"
            :caption="`${fmt(s.total.value)} datasets total`"
            :loading="s.loading.value"
            :error="s.error.value"
            :is-empty="s.isEmpty.value"
            :items="s.items.value"
            @reload="s.reload"
          />
        </div>
      </div>
    </div>

    <!-- 卡片③：平台总览 + 网站访问量（四个 stat，高度随内容，不参与等分）-->
    <div class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <!-- Error（总览失败） -->
        <div
          v-if="ovError"
          role="alert"
          class="alert alert-error gap-2 p-3 text-sm"
        >
          <Icon icon="heroicons:exclamation-triangle" class="h-5 w-5 shrink-0" />
          <span class="flex-1">{{ ovError }}</span>
          <button class="btn btn-ghost btn-xs" @click="reloadOv">Retry</button>
        </div>

        <!-- Error（访问量接口独立失败） -->
        <div
          v-if="visitsError && !ovError"
          role="alert"
          class="alert alert-warning gap-2 p-3 text-sm"
        >
          <Icon icon="heroicons:exclamation-triangle" class="h-5 w-5 shrink-0" />
          <span class="flex-1">{{ visitsError }}</span>
          <button class="btn btn-ghost btn-xs" @click="reloadVisits">Retry</button>
        </div>

        <div v-else class="stats stats-vertical w-full border border-base-300 sm:stats-horizontal">
          <div v-for="s in statItems" :key="s.title" class="stat">
            <div class="stat-figure" :class="s.color">
              <Icon :icon="s.icon" class="h-7 w-7" />
            </div>
            <div class="stat-title">{{ s.title }}</div>
            <div v-if="ovLoading || visitsLoading" class="stat-value">
              <span class="loading loading-spinner loading-sm align-middle" />
            </div>
            <div v-else class="stat-value" :class="s.color">{{ fmt(s.value) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
