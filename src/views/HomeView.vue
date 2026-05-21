<template>
  <div class="bg-base-200 dark:bg-gray-900 overflow-x-hidden">
    <!-- Hero Section -->
    <HeroSection />

    <!-- Feature Cards -->
    <FeatureCards />

    <!-- Stats Section -->
    <StatsSection />

    <!-- Footer Section -->
    <FooterSection />
  </div>
</template>

<script setup lang="ts">
import HeroSection from '@/features/home/components/HeroSection.vue'
import FeatureCards from '@/features/home/components/FeatureCards.vue'
import StatsSection from '@/features/home/components/StatsSection.vue'
import FooterSection from '@/features/home/components/FooterSection.vue'
</script>
