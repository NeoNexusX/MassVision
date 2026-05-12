<template>
  <div class="p-6">
    <h2 class="text-2xl font-semibold">Task Detail</h2>
    <div class="mt-4 card p-4 border border-base-200">
      <p><strong>ID:</strong> {{ id }}</p>
      <p><strong>Name:</strong> {{ task?.name }}</p>
      <p><strong>Status:</strong> {{ task?.status }}</p>
      <pre class="mt-3">{{ task }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const id = route.params.id as string
// placeholder - fetch real task by id
const task = ref({ id, name: 'Demo Task', status: 'Running', dataset: 'DS1', methods: ['TIC'] })
</script>
