<template>
  <div class="bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
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
import HeroSection from '../components/home/HeroSection.vue';
import FeatureCards from '../components/home/FeatureCards.vue';
import StatsSection from '../components/home/StatsSection.vue';
import FooterSection from '../components/home/FooterSection.vue';
</script>