<template>
  <!-- 用 dvh 而非 100vh：与 HomeView 滚动根的 100dvh 对齐，避免 iOS/iPadOS Safari 上
       100vh(大视口) > 当前可见高度，导致外层多出一截滚动、把 Hero 底部滚动提示顶到工具栏下方。 -->
  <div class="min-h-[100dvh] max-w-full overflow-x-clip flex flex-col transition-colors duration-300">
    <Navbar />
    <!-- Main content area -->
    <main class="flex-1 w-full relative flex flex-col">
      <router-view></router-view>
      <ToastContainer />
    </main>
  </div>
</template>

<script setup lang="ts">
import Navbar from './components/Navbar.vue'
import ToastContainer from '@/shared/components/ToastContainer.vue'
</script>
