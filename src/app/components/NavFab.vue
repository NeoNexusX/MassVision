<template>
  <!-- 尺寸与边距集中在底部 <style> 里调,--fab-size 是唯一开关 -->
  <div class="fab z-[9999]">
    <!-- 关闭态主按钮：显示 iconClosed，点击展开 drawer。
         daisyui 的 fab 用 :focus-within 驱动展开视觉，且聚焦后会给自己加 pointer-events:none——
         必须用 mousedown（在该样式生效前触发）而非 click，否则首次点击不会展开。 -->
    <div
      tabindex="0"
      role="button"
      class="btn btn-circle btn-primary"
      aria-label="Open menu"
      @mousedown="open = true"
    >
      <SvgIcon :type="(fab.main.iconClosed as IconType)" />
    </div>

    <!-- 展开态主按钮：显示 iconOpen，点击收起 drawer。
         点击后需要主动 blur，否则该按钮仍持有焦点、:focus-within 仍为真，视觉不会收起。 -->
    <button
      class="fab-main-action btn btn-circle btn-primary"
      aria-label="Close menu"
      @click="closeMenu"
    >
      <SvgIcon :type="(fab.main.iconOpen as IconType)" />
    </button>

    <template v-for="(item, i) in items" :key="i">
      <!-- link：路由跳转 -->
      <router-link
        v-if="item.kind === 'link'"
        :to="item.to"
        class="btn btn-circle child-btn tooltip tooltip-left"
        :data-tip="item.label"
      >
        <SvgIcon :type="(item.icon as IconType)" />
      </router-link>

      <!-- action：触发事件；toggle-theme 的图标随 isDark 切换，其余按配置图标渲染 -->
      <button
        v-else
        :class="[
          'btn btn-circle child-btn tooltip tooltip-left',
          item.action === 'logout' ? 'btn-error' : '',
        ]"
        :data-tip="item.label"
        @click="onAction(item.action)"
      >
        <template v-if="item.action === 'toggle-theme'">
          <SvgIcon v-if="!isDark" type="sun" class="text-yellow-400" />
          <SvgIcon v-else type="moon" class="text-indigo-300" />
        </template>
        <SvgIcon v-else :type="(item.icon as IconType)" />
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/shared/auth/types'
import type { IconType } from '@/shared/components/svgIcons'
import { getConfig, isNavVisible } from '@/shared/config/runtimeConfig'
import type { FabActionKind, FabItem, NavVisibility } from '@/shared/config/runtimeConfig'

const props = defineProps<{
  user: User | null
  isAdmin?: boolean
  isDark: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'toggle-ai'): void
  (e: 'logout'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const fab = computed(() => getConfig().fab!)

const visible = (i: NavVisibility): boolean =>
  isNavVisible(i, { isAuthenticated: !!props.user, isAdmin: props.isAdmin })

const items = computed<FabItem[]>(() => fab.value.items.filter(visible))

const closeMenu = (e: MouseEvent) => {
  open.value = false
  ;(e.currentTarget as HTMLElement).blur()
}

const onAction = (action: FabActionKind) => {
  switch (action) {
    case 'toggle-theme':
      emit('toggle-theme')
      break
    case 'toggle-ai':
      emit('toggle-ai')
      break
    case 'logout':
      emit('logout')
      break
  }
}
</script>

<style scoped>
/* 尺寸集中在这里调:--fab-size 一个值控制按钮直径,图标自动取其一半。
   scoped 样式不在 @layer 内,天然覆盖 daisyui 的 .fab/.btn 层内声明。 */
.fab {
  --fab-size: 3rem;
  bottom: 0.75rem;
  inset-inline-end: 0.75rem;
  gap: 0.5rem;
}

/* md 及以上:更大按钮、更宽边距 */
@media (min-width: 768px) {
  .fab {
    --fab-size: 4rem;
    bottom: 1rem;
    inset-inline-end: 1rem;
    gap: 0.75rem;
  }
}

.fab .btn {
  --size: var(--fab-size);
}

.fab .btn :deep(svg) {
  width: calc(var(--fab-size) / 2);
  height: calc(var(--fab-size) / 2);
}
</style>
