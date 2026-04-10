<template>
  <div class="py-16 bg-base-100 dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:flex md:flex-wrap gap-8 text-center">

        <!-- Column 1 -->
        <div class="flex-1 min-w-[250px] flex flex-col items-center justify-center p-8 bg-base-200 rounded-2xl shadow-sm border border-base-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <span class="text-sm font-bold text-base-content/60 dark:text-base-content/50 uppercase tracking-wider mb-3">Mass Spec Community</span>
          <div class="flex items-baseline gap-2">
            <span class="text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">{{ usersCount }}k+</span>
          </div>
          <span class="text-base font-medium text-base-content mt-2">Active Researchers</span>
        </div>

        <!-- Column 2 (Original Column 3) -->
        <div class="flex-1 min-w-[250px] flex flex-col items-center justify-center p-8 bg-base-200 rounded-2xl shadow-sm border border-base-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <span class="text-sm font-bold text-base-content/60 dark:text-base-content/50 uppercase tracking-wider mb-3">Curated MS Data</span>
          <div class="flex items-baseline gap-2">
            <span class="text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-400">{{ datasetsCount }}k+</span>
          </div>
          <span class="text-base font-medium text-base-content mt-2">Mass Spectrometry Datasets</span>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const usersCount = ref(0);
const pubsCount = ref(0);
const datasetsCount = ref(0);

const animateValue = (refVal: any, start: number, end: number, duration: number) => {
  let startTimestamp: number | null = null;
  const step = (timestamp: number) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    refVal.value = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
};

onMounted(() => {
  animateValue(usersCount, 0, 15, 1500);
  // animateValue(pubsCount, 0, 1200, 2000); // Removed
  animateValue(datasetsCount, 0, 85, 1800);
});
</script>