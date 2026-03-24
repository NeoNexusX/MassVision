<script setup lang="ts">
import { useToast } from '@/utils/toast';

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
          'alert-error text-red-700 bg-red-50/95 border-red-200 dark:bg-red-900/90 dark:text-red-100 dark:border-red-700': toast.type === 'error'
        }"
      >
        <div class="flex items-center gap-3">
            <svg v-if="toast.type === 'info'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <svg v-if="toast.type === 'success'" xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <svg v-if="toast.type === 'warning'" xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <svg v-if="toast.type === 'error'" xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span class="text-sm font-medium">{{ toast.message }}</span>
        </div>
        <button @click="removeToast(toast.id)" class="btn btn-xs btn-ghost btn-circle opacity-50 hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
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
