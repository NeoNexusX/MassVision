<template>
  <div class="min-h-screen flex flex-col transition-colors duration-300">
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
