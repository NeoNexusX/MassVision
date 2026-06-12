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
      <nav
        class="menu p-[clamp(1rem,5.2vw,2.5rem)] w-[clamp(260px,55vw,420px)] min-h-full bg-base-100 text-base-content flex flex-col gap-[clamp(0.6rem,2.5vw,1.2rem)] overflow-y-auto overflow-x-hidden shadow-2xl"
      >
        <!-- Header -->
        <li class="menu-title mb-8 flex items-center gap-4 px-2">
          <span class="flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shrink-0"
                :style="{ width: 'clamp(2rem, 5.9vw, 2.8rem)', height: 'clamp(2rem, 5.9vw, 2.8rem)' }">
            <SvgIcon type="sparkles" class="w-[60%] h-[60%]" />
          </span>
          <span class="text-[clamp(1.4rem,4.2vw,2rem)] font-medium">{{ APP_NAME }}</span>
        </li>

        <template v-for="item in items" :key="item.kind === 'group' ? item.label : item.to">
          <!-- Group item -->
          <li v-if="item.kind === 'group'">
            <details>
              <summary class="flex items-center gap-[clamp(0.6rem,2.5vw,1.2rem)] py-[clamp(0.6rem,2.5vw,1.2rem)] px-[clamp(0.4rem,1.7vw,0.8rem)] text-[clamp(0.95rem,3vw,1.4rem)] font-medium rounded-lg transition-colors hover:bg-base-200/70 cursor-pointer">
                <span class="flex items-center justify-center shrink-0"
                      :style="{ width: 'clamp(1.5rem, 4.6vw, 2.2rem)', height: 'clamp(1.5rem, 4.6vw, 2.2rem)' }">
                  <SvgIcon :type="item.icon" class="w-full h-full text-base-content/70 [&_svg]:stroke-[1.6]" />
                </span>
                <span class="whitespace-nowrap">{{ item.label }}</span>
              </summary>
              <ul class="ml-[clamp(1.8rem,5.2vw,2.5rem)] mt-[clamp(0.2rem,1vw,0.5rem)] flex flex-col gap-[clamp(0.4rem,1.6vw,0.75rem)] border-l-2 border-base-200/60 pl-[clamp(0.5rem,2vw,1rem)]">
                <li v-for="child in item.children" :key="child.to">
                  <router-link
                    :to="child.to"
                    @click="open = false"
                    class="flex items-center gap-[clamp(0.5rem,2vw,1rem)] py-[clamp(0.5rem,1.9vw,0.9rem)] px-[clamp(0.3rem,1.3vw,0.6rem)] text-[clamp(0.9rem,2.5vw,1.2rem)] font-medium rounded-lg transition-colors hover:bg-base-200/60"
                    active-class="!bg-primary/10 !text-primary font-medium"
                  >
                    <span class="flex items-center justify-center shrink-0"
                          :style="{ width: 'clamp(1.2rem, 3.8vw, 1.8rem)', height: 'clamp(1.2rem, 3.8vw, 1.8rem)' }">
                      <SvgIcon :type="child.icon" class="w-full h-full text-base-content/60 [&_svg]:stroke-[1.6]" />
                    </span>
                    <span class="whitespace-nowrap">{{ child.label }}</span>
                  </router-link>
                </li>
              </ul>
            </details>
          </li>
          <!-- Link item -->
          <li v-else>
            <router-link
              :to="item.to"
              class="flex items-center gap-[clamp(0.6rem,2.5vw,1.2rem)] py-[clamp(0.6rem,2.5vw,1.2rem)] px-[clamp(0.4rem,1.7vw,0.8rem)] text-[clamp(0.95rem,3vw,1.4rem)] font-medium rounded-lg transition-colors hover:bg-base-200/70"
              active-class="!bg-primary/10 !text-primary font-medium"
              @click="item.closeOnClick !== false ? (open = false) : null"
            >
              <span class="flex items-center justify-center shrink-0"
                    :style="{ width: 'clamp(1.5rem, 4.6vw, 2.2rem)', height: 'clamp(1.5rem, 4.6vw, 2.2rem)' }">
                <SvgIcon :type="item.icon" class="w-full h-full text-base-content/70 [&_svg]:stroke-[1.6]" />
              </span>
              <span class="whitespace-nowrap">{{ item.label }}</span>
            </router-link>
          </li>
        </template>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/features/auth/types/auth'
import type { IconType } from '@/shared/components/svgIcons'
import { APP_NAME } from '@/shared/config/app'

const props = defineProps<{
  user: User | null
  isAdmin: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

type LinkItem = {
  kind: 'link'
  to: string
  icon: IconType
  label: string
  closeOnClick?: boolean
}
type GroupItem = {
  kind: 'group'
  icon: IconType
  label: string
  children: { to: string; icon: IconType; label: string }[]
}
type Item = (LinkItem | GroupItem) & { show: boolean }

const items = computed<Item[]>(() =>
  (
    [
      { kind: 'link', to: '/', icon: 'home', label: 'Home', show: true },
      {
        kind: 'group',
        icon: 'circle_stack',
        label: 'Datahub',
        show: true,
        children: [
          { to: '/datasets', icon: 'queue_list', label: 'Public Datasets' },
          ...(props.user ? [{ to: '/my-datasets', icon: 'folder', label: 'My Datasets' }] : []),
        ],
      },
      { kind: 'link', to: '/workspace', icon: 'sparkles', label: 'Workspace', show: true },
      {
        kind: 'link',
        to: '/profile',
        icon: 'user-circle',
        label: 'Profile',
        show: !!props.user,
      },
      { kind: 'link', to: '/users', icon: 'users', label: 'Users', show: props.isAdmin },
      {
        kind: 'link',
        to: '/login',
        icon: 'signin',
        label: 'Sign in',
        closeOnClick: false,
        show: !props.user,
      },
      {
        kind: 'link',
        to: '/register',
        icon: 'user_plus',
        label: 'Create account',
        closeOnClick: false,
        show: !props.user,
      },
    ] as Item[]
  ).filter((i) => i.show),
)
</script>
