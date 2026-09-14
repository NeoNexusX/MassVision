<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import BaseScene from './BaseScene.vue'
import DeveloperCarousel from './footer/DeveloperCarousel.vue'
import { getConfig } from '@/shared/config/runtimeConfig'
import { t } from '@/i18n'
import { getContent } from '@/features/home/config/contentConfig'

const year = new Date().getFullYear()
const config = getConfig()
const { contact } = getContent()

type SocialLink = { icon: string; label: string; href: string }

const socialLinks = computed<SocialLink[]>(() => [
  contact.website && { icon: 'heroicons:globe-alt',       label: t('home.footer.website'), href: contact.website },
  contact.email   && { icon: 'heroicons:envelope',         label: t('home.footer.email'),      href: `mailto:${contact.email}` },
  contact.wechat       && { icon: 'simple-icons:wechat',  label: t('home.footer.wechat'), href: contact.wechat },
  contact.github       && { icon: 'simple-icons:github',  label: t('home.footer.github'),     href: contact.github },
  contact.recruitment  && { icon: 'heroicons:user-plus',   label: t('home.footer.recruitment'),            href: contact.recruitment },
].filter(Boolean) as SocialLink[])

const poweredBy = computed(() => [
  { label: t('home.footer.computingFramework'), icon: 'heroicons:cpu-chip', href: 'https://github.com/NeoNexusX/MassFlow' },
  { label: t('home.footer.aliyun'), icon: 'simple-icons:alibabacloud', href: 'https://www.aliyun.com/' },
])
</script>

<template>
  <BaseScene as="footer" align="center" class="footer-scene bg-base-300">
    <!-- 巨型展示字 48→144px，斜率远陡于全局基准，等比档位复刻不了，故保留 clamp + em。 -->
    <div v-reveal class="flex w-full flex-none flex-col kawaru-text-home-team">
      <p class="pl-[0.4em] font-['Outfit',sans-serif] font-semibold uppercase tracking-[0.4em] text-secondary text-center">
      {{ $t('home.footer.team') }}
      </p>
      <p class="text-[0.25em] text-center [word-spacing:0.1em]">
        {{ $t('home.footer.tagline') }}
      </p>
      <div class="flex min-h-0 flex-none items-center justify-center">
        <DeveloperCarousel class="w-full"/>
      </div>
    </div>

    <footer class="footer footer-horizontal footer-center text-base-content rounded p-10 sm:p-6 kawaru-text-100">
      <nav class="flex flex-wrap justify-center gap-[2em]">
        <a v-for="link in socialLinks" :key="link.href" :href="link.href"
          :aria-label="link.label" :data-tip="link.label" target="_blank" rel="noopener noreferrer"
          class="tooltip transition-opacity hover:opacity-70">
          <Icon :icon="link.icon" class="h-[1.8em] w-[1.8em]" />
        </a>
      </nav>
      <span>{{ $t('home.footer.poweredBy') }}</span>
      <nav class="flex items-center gap-x-[1.2em] opacity-80 kawaru-text-87">
        <template v-for="(item, i) in poweredBy" :key="item.href">
          <span v-if="i > 0" class="opacity-40">·</span>
          <a :href="item.href" :aria-label="item.label" :data-tip="item.label" target="_blank" rel="noopener noreferrer"
            class="tooltip transition-opacity hover:opacity-70">
            <Icon :icon="item.icon" class="h-[1.8em] w-[1.8em]" />
          </a>
        </template>
      </nav>
      <p class="flex flex-col items-center justify-center gap-2">
        <span>{{ $t('home.footer.copyright', { year }) }}</span>
        <span v-if="config.version" class=" mt-[1em] badge badge-outline badge-lg kawaru-text-81 border-base-content/30 text-base-content/60">v{{ config.version }}</span>
      </p>
    </footer>
  </BaseScene>
</template>

<style scoped>
.footer-scene {
  background-image: linear-gradient(
    to bottom,
    transparent,
    color-mix(in oklch, var(--color-primary) 5%, transparent)
  );
}
</style>
