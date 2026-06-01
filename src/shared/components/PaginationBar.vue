<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
    <div
      v-if="totalPages > 0"
      class="flex items-center gap-3"
    >
      <div class="join">
        <button
          class="join-item btn hover:bg-secondary/80 bg-secondary/50 h-[2em] min-h-[2em] px-[1em] text-[1em]  text-base-content/70"
          :disabled="currentPage === 1"
          @click="$emit('prev-page')"
        >
          Prev
        </button>
        <div class="join-item h-[2em] w-px"></div>
        <template v-for="(p, idx) in pageRange" :key="`pg-${idx}`">
          <button
            v-if="p !== '...'"
            class="join-item btn h-[2em] min-h-[2em] font-medium text-[1em] bg-primary/80"
            :class="
              currentPage === p
                ? 'bg-base-200/80 text-base-content'
                : 'bg-base-100 hover:bg-primary/60 text-base-content/60'
            "
            @click="$emit('go-to-page', Number(p))"
          >
            {{ p }}
          </button>
          <span v-else class="join-item btn btn-disabled h-[2em] min-h-[2em] text-[1em]">...</span>
        </template>
        <div class="join-item h-[2em] w-px"></div>
        <button
          class="join-item btn hover:bg-secondary/80 bg-secondary/50 text-base-content/70 h-[2em] min-h-[2em] px-[1em] text-[1em]"
          :disabled="currentPage === totalPages"
          @click="$emit('next-page')"
        >
          Next
        </button>
      </div>

      <div class="join ">
        <input
          v-model="jumpInput"
          type="number"
          class="join-item input  bg-base-100 h-[2em] min-h-[2em] w-[4em] text-center text-[1em] text-base-content"
          :placeholder="`${currentPage}`"
          @keydown.enter="handleJump"
        />
        <div class="join-item h-[2em] w-px bg-base-200/80"></div>
        <button
          class="join-item btn  bg-primary-100 hover:bg-primary h-[2em] min-h-[2em] px-[1em] text-[1em] text-base-content/70"
          @click="handleJump"
        >
          Go
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  currentPage: number
  totalPages: number
  totalItems: number
  from: number
  to: number
  pageRange: (number | string)[]
}>()

const emit = defineEmits<{
  (e: 'prev-page'): void
  (e: 'next-page'): void
  (e: 'go-to-page', page: number): void
}>()

const jumpInput = ref('')

function handleJump() {
  const page = parseInt(jumpInput.value)
  if (!isNaN(page) && page >= 1 && page <= props.totalPages) {
    emit('go-to-page', page)
  }
  jumpInput.value = ''
}
</script>
