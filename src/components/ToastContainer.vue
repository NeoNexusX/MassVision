<script setup lang="ts">
import { useToast } from '@/composables/useToast';
// SvgIcon is globally registered in main.ts

const { toasts, removeToast } = useToast();
</script>

<template>
  <div class="toast toast-top toast-center z-[9999] pointer-events-none p-4 w-full flex flex-col items-center gap-2 max-w-md mx-auto fixed top-4 left-1/2 -translate-x-1/2">
    <transition-group name="toast-slide">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="alert shadow-lg pointer-events-auto flex items-center justify-between min-w-[300px] py-3 px-4 rounded-lg border backdrop-blur-md"
        :class="{
          'alert-info text-blue-700 bg-blue-50/95 border-blue-200 dark:bg-blue-900/90 dark:text-blue-100 dark:border-blue-700': toast.type === 'info',
          'alert-success text-green-700 bg-green-50/95 border-green-200 dark:bg-green-900/90 dark:text-green-100 dark:border-green-700': toast.type === 'success',
          'alert-warning text-yellow-700 bg-yellow-50/95 border-yellow-200 dark:bg-yellow-900/90 dark:text-yellow-100 dark:border-yellow-700': toast.type === 'warning',
          'alert-error text-error bg-red-50/95 border-red-200 dark:bg-red-900/90 dark:text-red-100 dark:border-red-700': toast.type === 'error'
        }"
      >
        <div class="flex items-center gap-3">
          <SvgIcon :type="toast.type" class="stroke-current shrink-0 w-6 h-6" />
          <span class="text-sm font-medium">{{ toast.message }}</span>
        </div>
        <button @click="removeToast(toast.id)" class="btn btn-xs btn-ghost btn-circle opacity-50 hover:opacity-100">
          <SvgIcon type="close" class="h-4 w-4" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
</style>
