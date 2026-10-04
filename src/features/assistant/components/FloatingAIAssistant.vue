<template>
  <!-- Draggable chat window -->
  <div
    v-if="isOpen && !isMinimized"
    ref="panelRef"
    class="fixed z-[10000] flex flex-col rounded-2xl shadow-2xl bg-base-100 border border-base-300 overflow-hidden select-none"
    :style="panelStyle"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-3 bg-base-200 border-b border-base-300 cursor-grab active:cursor-grabbing shrink-0"
      @mousedown="startDrag"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg bg-primary text-primary-content flex items-center justify-center"
        >
          <svg-icon type="sparkles" class="w-4 h-4 text-white" />
        </div>
        <span class="font-semibold kawaru-text-87 text-base-content">{{ $t('common.assistant.title') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <!-- BYOK 设置：自配 API key / 模型；已自定义时点亮 -->
        <button
          class="btn btn-xs btn-ghost btn-square relative"
          :class="{ 'text-primary': showSettings }"
          :title="$t('common.assistant.settings.title')"
          @mousedown.stop
          @click="showSettings = !showSettings"
        >
          <svg-icon type="settings" class="w-3.5 h-3.5" />
          <span
            v-if="hasCustom && !showSettings"
            class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary"
          ></span>
        </button>
        <button
          class="btn btn-xs btn-ghost btn-square kawaru-text-68"
          @click="isMinimized = true"
          :title="$t('common.assistant.minimize')"
        >
          <span class="kawaru-text-87 font-bold">—</span>
        </button>
        <button class="btn btn-xs btn-ghost btn-square kawaru-text-68" @click="close" :title="$t('common.action.close')">
          <svg-icon type="close" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- 聊天主体：TDesign 聊天视图（异步 chunk，首开零等待由下方空闲预取保证）；
         BYOK 设置面板打开时整体替换（设置属容器层） -->
    <component :is="chatComponent" v-if="isOpen && !showSettings" />
    <LlmSettingsPanel v-else-if="isOpen" @done="showSettings = false" />

    <!-- Resize handles -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- Edges -->
      <div
        class="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'n')"
      ></div>
      <div
        class="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 's')"
      ></div>
      <div
        class="absolute left-0 top-2 bottom-2 w-1.5 cursor-w-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'w')"
      ></div>
      <div
        class="absolute right-0 top-2 bottom-2 w-1.5 cursor-e-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'e')"
      ></div>
      <!-- Corners -->
      <div
        class="absolute top-0 left-0 w-4 h-4 cursor-nw-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'nw')"
      ></div>
      <div
        class="absolute top-0 right-0 w-4 h-4 cursor-ne-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'ne')"
      ></div>
      <div
        class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'sw')"
      ></div>
      <div
        class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize pointer-events-auto"
        @mousedown.stop="startResize($event, 'se')"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, defineAsyncComponent } from 'vue'
import { useLlmSettings } from '../composables/useLlmSettings'
import LlmSettingsPanel from './LlmSettingsPanel.vue'

const props = defineProps<{ show?: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

// 聊天视图（TDesign Chat，独立异步 chunk）
const chatComponent = defineAsyncComponent(() => import('./ChatTDesign.vue'))

// BYOK 设置面板（打开时替换聊天主体）
const showSettings = ref(false)
const { hasCustom, hasEnvDefault } = useLlmSettings()

onMounted(() => {
  // 空闲预取：首屏渲染完毕、浏览器空闲时后台静默下载聊天 chunk，
  // 用户点开助手时零等待。defineAsyncComponent 会复用已就绪的模块。
  const idle =
    window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000))
  idle(() => {
    void import('./ChatTDesign.vue')
  })
})

const isOpen = ref(false)
const isMinimized = ref(false)

watch(
  () => props.show,
  (v) => {
    if (v) {
      isOpen.value = true
      isMinimized.value = false
      // 既无用户自配也无 env 默认凭据 → 直接落到设置面板，别让用户发消息吃报错
      if (!hasCustom.value && !hasEnvDefault.value) showSettings.value = true
    }
  },
)

function close() {
  isOpen.value = false
  isMinimized.value = false
  emit('update:show', false)
}

// --- Drag logic ---
const MIN_W = 320,
  MIN_H = 400
const panelRef = ref<HTMLElement | null>(null)
const position = reactive({ x: 0, y: 0 })
const size = reactive({ w: 460, h: 620 })
const dragging = reactive({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 })
const resizing = reactive({
  active: false,
  dir: '' as string,
  startX: 0,
  startY: 0,
  origX: 0,
  origY: 0,
  origW: 0,
  origH: 0,
})

// Default: 视口居中
position.x = Math.max(0, (window.innerWidth - size.w) / 2)
position.y = Math.max(0, (window.innerHeight - size.h) / 2)

const panelStyle = computed(() => ({
  width: `${size.w}px`,
  height: `${size.h}px`,
  left: `${position.x}px`,
  top: `${position.y}px`,
}))

function startDrag(e: MouseEvent) {
  dragging.active = true
  dragging.startX = e.clientX
  dragging.startY = e.clientY
  dragging.origX = position.x
  dragging.origY = position.y
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging.active) return
  position.x = Math.max(
    0,
    Math.min(window.innerWidth - size.w, dragging.origX + e.clientX - dragging.startX),
  )
  position.y = Math.max(
    0,
    Math.min(window.innerHeight - size.h, dragging.origY + e.clientY - dragging.startY),
  )
}

function stopDrag() {
  dragging.active = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function startResize(e: MouseEvent, dir: string) {
  resizing.active = true
  resizing.dir = dir
  resizing.startX = e.clientX
  resizing.startY = e.clientY
  resizing.origX = position.x
  resizing.origY = position.y
  resizing.origW = size.w
  resizing.origH = size.h
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!resizing.active) return
  const dx = e.clientX - resizing.startX,
    dy = e.clientY - resizing.startY
  let nw = resizing.origW,
    nh = resizing.origH,
    nx = resizing.origX,
    ny = resizing.origY
  if (resizing.dir.includes('e')) nw = Math.max(MIN_W, resizing.origW + dx)
  if (resizing.dir.includes('w')) {
    nw = Math.max(MIN_W, resizing.origW - dx)
    nx = resizing.origX + resizing.origW - nw
  }
  if (resizing.dir.includes('s')) nh = Math.max(MIN_H, resizing.origH + dy)
  if (resizing.dir.includes('n')) {
    nh = Math.max(MIN_H, resizing.origH - dy)
    ny = resizing.origY + resizing.origH - nh
  }
  size.w = nw
  size.h = nh
  position.x = nx
  position.y = ny
}

function stopResize() {
  resizing.active = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}
</script>
