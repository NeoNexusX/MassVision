<template>
  <div class="py-24 sm:py-32 bg-base-100 dark:bg-gray-900 transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      <!-- Section Header -->
      <div class="text-center max-w-2xl mx-auto mb-16">
         <h2 class="text-3xl font-bold tracking-tight text-base-content dark:text-white sm:text-4xl">Mass Spectrometry Workflow Tools</h2>
         <p class="mt-4 text-lg leading-8 text-base-content/70 dark:text-base-content/40">
            Cloud-native tools to streamline every step of mass spectrometry data analysis—from raw data upload to metabolite visualization.
         </p>
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        
        <!-- Card 1 -->
        <div class="group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300">
           <div class="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-6 text-primary dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
           </div>
           <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">Feature-based Molecular Networking</h3>
           <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
             Visualize chemical relationships across your samples. Our molecular networking tools help you discover analogous compounds and map complex metabolic pathways with ease.
           </p>
           <a href="#" class="text-primary dark:text-indigo-400 font-bold group-hover:underline flex items-center inline-block">
             Explore Networks <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
           </a>
        </div>

        <!-- Card 2 (Old Card 3) -->
        <div class="group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300">
           <div class="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
           </div>
           <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">Simplified MS Workflows</h3>
           <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
             Upload raw mass spectrometry data in minutes with our intuitive interface. Follow step-by-step guides to master data preprocessing, annotation, and visualization—no advanced coding required.
           </p>
           <a href="#" class="text-primary dark:text-indigo-400 font-bold group-hover:underline flex items-center inline-block">
             Quick Start Guide <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
           </a>
        </div>

        <!-- Card 3 (Old Card 2) -->
        <div class="group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-base-300">
           <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
           </div>
           <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">Curated MS Knowledgebase</h3>
           <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
             Access our growing library of standardized mass spectrometry datasets and metabolite references. Compare your results against peer-reviewed data and export insights in industry-standard formats.
           </p>
           <a href="#" class="text-primary dark:text-indigo-400 font-bold group-hover:underline flex items-center inline-block">
             Browse Repository <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
           </a>
        </div>

        <!-- Card 4 -->
        <div class="group relative p-8 bg-base-200 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-transparent hover:border-primary/20 dark:hover:border-primary/20">
           <div class="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
           </div>
           <h3 class="text-xl font-bold text-base-content dark:text-white mb-3">Reproducible Analysis</h3>
           <p class="text-base-content/70 dark:text-base-content/50 mb-6 leading-relaxed">
             Ensure scientific rigor with traceable analysis pipelines. Share your methods, parameters, and datasets with collaborators to guarantee reproducible results every time.
           </p>
           <a href="#" class="text-primary dark:text-indigo-400 font-bold group-hover:underline flex items-center inline-block">
             Learn More <span class="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
           </a>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No script needed for static cards
</script>