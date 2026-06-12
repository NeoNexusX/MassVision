<template>
  <!-- Draggable chat window -->
  <div
    v-if="isOpen && !isMinimized"
    ref="panelRef"
    class="fixed z-[10000] flex flex-col rounded-2xl shadow-2xl bg-base-100 border border-base-200 overflow-hidden select-none"
    :style="panelStyle"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 dark:from-indigo-950 to-purple-50 dark:to-purple-950 border-b border-base-200 cursor-grab active:cursor-grabbing shrink-0"
      @mousedown="startDrag"
    >
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
        >
          <svg-icon type="sparkles" class="w-4 h-4 text-white" />
        </div>
        <span class="font-semibold text-sm text-base-content">AI Assistant</span>
        <span class="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Online
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="btn btn-xs btn-ghost btn-square"
          @click="isMinimized = true"
          title="Minimize"
        >
          <span class="text-sm font-bold">—</span>
        </button>
        <button class="btn btn-xs btn-ghost btn-square" @click="close" title="Close">
          <svg-icon type="close" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div ref="scrollRef" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <!-- AI Welcome -->
      <div class="flex gap-2">
        <div
          class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 mt-1"
        >
          <svg-icon type="sparkles" class="w-3 h-3 text-white" />
        </div>
        <div
          class="bg-base-200 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-base-content max-w-[85%] leading-relaxed"
        >
          {{ welcomeMsg }}
        </div>
      </div>

      <!-- Quick prompts -->
      <div class="flex flex-wrap gap-2 pt-1 pl-8">
        <button
          v-for="p in quickPrompts"
          :key="p"
          class="btn btn-xs bg-base-200 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-base-300 text-xs rounded-full"
          @click="askQuick(p)"
        >
          {{ p }}
        </button>
      </div>

      <!-- User message -->
      <div v-for="m in messages" :key="m.id">
        <div v-if="m.role === 'user'" class="flex justify-end">
          <div
            class="bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[80%]"
          >
            {{ m.content }}
          </div>
        </div>
        <div v-else class="flex gap-2">
          <div
            class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 mt-1"
          >
            <svg-icon type="sparkles" class="w-3 h-3 text-white" />
          </div>
          <div
            class="bg-base-200 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-base-content max-w-[85%]"
          >
            {{ m.content }}
          </div>
        </div>
      </div>

      <!-- Typing indicator -->
      <div v-if="isTyping" class="flex gap-2">
        <div
          class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 mt-1"
        >
          <svg-icon type="sparkles" class="w-3 h-3 text-white" />
        </div>
        <div class="bg-base-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
          <span
            class="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce"
            style="animation-delay: 0ms"
          ></span>
          <span
            class="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce"
            style="animation-delay: 150ms"
          ></span>
          <span
            class="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce"
            style="animation-delay: 300ms"
          ></span>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="border-t border-base-200 px-3 py-2 shrink-0">
      <div class="flex items-center gap-2">
        <button class="btn btn-sm btn-ghost btn-circle" title="Attach file">
          <svg-icon type="paper-clip" class="w-4 h-4 text-base-content/50" />
        </button>
        <input
          v-model="inputValue"
          class="input input-sm input-bordered flex-1 text-sm rounded-full"
          placeholder="Ask AI anything…"
          @keydown.enter="send"
        />
        <button
          class="btn btn-sm btn-circle bg-indigo-500 hover:bg-indigo-600 border-none text-white"
          :disabled="!inputValue.trim()"
          @click="send"
          title="Send"
        >
          <svg-icon type="bolt" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

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
import { ref, reactive, computed, watch } from 'vue'

const props = defineProps<{ show?: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const isOpen = ref(false)
const isMinimized = ref(false)

watch(
  () => props.show,
  (v) => {
    if (v) {
      isOpen.value = true
      isMinimized.value = false
    }
  },
)
const isTyping = ref(false)
const inputValue = ref('')
const messages = ref<{ id: number; role: 'user' | 'ai'; content: string }[]>([])

const welcomeMsg =
  "Hi, I'm your AI research assistant. I can help explain ion images, summarize datasets, suggest preprocessing methods, and support report writing."

const quickPrompts = [
  'Summarize this dataset',
  'Explain this ion image',
  'Suggest preprocessing methods',
  'Help me write a report',
]

let nextId = 1
function askQuick(prompt: string) {
  messages.value.push({ id: nextId++, role: 'user', content: prompt })
  isTyping.value = true
  setTimeout(() => {
    isTyping.value = false
    messages.value.push({
      id: nextId++,
      role: 'ai',
      content: `Here's my response to "${prompt}". This is a simulated reply — connect your backend AI to see real results.`,
    })
  }, 1200)
}

function send() {
  const text = inputValue.value.trim()
  if (!text) return
  inputValue.value = ''
  messages.value.push({ id: nextId++, role: 'user', content: text })
  isTyping.value = true
  setTimeout(() => {
    isTyping.value = false
    messages.value.push({
      id: nextId++,
      role: 'ai',
      content: `Thanks for your message! I received "${text}". This is a demo — connect your AI backend for real answers.`,
    })
  }, 1200)
}

function open() {
  isOpen.value = true
}
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
const size = reactive({ w: 380, h: 520 })
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

// Default: bottom-right
position.x = window.innerWidth - size.w - 24
position.y = window.innerHeight - size.h - 24

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
