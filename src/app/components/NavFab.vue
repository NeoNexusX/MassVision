<template>
  <div class="fixed top-4 right-4 z-[9999]">
    <div class="fab fab-flower" :class="{ 'fab-open': fabOpen }">
      <!-- Trigger button -->
      <div
        tabindex="0"
        role="button"
        class="btn btn-circle btn-lg"
        @click="fabOpen = !fabOpen"
        aria-label="Open menu"
      >
        <SvgIcon type="home" class="w-6 h-6 text-base-content" />
      </div>

      <!-- Main action: user initial or user icon -->
      <button class="fab-main-action btn btn-circle btn-lg btn-primary" aria-label="Main action">
        <template v-if="user">
          <div
            class="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full w-8 h-8 flex items-center justify-center"
          >
            <span class="text-sm font-bold">{{ userInitial }}</span>
          </div>
        </template>
        <template v-else>
          <SvgIcon type="user" class="w-6 h-6" />
        </template>
      </button>

      <template v-for="(a, i) in actions" :key="i">
        <button
          v-if="a.kind === 'spacer'"
          class="btn btn-circle btn-lg child-btn invisible pointer-events-none"
          aria-hidden="true"
        ></button>
        <button
          v-else-if="a.kind === 'theme'"
          class="btn btn-circle btn-lg child-btn"
          @click="emit('toggle-theme')"
          :title="isDark ? 'Switch to light' : 'Switch to dark'"
        >
          <SvgIcon v-if="!isDark" type="sun" class="w-6 h-6 text-yellow-400" />
          <SvgIcon v-else type="moon" class="w-6 h-6 text-indigo-300" />
        </button>
        <button
          v-else
          :class="['btn btn-circle btn-lg child-btn', a.btnClass]"
          @click="a.onClick"
          :title="a.title"
        >
          <SvgIcon :type="a.icon" :class="a.iconClass" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { User } from '@/features/auth/types/auth'
import type { IconType } from '@/shared/components/svgIcons'

const props = defineProps<{
  user: User | null
  isDark: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-drawer'): void
  (e: 'toggle-theme'): void
  (e: 'toggle-ai'): void
  (e: 'logout'): void
}>()

const fabOpen = ref(false)

const userInitial = computed(() => props.user?.username?.charAt(0).toUpperCase() ?? '')

type FabAction =
  | { kind: 'spacer' }
  | { kind: 'theme' }
  | {
      kind: 'btn'
      icon: IconType
      iconClass: string
      onClick: () => void
      title: string
      btnClass?: string
    }

const drawerBtn = (iconClass: string): FabAction => ({
  kind: 'btn',
  icon: 'bars3',
  iconClass,
  onClick: () => emit('toggle-drawer'),
  title: 'Menu',
})

const actions = computed<FabAction[]>(() =>
  props.user
    ? [
        drawerBtn('w-5 h-5'),
        { kind: 'theme' },
        {
          kind: 'btn',
          icon: 'sparkles',
          iconClass: 'w-5 h-5',
          onClick: () => emit('toggle-ai'),
          title: 'AI Assistant',
        },
        {
          kind: 'btn',
          icon: 'signin',
          iconClass: 'w-5 h-5',
          onClick: () => emit('logout'),
          title: 'Sign out',
          btnClass: 'btn-error',
        },
      ]
    : [{ kind: 'spacer' }, drawerBtn('w-6 h-6'), { kind: 'theme' }, { kind: 'spacer' }],
)
</script>
