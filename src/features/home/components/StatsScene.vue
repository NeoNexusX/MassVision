<script setup lang="ts">
import BaseScene from './BaseScene.vue'
import RepoCommitHeatmap from './RepoCommitHeatmap.vue'
import DatasetStatsPanel from './DatasetStatsPanel.vue'
import { getContent } from '@/features/home/config/contentConfig'

const hm = getContent().githubHeatmap
</script>

<template>
  <BaseScene id="stats" class="bg-base-200">
    <!-- Section 标题 -->
    <h2
      class="mt-6 mb-2 bg-gradient-to-br from-primary via-primary/70 to-primary/30 bg-clip-text text-transparent font-bold text-[clamp(1.8rem,1rem+4vw,3.5rem)] leading-tight"
    >
      Stats
    </h2>

    <!-- 左右两栏：左=数据集统计面板，右=commit 热力图；大屏并排、小屏堆叠 -->
    <div class="py-2 flex w-full max-w-6xl flex-col items-start justify-center gap-8 lg:flex-row lg:h-[90dvh] lg:items-stretch"
      >
        <!-- Left: 数据集分类分布环形图 + 三个总览 stat -->
        <DatasetStatsPanel class="w-full lg:flex-1 lg:min-w-0" />

        <!-- Right: Heatmap -->
        <RepoCommitHeatmap
          v-if="hm?.owner && hm?.repo"
          :owner="hm.owner"
          :repo="hm.repo"
          :branch="hm.branch"
          :days="hm.days"
          :title="hm.title"
          :repo-url="hm.repoUrl"
          :orientation="hm.orientation"
          class="w-full lg:w-[22rem] lg:shrink-0"
        />
      </div>
  </BaseScene>
</template>
