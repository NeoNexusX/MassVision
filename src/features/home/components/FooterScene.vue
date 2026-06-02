<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import BaseScene from './BaseScene.vue'
import DeveloperCarousel from './footer/DeveloperCarousel.vue'
import { getConfig } from '@/shared/config/runtimeConfig'

const year = new Date().getFullYear()
const config = getConfig()
const { contact = {} } = config

type SocialLink = { icon: string; label: string; href: string }

const socialLinks = computed<SocialLink[]>(() => [
  contact.website && { icon: 'mdi:web',              label: 'Bionet Lab', href: contact.website },
  contact.email   && { icon: 'mdi:email-outline',    label: 'Email',      href: `mailto:${contact.email}` },
  contact.wechat  && { icon: 'simple-icons:wechat',  label: 'WeChat',     href: contact.wechat },
  contact.github  && { icon: 'simple-icons:github',  label: 'GitHub',     href: contact.github },
].filter(Boolean) as SocialLink[])

const poweredBy = [
  { label: 'MassFlow', href: 'https://github.com/NeoNexusX/MassFlow' },
  { label: 'Aliyun',   href: 'https://www.aliyun.com/' },
]
</script>

<template>
  <BaseScene as="footer" align="between" class="footer-scene bg-base-300">
    <div v-reveal class="flex w-full flex-1 flex-col ">
      <p class="flex-1 pl-[0.4em] text-[clamp(5rem,10vw,10rem)] font-semibold uppercase tracking-[0.4em] text-secondary text-center">
      The Team
      </p>
      <p class="text-[2em] text-center [word-spacing:0.1em] flex-1">
        Built by people who love science and engineering.
      </p>
      <div class="flex min-h-0 flex-2 items-center">
        <DeveloperCarousel class="w-full"/>
      </div>
    </div>

    <footer class="footer footer-horizontal footer-center text-base-content rounded p-10 text-[clamp(1.2rem,1.5vw,2rem)]">
      <nav class="flex gap-[2em]">
        <a v-for="link in socialLinks" :key="link.href" :href="link.href"
          :aria-label="link.label" target="_blank" rel="noopener noreferrer"
          class="transition-opacity hover:opacity-70">
          <Icon :icon="link.icon" class="h-[1.8em] w-[1.8em]" />
        </a>
      </nav>
      <nav class="flex items-center justify-center gap-x-[1.2em] opacity-50 text-[0.85em]">
        <span>Powered by</span>
        <template v-for="(item, i) in poweredBy" :key="item.href">
          <span v-if="i > 0" class="opacity-40">·</span>
          <a :href="item.href" target="_blank" rel="noopener noreferrer" class="link link-hover">{{ item.label }}</a>
        </template>
      </nav>
      <p>Copyright © {{ year }} - All rights reserved by Bionet</p>
    </footer>
  </BaseScene>
</template>

<style scoped>
.footer-scene {
  background-image: linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.05));
}
</style>
