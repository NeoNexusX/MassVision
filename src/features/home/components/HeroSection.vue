<template>
  <div
    class="relative overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 pt-32 pb-20 sm:pt-40 sm:pb-24 transition-colors duration-300"
  >
    <!-- Abstract Background Elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-200/20 dark:bg-primary/10 blur-3xl animate-pulse"
      ></div>
      <div
        class="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-200/20 dark:bg-blue-500/10 blur-3xl"
        style="animation-delay: 1s"
      ></div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        <!-- Left: Abstract Visual -->
        <div
          class="w-full lg:w-1/2 flex justify-center lg:justify-start order-2 lg:order-1 fade-in-element"
        >
          <div class="relative w-full max-w-lg aspect-square">
            <!-- Molecular / Mass Spec Visual Abstract -->
            <svg
              viewBox="0 0 500 500"
              class="w-full h-full drop-shadow-2xl text-primary dark:text-indigo-400"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <!-- 1. Background Grid (Scientific Foundation) -->
              <g class="opacity-10 dark:opacity-20" stroke-dasharray="4 4" stroke-width="1">
                <line x1="50" y1="400" x2="450" y2="400" />
                <line x1="50" y1="300" x2="450" y2="300" />
                <line x1="50" y1="200" x2="450" y2="200" />
                <line x1="50" y1="100" x2="450" y2="100" />
                <line x1="150" y1="50" x2="150" y2="450" />
                <line x1="250" y1="50" x2="250" y2="450" />
                <line x1="350" y1="50" x2="350" y2="450" />
              </g>

              <!-- 2. Baseline -->
              <line
                x1="50"
                y1="400"
                x2="450"
                y2="400"
                stroke-width="2"
                class="text-base-content opacity-50"
              />

              <!-- 3. Mass Spectrum Peaks (Simplified Signal) -->
              <g transform="translate(0, 0)">
                <!-- Noise Floor / Small Peaks -->
                <g class="opacity-40" stroke-width="1.5">
                  <line x1="80" y1="400" x2="80" y2="380" />
                  <line x1="130" y1="400" x2="130" y2="370" />
                  <line x1="340" y1="400" x2="340" y2="385" />
                  <line x1="410" y1="400" x2="410" y2="375" />
                </g>
                -
                <!-- Highlighted Peak Group (Main Signal) -->
                <g class="text-primary dark:text-indigo-400">
                  <!-- Monoisotopic Peak -->
                  <line x1="250" y1="400" x2="250" y2="120" stroke-width="5" />
                  <circle
                    cx="250"
                    cy="120"
                    r="6"
                    fill="currentColor"
                    class="text-indigo-100 dark:text-indigo-900 stroke-current stroke-2"
                  />

                  <!-- Isotope +1 -->
                  <line x1="270" y1="400" x2="270" y2="220" stroke-width="3" class="opacity-80" />
                  <circle cx="270" cy="220" r="4" fill="currentColor" class="opacity-80" />

                  <!-- Isotope +2 -->
                  <line x1="290" y1="400" x2="290" y2="340" stroke-width="2" class="opacity-60" />
                  <circle cx="290" cy="340" r="3" fill="currentColor" class="opacity-60" />
                </g>

                <!-- Secondary Peak Group -->
                <g class="text-indigo-400 dark:text-primary-content opacity-90">
                  <line x1="160" y1="400" x2="160" y2="280" stroke-width="3" />
                  <circle cx="160" cy="280" r="4" fill="currentColor" />
                </g>

                <!-- Tertiary Peak -->
                <g class="text-indigo-300 dark:text-primary opacity-70">
                  <line x1="380" y1="400" x2="380" y2="310" stroke-width="2.5" />
                  <circle cx="380" cy="310" r="3" fill="currentColor" />
                </g>
              </g>
            </svg>
          </div>
        </div>

        <!-- Right: Content -->
        <div
          class="w-full lg:w-1/2 text-center lg:text-left order-1 lg:order-2 fade-in-element"
          style="animation-delay: 0.2s"
        >
          <h1
            class="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white mb-6 leading-tight"
          >
            MassFlow
          </h1>
          <p
            class="text-xl sm:text-2xl text-slate-600 dark:text-base-content/40 font-light mb-8 max-w-2xl mx-auto lg:mx-0"
          >
            Next-Generation Mass Spectrometry Data Platform. Unlock biological insights with
            unprecedented speed and precision according to cloud-native architecture.
          </p>

          <div
            class="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-4"
          >
            <button
              class="btn btn-primary px-8 h-auto py-3.5 rounded-full font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Get Started
            </button>
            <button
              class="btn px-8 h-auto py-3.5 rounded-full border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-base-content/40 font-medium text-lg hover:bg-slate-50 dark:hover:bg-gray-800 transition-all bg-transparent"
            >
              View Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 20s linear infinite;
  transform-origin: 250px 250px;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.animate-pulse-slow {
  animation: pulseSlow 4s ease-in-out infinite;
}
@keyframes pulseSlow {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(0.98);
  }
}

.fade-in-element {
  opacity: 0;
  animation: fadeInUp 1s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
