<template>
  <div class="py-24 sm:py-32 bg-base-100 dark:bg-gray-900 transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Section Header -->
      <div class="text-center max-w-2xl mx-auto mb-16">
        <h2 class="text-3xl font-bold tracking-tight text-base-content dark:text-white sm:text-4xl">
          Mass Spectrometry Workflow Tools
        </h2>
        <p class="mt-4 text-lg leading-8 text-base-content/70 dark:text-base-content/40">
          Cloud-native tools to streamline every step of mass spectrometry data analysis—from raw
          data upload to metabolite visualization.
        </p>
      </div>

      <!-- Grid: mobile 1 column, md+ 2 columns -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <!-- Card 1 -->
        <div
          class="w-full group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300"
        >
          <div
            class="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-6 text-primary dark:text-indigo-400 group-hover:scale-110 transition-transform"
          >
            <SvgIcon type="bolt" class="w-8 h-8" />
          </div>
          <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">
            Feature-based Molecular Networking
          </h3>
          <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
            Visualize chemical relationships across your samples. Our molecular networking tools
            help you discover analogous compounds and map complex metabolic pathways with ease.
          </p>
          <a
            href="#"
            class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold group-hover:underline inline-flex items-center"
          >
            Explore Networks
            <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>

        <!-- Card 2 (Old Card 3) -->
        <div
          class="w-full group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300"
        >
          <div
            class="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"
          >
            <SvgIcon type="institution" class="w-8 h-8" />
          </div>
          <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">
            Simplified MS Workflows
          </h3>
          <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
            Upload raw mass spectrometry data in minutes with our intuitive interface. Follow
            step-by-step guides to master data preprocessing, annotation, and visualization—no
            advanced coding required.
          </p>
          <a
            href="#"
            class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold group-hover:underline inline-flex items-center"
          >
            Quick Start Guide
            <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>

        <!-- Card 3 (Old Card 2) -->
        <div
          class="w-full group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300"
        >
          <div
            class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
          >
            <SvgIcon type="search" class="w-8 h-8" />
          </div>
          <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">
            Curated MS Knowledgebase
          </h3>
          <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
            Access our growing library of standardized mass spectrometry datasets and metabolite
            references. Compare your results against peer-reviewed data and export insights in
            industry-standard formats.
          </p>
          <a
            href="#"
            class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold group-hover:underline inline-flex items-center"
          >
            Browse Repository
            <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>

        <!-- Card 4 -->
        <div
          class="w-full group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300"
        >
          <div
            class="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform"
          >
            <SvgIcon type="duplicate" class="w-8 h-8" />
          </div>
          <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">
            Reproducible Analysis
          </h3>
          <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
            Ensure scientific rigor with traceable analysis pipelines. Share your methods,
            parameters, and datasets with collaborators to guarantee reproducible results every
            time.
          </p>
          <a
            href="#"
            class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold group-hover:underline inline-flex items-center"
          >
            Learn More
            <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// SvgIcon is globally registered in main.ts
</script>
