<template>
  <!-- 场景式全屏滚动叙事容器：自身为滚动根，轻量 proximity 吸附 -->
  <div class="home-scroll bg-base-100 text-base-content">
    <HeroScene />
    <FeatureScene />
    <StatsScene />
    <FooterScene />
  </div>
</template>

<script setup lang="ts">
import HeroScene from '@/features/home/components/HeroScene.vue'
import FeatureScene from '@/features/home/components/FeatureScene.vue'
import StatsScene from '@/features/home/components/StatsScene.vue'
import FooterScene from '@/features/home/components/FooterScene.vue'
</script>

<style scoped>
.home-scroll {
  height: 100vh; /* 回退 */
  height: 100svh;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
  overscroll-behavior-y: contain;
}
</style>
