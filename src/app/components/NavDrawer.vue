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
          <span class="text-2xl md:text-3xl font-semibold">{{ APP_NAME }}</span>
        </li>

        <template v-for="item in items" :key="item.kind === 'group' ? item.label : item.to">
          <li v-if="item.kind === 'group'">
            <details>
              <summary :class="LINK_CLASS">
                <span :class="ICON_WRAP_CLASS">
                  <SvgIcon :type="item.icon" class="w-8 h-8 text-base-content" />
                </span>
                <span>{{ item.label }}</span>
              </summary>
              <ul class="p-2 mt-2 flex flex-col gap-3">
                <li v-for="child in item.children" :key="child.to">
                  <router-link :to="child.to" @click="open = false" :class="LINK_CLASS">
                    <span :class="ICON_WRAP_CLASS">
                      <SvgIcon :type="child.icon" class="w-8 h-8 text-base-content" />
                    </span>
                    <span>{{ child.label }}</span>
                  </router-link>
                </li>
              </ul>
            </details>
          </li>
          <li v-else>
            <router-link
              :to="item.to"
              :class="LINK_CLASS"
              @click="item.closeOnClick !== false ? (open = false) : null"
            >
              <span :class="ICON_WRAP_CLASS">
                <SvgIcon :type="item.icon" class="w-8 h-8 text-base-content" />
              </span>
              <span>{{ item.label }}</span>
            </router-link>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/features/auth/types/auth'
import { APP_NAME } from '@/shared/config/app'

const props = defineProps<{
  user: User | null
  isAdmin: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const LINK_CLASS = 'flex items-center gap-6 py-4 px-3 text-xl'
const ICON_WRAP_CLASS = 'w-8 h-8 flex justify-center items-center shrink-0'

type LinkItem = {
  kind: 'link'
  to: string
  icon: string
  label: string
  closeOnClick?: boolean
}
type GroupItem = {
  kind: 'group'
  icon: string
  label: string
  children: { to: string; icon: string; label: string }[]
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
