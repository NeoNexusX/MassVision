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
          <span class="text-[clamp(1.4rem,4.2vw,2rem)] font-medium leading-none">
            {{ namePre
            }}<span
              class="brand-text bg-gradient-to-bl from-[var(--brand-accent)] to-primary font-['Outfit',sans-serif] text-[1.2em]"
              style="font-synthesis: style"
              >{{ nameX }}</span
            >{{ namePost }}
          </span>
        </li>

        <template v-for="item in items" :key="item.kind === 'group' ? item.label : item.to">
          <!-- Group item -->
          <li v-if="item.kind === 'group'">
            <details>
              <summary class="flex items-center gap-[clamp(0.6rem,2.5vw,1.2rem)] 
                              py-[clamp(0.6rem,2.5vw,1.2rem)] 
                              px-[clamp(0.4rem,1.7vw,0.8rem)] text-[clamp(0.95rem,3vw,1.4rem)] 
                              font-medium rounded-lg transition-colors hover:bg-base-200/70 cursor-pointer">
                <span class="flex items-center justify-center shrink-0"
                      :style="{ width: 'clamp(1.5rem, 4.6vw, 2.2rem)', height: 'clamp(1.5rem, 4.6vw, 2.2rem)' }">
                  <SvgIcon :type="(item.icon as IconType)" class="w-full h-full text-base-content/70 [&_svg]:stroke-[1.6]" />
                </span>
                <span class="whitespace-nowrap">{{ item.label }}</span>
              </summary>

              <ul class="ml-[clamp(1.8rem,5.2vw,2.5rem)] mt-[clamp(0.2rem,1vw,0.5rem)] 
                        flex flex-col gap-[clamp(0.4rem,1.6vw,0.75rem)] 
                        border-l-2 border-base-200/60 pl-[clamp(0.5rem,2vw,1rem)]">
                <li v-for="child in item.children" :key="child.to">
                  <router-link
                    :to="child.to"
                    @click="open = false"
                    class="flex items-center gap-[clamp(0.5rem,2vw,1rem)] py-[clamp(0.5rem,1.9vw,0.9rem)] px-[clamp(0.3rem,1.3vw,0.6rem)] text-[clamp(0.9rem,2.5vw,1.2rem)] font-medium rounded-lg transition-colors hover:bg-base-200/60"
                    active-class="!bg-primary/10 !text-primary font-medium"
                  >
                    <span class="flex items-center justify-center shrink-0"
                          :style="{ width: 'clamp(1.2rem, 3.8vw, 1.8rem)', height: 'clamp(1.2rem, 3.8vw, 1.8rem)' }">
                      <SvgIcon :type="(child.icon as IconType)" class="w-full h-full text-base-content/60 [&_svg]:stroke-[1.6]" />
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
                <SvgIcon :type="(item.icon as IconType)" class="w-full h-full text-base-content/70 [&_svg]:stroke-[1.6]" />
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
import { getConfig, isNavVisible } from '@/shared/config/runtimeConfig'
import type { NavItem, NavLinkItem, NavUserLink, NavVisibility } from '@/shared/config/runtimeConfig'

const props = defineProps<{
  user: User | null
  isAdmin: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

// 与 Hero 标题一致：把大写 X 拆出做浅蓝→深蓝渐变；没有 X 时回退为完整名称
const xIndex = APP_NAME.indexOf('X')
const namePre = xIndex >= 0 ? APP_NAME.slice(0, xIndex) : APP_NAME
const nameX = xIndex >= 0 ? APP_NAME[xIndex] : ''
const namePost = xIndex >= 0 ? APP_NAME.slice(xIndex + 1) : ''

const visible = (i: NavVisibility): boolean =>
  isNavVisible(i, { isAuthenticated: !!props.user, isAdmin: props.isAdmin })

const items = computed<NavItem[]>(() => {
  const nav = getConfig().nav!
  // 登录后把 userMenu 的 link 项追加在主菜单尾部；未登录不追加（登录入口在 navbar 头像下拉），
  // logout 动作也不进抽屉（drawer 形态的登出由 FAB 承担）
  const account: NavLinkItem[] = props.user
    ? nav.userMenu
        .filter((i): i is NavUserLink => i.kind === 'link')
        .map((i) => ({ ...i, kind: 'link' as const }))
    : []
  return [...nav.items, ...account]
    .filter(visible)
    .map((it) =>
      it.kind === 'group' ? { ...it, children: it.children.filter(visible) } : it,
    )
    // 分组下子项被过滤光时，整组也隐藏
    .filter((it) => it.kind !== 'group' || it.children.length > 0)
})
</script>
