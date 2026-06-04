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
  contact.website && { icon: 'mdi:web',              label: 'Bionet Lab Website', href: contact.website },
  contact.email   && { icon: 'mdi:email-outline',    label: 'Bionet Lab Email',      href: `mailto:${contact.email}` },
  contact.wechat       && { icon: 'simple-icons:wechat',  label: 'WeChat Official Account', href: contact.wechat },
  contact.github       && { icon: 'simple-icons:github',  label: 'Join us with Github',     href: contact.github },
  contact.recruitment  && { icon: 'mdi:account-plus',     label: 'Join the Lab',            href: contact.recruitment },
].filter(Boolean) as SocialLink[])

const poweredBy = [
  { label: 'Computing Framework', icon: 'mdi:atom-variant', href: 'https://github.com/NeoNexusX/MassFlow' },
  { label: 'Aliyun', icon: 'simple-icons:alibabacloud', href: 'https://www.aliyun.com/' },
]
</script>

<template>
  <BaseScene as="footer" align="center" class="footer-scene bg-base-300">
    <div v-reveal class="flex w-full flex-none flex-col">
      <p class=" pl-[0.4em] text-[clamp(2.5rem,10vw,8rem)] font-semibold uppercase tracking-[0.4em] text-secondary text-center">
      The Team
      </p>
      <p class="text-[clamp(1rem,1.8vw,1.5rem)] text-center [word-spacing:0.1em]">
        Built by people who love science and engineering.
      </p>
      <div class="flex min-h-0 flex-none items-center justify-center">
        <DeveloperCarousel class="w-full"/>
      </div>
    </div>

    <footer class="footer footer-horizontal footer-center text-base-content rounded p-10 sm:p-6 text-[clamp(1.2rem,1.5vw,1.25rem)]">
      <nav class="flex flex-wrap justify-center gap-[2em]">
        <a v-for="link in socialLinks" :key="link.href" :href="link.href"
          :aria-label="link.label" :data-tip="link.label" target="_blank" rel="noopener noreferrer"
          class="tooltip transition-opacity hover:opacity-70">
          <Icon :icon="link.icon" class="h-[1.8em] w-[1.8em]" />
        </a>
      </nav>
      <span>Powered by</span>
      <nav class="flex items-center gap-x-[1.2em] opacity-80 text-[0.85em]">
        <template v-for="(item, i) in poweredBy" :key="item.href">
          <span v-if="i > 0" class="opacity-40">·</span>
          <a :href="item.href" :aria-label="item.label" :data-tip="item.label" target="_blank" rel="noopener noreferrer"
            class="tooltip transition-opacity hover:opacity-70">
            <Icon :icon="item.icon" class="h-[1.8em] w-[1.8em]" />
          </a>
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
