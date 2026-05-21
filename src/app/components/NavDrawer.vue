<template>
  <div class="drawer z-[9998]">
    <input id="nav-drawer" type="checkbox" class="drawer-toggle" v-model="open" />
    <div class="drawer-side fixed inset-0 h-screen">
      <label
        for="nav-drawer"
        aria-label="close sidebar"
        class="drawer-overlay"
        @click.prevent="open = false"
      ></label>
      <ul
        class="menu p-8 w-[450px] max-w-[85vw] min-h-full bg-base-100 text-base-content flex flex-col gap-6 overflow-y-auto"
      >
        <li class="menu-title mb-8 flex items-center gap-5">
          <SvgIcon type="home" class="w-10 h-10 text-blue-600" />
          <span class="text-2xl md:text-3xl font-semibold">MassFlow</span>
        </li>

        <li>
          <router-link to="/" @click="open = false" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <SvgIcon type="home" class="w-8 h-8 text-base-content" />
            </span>
            <span>Home</span>
          </router-link>
        </li>

        <li>
          <details>
            <summary class="flex items-center gap-6 py-4 px-3 text-xl">
              <span class="w-8 h-8 flex justify-center items-center shrink-0">
                <SvgIcon type="circle_stack" class="w-8 h-8 text-base-content" />
              </span>
              <span>Datahub</span>
            </summary>
            <ul class="p-2 mt-2 flex flex-col gap-3">
              <li>
                <router-link
                  to="/datasets"
                  @click="open = false"
                  class="flex items-center gap-6 py-4 px-3 text-xl"
                >
                  <span class="w-8 h-8 flex justify-center items-center shrink-0">
                    <SvgIcon type="queue_list" class="w-8 h-8 text-base-content" />
                  </span>
                  <span>Public Datasets</span>
                </router-link>
              </li>
              <li v-if="user">
                <router-link
                  to="/my-datasets"
                  @click="open = false"
                  class="flex items-center gap-6 py-4 px-3 text-xl"
                >
                  <span class="w-8 h-8 flex justify-center items-center shrink-0">
                    <SvgIcon type="folder" class="w-8 h-8 text-base-content" />
                  </span>
                  <span>My Datasets</span>
                </router-link>
              </li>
            </ul>
          </details>
        </li>

        <li>
          <router-link
            to="/workspace"
            @click="open = false"
            class="flex items-center gap-6 py-4 px-3 text-xl"
          >
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <SvgIcon type="sparkles" class="w-8 h-8 text-base-content" />
            </span>
            <span>Workspace</span>
          </router-link>
        </li>

        <li v-if="user">
          <router-link
            to="/profile"
            @click="open = false"
            class="flex items-center gap-6 py-4 px-3 text-xl"
          >
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <SvgIcon type="user-circle" class="w-8 h-8 text-base-content" />
            </span>
            <span>Profile</span>
          </router-link>
        </li>

        <li v-if="isAdmin">
          <router-link
            to="/users"
            @click="open = false"
            class="flex items-center gap-6 py-4 px-3 text-xl"
          >
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <SvgIcon type="users" class="w-8 h-8 text-base-content" />
            </span>
            <span>Users</span>
          </router-link>
        </li>

        <li v-if="!user">
          <router-link to="/login" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <SvgIcon type="signin" class="w-8 h-8 text-base-content" />
            </span>
            <span>Sign in</span>
          </router-link>
        </li>

        <li v-if="!user">
          <router-link to="/register" class="flex items-center gap-6 py-4 px-3 text-xl">
            <span class="w-8 h-8 flex justify-center items-center shrink-0">
              <SvgIcon type="user_plus" class="w-8 h-8 text-base-content" />
            </span>
            <span>Create account</span>
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/features/auth/types/auth'

defineProps<{
  user: User | null
  isAdmin: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
</script>
