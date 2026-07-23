<template>
  <!-- relative z-40：让下拉菜单盖过页面内容自建的 stacking context（仍低于 drawer/fab 的 9998/9999）。
       字号体系与 Hero 一致：根节点定一个流体基准字号，内部一律用 em 相对尺寸，
       调这里的 clamp 即可整体缩放 navbar（按钮用 [--size:…em] + text-[1em] 跟随基准，
       因为 daisyui 的 .btn 自带固定 font-size，会切断 em 继承链）。 -->
  <div
    class="navbar relative z-40 bg-base-100 shadow-sm px-2 md:px-6 text-[clamp(1rem,0.92rem+0.4vw,1.25rem)]"
  >
    <!-- start: 品牌 + 移动端汉堡菜单（小屏合并展示全部分组与用户菜单） -->
    <div class="navbar-start">
      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn btn-ghost lg:hidden text-[1em] [--size:2.6em]"
          aria-label="Open menu"
        >
          <SvgIcon type="bars3" class="w-[1.4em] h-[1.4em]" />
        </div>
        <ul
          tabindex="0"
          class="menu dropdown-content bg-base-100 rounded-box z-[1] mt-5 w-[16em] p-2 shadow-lg text-[0.95em]"
        >
          <!-- 只放导航分组：Profile / Sign in 等入口由右侧头像下拉承担，这里不重复。
               分段大标题比内容字号大一档；独立链接（如 Documentation）按同级大标题样式渲染 -->
          <template v-for="(item, i) in items" :key="item.label">
            <template v-if="item.kind === 'group'">
              <li
                class="menu-title text-[1.05em] font-semibold text-base-content/80"
                :class="i > 0 ? 'mt-3' : ''"
              >
                {{ item.label }}
              </li>
              <li v-for="child in item.children" :key="child.to">
                <a
                  v-if="child.external"
                  :href="child.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg transition-colors"
                  @click="closeDropdown"
                  >{{ child.label }}</a
                >
                <router-link
                  v-else
                  :to="child.to"
                  class="rounded-lg transition-colors"
                  active-class="!bg-primary/10 !text-primary font-medium"
                  @click="closeDropdown"
                  >{{ child.label }}</router-link
                >
              </li>
            </template>
            <li v-else :class="i > 0 ? 'mt-3' : ''">
              <a
                v-if="item.external"
                :href="item.to"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-lg text-[1.05em] font-semibold transition-colors"
                @click="closeDropdown"
                >{{ item.label }}</a
              >
              <router-link
                v-else
                :to="item.to"
                class="rounded-lg text-[1.05em] font-semibold transition-colors"
                active-class="!bg-primary/10 !text-primary"
                @click="closeDropdown"
                >{{ item.label }}</router-link
              >
            </li>
          </template>
        </ul>
      </div>

      <!-- 品牌名必须包在单个 span 里：.btn 是带 gap 的 flex 容器，裸文本节点会被拆成多个 flex item 出现空隙 -->
      <router-link to="/" class="btn btn-ghost h-auto min-h-0 px-2 py-[0.2em] text-[1.4em]">
        <span class="font-medium leading-none">
          {{ namePre
          }}<span
            class="brand-text bg-gradient-to-bl from-[var(--brand-accent)] to-primary font-['Outfit',sans-serif] text-[1.2em]"
            style="font-synthesis: style"
            >{{ nameX }}</span
          >{{ namePost }}
        </span>
      </router-link>
    </div>

    <!-- center: 大屏水平菜单（details/summary 原生下拉；数据全部来自 config.json 的 navbar 块） -->
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal gap-[0.25em] px-1 text-[1em]">
        <li v-for="item in items" :key="item.label">
          <details v-if="item.kind === 'group'">
            <summary
              class="rounded-lg px-[1em] py-[0.45em] font-medium transition-colors hover:bg-base-200/70"
            >
              {{ item.label }}
            </summary>
            <ul class="z-[1] mt-2 w-[13em] whitespace-nowrap rounded-box bg-base-100 p-2 shadow-lg text-[0.9em]">
              <li v-for="child in item.children" :key="child.to">
                <a
                  v-if="child.external"
                  :href="child.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg py-[0.55em] transition-colors hover:bg-base-200/60"
                  @click="closeDetails"
                  >{{ child.label }}</a
                >
                <router-link
                  v-else
                  :to="child.to"
                  class="rounded-lg py-[0.55em] transition-colors hover:bg-base-200/60"
                  active-class="!bg-primary/10 !text-primary font-medium"
                  @click="closeDetails"
                  >{{ child.label }}</router-link
                >
              </li>
            </ul>
          </details>
          <a
            v-else-if="item.external"
            :href="item.to"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-lg px-[1em] py-[0.45em] font-medium transition-colors hover:bg-base-200/70"
            >{{ item.label }}</a
          >
          <router-link
            v-else
            :to="item.to"
            class="rounded-lg px-[1em] py-[0.45em] font-medium transition-colors hover:bg-base-200/70"
            active-class="!bg-primary/10 !text-primary"
            >{{ item.label }}</router-link
          >
        </li>
      </ul>
    </div>

    <!-- end: 主题切换 + 头像（登录后下拉用户菜单 / 未登录占位头像带登录指引） -->
    <div class="navbar-end gap-[0.4em]">
      <button
        v-if="navbar.themeToggle !== false"
        class="btn btn-ghost btn-circle text-[1em] [--size:2.6em]"
        aria-label="Toggle theme"
        @click="toggleTheme"
      >
        <SvgIcon v-if="!isDark" type="sun" class="w-[1.5em] h-[1.5em] text-yellow-400" />
        <SvgIcon v-else type="moon" class="w-[1.5em] h-[1.5em] text-indigo-300" />
      </button>

      <template v-if="isAuthenticated">
        <div class="dropdown dropdown-end">
          <!-- daisyui 5 里占位头像类是 avatar-placeholder（旧版 placeholder 不再居中内容） -->
          <div
            tabindex="0"
            role="button"
            class="btn btn-ghost btn-circle avatar avatar-placeholder text-[1em] [--size:2.6em]"
          >
            <div
              class="w-[2.2em] rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-primary text-primary-content"
            >
              <span class="text-[0.9em] font-medium">{{ initials }}</span>
            </div>
          </div>
          <ul
            tabindex="0"
            class="menu dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-[14em] p-2 shadow-lg text-[0.95em]"
          >
            <li class="menu-title text-[0.8em]">{{ user?.username }}</li>
            <template v-for="item in userItems" :key="item.label">
              <li v-if="item.kind === 'link'">
                <router-link :to="item.to" class="rounded-lg transition-colors" @click="closeDropdown">
                  {{ item.label }}
                </router-link>
              </li>
              <li v-else>
                <a class="rounded-lg transition-colors" @click="onUserAction(item.action)">{{ item.label }}</a>
              </li>
            </template>
          </ul>
        </div>
      </template>
      <template v-else>
        <!-- 未登录：占位头像 + tooltip 提示，点开列出登录/注册入口 -->
        <div class="dropdown dropdown-end">
          <div
            tabindex="0"
            role="button"
            class="btn btn-ghost btn-circle avatar avatar-placeholder tooltip tooltip-bottom text-[1em] [--size:2.6em]"
            :data-tip="guestHint"
            :aria-label="guestHint"
          >
            <div class="w-[2.2em] rounded-full bg-base-200 text-base-content/60">
              <SvgIcon type="user-circle" class="w-[1.6em] h-[1.6em]" />
            </div>
          </div>
          <ul
            tabindex="0"
            class="menu dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-[14em] p-2 shadow-lg text-[0.95em]"
          >
            <li class="menu-title text-[0.8em]">Not signed in</li>
            <li v-for="link in guestLinks" :key="link.to">
              <router-link
                :to="link.to"
                class="rounded-lg transition-colors"
                :class="link.primary ? '!text-primary font-medium' : ''"
                @click="closeDropdown"
                >{{ link.label }}</router-link
              >
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/features/auth/stores/authStore'
import SvgIcon from '@/shared/components/SvgIcon.vue'
import { BRAND_PARTS } from '@/shared/config/app'
import { useTheme } from '@/shared/composables/useTheme'
import { getConfig, isNavVisible, filterNavItems } from '@/shared/config/runtimeConfig'
import type {
  NavGuestLink,
  NavItem,
  NavUserItem,
  NavVisibility,
} from '@/shared/config/runtimeConfig'

const router = useRouter()
const authStore = useAuthStore()
const { user, isAdmin } = storeToRefs(authStore)
const { isDark, toggleTheme } = useTheme()

const isAuthenticated = computed(() => !!user.value)

// 与 NavDrawer 一致：把大写 X 拆出做渐变，没有 X 时回退为完整名称
const { pre: namePre, x: nameX, post: namePost } = BRAND_PARTS

const initials = computed(() => user.value?.username?.slice(0, 2).toUpperCase() ?? '')

// 统一导航配置（与 NavDrawer 共用一份 config.json 的 nav 块）
const navbar = computed(() => getConfig().nav!)
const guestHint = computed(() => navbar.value.guestHint ?? 'Sign in')

const visible = (i: NavVisibility): boolean =>
  isNavVisible(i, { isAuthenticated: isAuthenticated.value, isAdmin: isAdmin.value })

// 与 NavDrawer 相同的过滤规则：先过滤自身再过滤 children，子项被过滤光的分组整组隐藏
const items = computed<NavItem[]>(() =>
  filterNavItems(navbar.value.items, {
    isAuthenticated: isAuthenticated.value,
    isAdmin: isAdmin.value,
  }),
)

const userItems = computed<NavUserItem[]>(() => navbar.value.userMenu.filter(visible))
const guestLinks = computed<NavGuestLink[]>(() => navbar.value.guestLinks.filter(visible))

// details 下拉不会因路由跳转自动收起，点击子项后手动收起
const closeDetails = (e: MouseEvent) => {
  ;(e.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')
}

// daisyui dropdown 靠 :focus-within 展开，跳转后焦点仍留在菜单里，需主动 blur 收起
const closeDropdown = () => {
  ;(document.activeElement as HTMLElement | null)?.blur()
}

const onUserAction = async (action: 'logout') => {
  closeDropdown()
  if (action === 'logout') {
    await authStore.logout()
    router.push('/login')
  }
}
</script>
