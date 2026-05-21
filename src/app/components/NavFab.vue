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
            class="bg-indigo-100 text-indigo-700 rounded-full w-8 h-8 flex items-center justify-center"
          >
            <span class="text-sm font-bold">{{ userInitial }}</span>
          </div>
        </template>
        <template v-else>
          <SvgIcon type="user" class="w-6 h-6" />
        </template>
      </button>

      <!-- Logged-in children -->
      <template v-if="user">
        <button class="btn btn-circle btn-lg child-btn" @click="$emit('toggle-drawer')" title="Menu">
          <SvgIcon type="bars3" class="w-5 h-5" />
        </button>
        <button
          class="btn btn-circle btn-lg child-btn"
          @click="$emit('toggle-theme')"
          :title="isDark ? 'Switch to light' : 'Switch to dark'"
        >
          <SvgIcon v-if="!isDark" type="sun" class="w-6 h-6 text-yellow-400" />
          <SvgIcon v-else type="moon" class="w-6 h-6 text-indigo-300" />
        </button>
        <button class="btn btn-circle btn-lg child-btn" @click="$emit('toggle-ai')" title="AI Assistant">
          <SvgIcon type="sparkles" class="w-5 h-5" />
        </button>
        <button class="btn btn-circle btn-lg child-btn btn-error" @click="$emit('logout')" title="Sign out">
          <SvgIcon type="signin" class="w-5 h-5" />
        </button>
      </template>

      <!-- Not-logged-in children -->
      <template v-else>
        <button
          class="btn btn-circle btn-lg child-btn invisible pointer-events-none"
          aria-hidden="true"
        ></button>
        <button class="btn btn-circle btn-lg child-btn" @click="$emit('toggle-drawer')" title="Menu">
          <SvgIcon type="bars3" class="w-6 h-6" />
        </button>
        <button
          class="btn btn-circle btn-lg child-btn"
          @click="$emit('toggle-theme')"
          :title="isDark ? 'Switch to light' : 'Switch to dark'"
        >
          <SvgIcon v-if="!isDark" type="sun" class="w-6 h-6 text-yellow-400" />
          <SvgIcon v-else type="moon" class="w-6 h-6 text-indigo-300" />
        </button>
        <button
          class="btn btn-circle btn-lg child-btn invisible pointer-events-none"
          aria-hidden="true"
        ></button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { User } from '@/features/auth/types/auth'

const props = defineProps<{
  user: User | null
  isDark: boolean
}>()

defineEmits<{
  (e: 'toggle-drawer'): void
  (e: 'toggle-theme'): void
  (e: 'toggle-ai'): void
  (e: 'logout'): void
}>()

const fabOpen = ref(false)

const userInitial = computed(() => props.user?.username?.charAt(0).toUpperCase() ?? '')
</script>
