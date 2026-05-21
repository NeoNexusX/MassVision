<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
    <div class="text-sm text-base-content/50 font-medium tracking-wide">
      <slot name="info">
        Showing <span class="text-base-content">{{ from }}</span> -
        <span class="text-base-content">{{ to }}</span> of
        <span class="text-base-content">{{ totalItems }}</span>
      </slot>
    </div>

    <div
      v-if="totalPages > 1"
      class="join overflow-hidden border border-base-200/80 rounded-lg shadow-sm"
    >
      <button
        class="join-item btn btn-sm bg-base-100 hover:bg-base-200 border-0 px-4 text-base-content/70 h-9 min-h-9"
        :disabled="currentPage === 1"
        @click="$emit('prev-page')"
      >
        Prev
      </button>
      <div class="join-item h-9 w-px bg-base-200/80"></div>
      <template v-for="(p, idx) in pageRange" :key="`pg-${idx}`">
        <button
          v-if="p !== '...'"
          class="join-item btn btn-sm border-0 font-medium h-9 min-h-9"
          :class="
            currentPage === p
              ? 'bg-base-200/80 text-base-content'
              : 'bg-base-100 hover:bg-base-200/50 text-base-content/60'
          "
          @click="$emit('go-to-page', Number(p))"
        >
          {{ p }}
        </button>
        <span v-else class="join-item btn btn-sm btn-disabled border-0 h-9 min-h-9">...</span>
      </template>
      <div class="join-item h-9 w-px bg-base-200/80"></div>
      <button
        class="join-item btn btn-sm bg-base-100 hover:bg-base-200 border-0 px-4 text-base-content/70 h-9 min-h-9"
        :disabled="currentPage === totalPages"
        @click="$emit('next-page')"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentPage: number
  totalPages: number
  totalItems: number
  from: number
  to: number
  pageRange: (number | string)[]
}>()

defineEmits<{
  (e: 'prev-page'): void
  (e: 'next-page'): void
  (e: 'go-to-page', page: number): void
}>()
</script>
