<script setup lang="ts">
import BaseScene from './BaseScene.vue'
import DeveloperCarousel from './footer/DeveloperCarousel.vue'
import { APP_NAME } from '@/shared/config/app'
import { getConfig } from '@/shared/config/runtimeConfig'

const year = new Date().getFullYear()
const joinLinks = getConfig().joinLinks ?? {}
</script>

<template>
  <BaseScene as="footer" align="between" class="footer-scene bg-base-300">
    <!-- 开发人员展示区 -->
    <div v-reveal class="flex w-full flex-1 flex-col ">
      <p class="flex-1 pl-[0.4em] text-[clamp(5rem,10vw,10rem)] font-semibold uppercase tracking-[0.4em] text-secondary text-center">
      The Team
      </p>
      <p class="text-[2em] text-center [word-spacing:0.1em] flex-1">
        Built by people who love science and engineering.
      </p>
      <div v-if="joinLinks.student || joinLinks.openSource" class="mt-[1.5em] flex flex-col items-center justify-center gap-[1em] sm:flex-row sm:gap-[3em]">
        <a
          v-if="joinLinks.student"
          :href="joinLinks.student"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary text-[clamp(1rem,2.5vw,1.75rem)] px-[2em] py-[1.2em]"
        >Join the Bionet Lab</a>
        <a
          v-if="joinLinks.openSource"
          :href="joinLinks.openSource"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-secondary text-[clamp(1rem,2.5vw,1.75rem)] px-[2em] py-[1.2em]"
        >Join on GitHub</a>
      </div>
      <div class="flex min-h-0 flex-2 items-center">
        <DeveloperCarousel class="w-full"/>
      </div>
    </div>

    <!-- 品牌信息区 -->
    <div class="flex w-full flex-col items-center gap-[0.6em] border-t border-base-content/10 pt-[1em] text-center text-[1rem] md:items-end md:text-right">
      <div class="flex items-center gap-[0.6em]">
        <span class="flex h-[2em] w-[2em] items-center justify-center rounded-[0.4em] bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <SvgIcon type="sparkles" class="h-[1em] w-[1em]" />
        </span>
        <span class="text-[1.2em] font-extrabold uppercase text-base-content">{{ APP_NAME }}</span>
      </div>
      <p class="text-[0.75em] uppercase tracking-[0.04em] text-base-content/50">© {{ year }} {{ APP_NAME }}. All rights reserved.</p>
    </div>
  </BaseScene>
</template>

<style scoped>
.footer-scene {
  background-image: linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.05));
}
</style>
