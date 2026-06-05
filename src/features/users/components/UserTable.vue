<script setup lang="ts">
import type { AdminUser, UserListFilters } from '@/features/users/api/userAdminApi'
import StatusBadge from '@/shared/components/StatusBadge.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { getRegionName } from '@/shared/utils/regionOptions'

defineProps<{
  users: AdminUser[]
  loading: boolean
  filters: UserListFilters
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  from: number
  to: number
  pageRange: (number | string)[]
}>()

defineEmits<{
  (e: 'search'): void
  (e: 'reset-filters'): void
  (e: 'open-drawer', user: AdminUser): void
  (e: 'prev-page'): void
  (e: 'next-page'): void
  (e: 'go-to-page', page: number): void
}>()
</script>

<template>
  <div
    class="bg-base-100 rounded-2xl shadow-sm border border-base-200/60 flex flex-col overflow-hidden"
  >
    <div class="p-4 border-b border-base-200 flex flex-wrap items-center gap-3 bg-base-100">
      <div class="relative w-full max-w-xs">
        <input
          v-model="filters.username"
          @keyup.enter="$emit('search')"
          type="text"
          placeholder="Search username..."
          class="input input-sm input-bordered rounded-lg bg-base-100 w-full pl-9 focus:outline-none focus:border-primary/50 text-sm"
        />
        <SvgIcon
          type="search"
          class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
        />
      </div>

      <select
        v-model="filters.status"
        class="select select-sm select-bordered rounded-lg bg-base-100 font-normal text-sm w-36"
      >
        <option value="">All Status</option>
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
      </select>

      <input
        v-model="filters.institution"
        @keyup.enter="$emit('search')"
        type="text"
        placeholder="Institution..."
        class="input input-sm input-bordered rounded-lg bg-base-100 font-normal text-sm w-44 focus:outline-none focus:border-primary/50"
      />

      <input
        v-model="filters.region"
        @keyup.enter="$emit('search')"
        type="text"
        placeholder="Region..."
        class="input input-sm input-bordered rounded-lg bg-base-100 font-normal text-sm w-36 focus:outline-none focus:border-primary/50"
      />

      <div class="flex-1"></div>

      <button
        @click="$emit('search')"
        class="btn btn-sm btn-primary rounded-lg font-medium shadow-sm"
      >
        Search
      </button>

      <button
        @click="$emit('reset-filters')"
        class="btn btn-sm btn-outline border border-base-300 text-base-content/70 hover:bg-base-200 font-medium"
      >
        Reset Filters
      </button>
    </div>

    <div class="overflow-x-auto w-full">
      <table class="table table-md w-full">
        <thead>
          <tr class="bg-base-200 text-base-content/60 border-b border-base-200 text-sm">
            <th class="font-medium py-3 pl-6">Username</th>
            <th class="font-medium py-3 w-32">Status</th>
            <th class="font-medium py-3">Institution</th>
            <th class="font-medium py-3">Region</th>
            <th class="font-medium py-3 rounded-tr-2xl text-right pr-6 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && users.length === 0">
            <td colspan="5" class="py-20 text-center text-base-content/40">
              <div class="flex flex-col items-center justify-center">
                <SvgIcon type="duplicate" class="h-10 w-10 mb-3 opacity-30" />
                <span>No users match your filters.</span>
              </div>
            </td>
          </tr>

          <template v-if="loading">
            <tr v-for="index in 3" :key="`skel-${index}`" class="border-b border-base-200/50">
              <td class="pl-6 py-4"><div class="skeleton h-4 w-32 rounded"></div></td>
              <td><div class="skeleton h-5 w-16 rounded-full"></div></td>
              <td><div class="skeleton h-4 w-40 rounded"></div></td>
              <td><div class="skeleton h-4 w-24 rounded"></div></td>
              <td class="pr-6 text-right">
                <div class="skeleton h-7 w-14 inline-block rounded-lg"></div>
              </td>
            </tr>
          </template>

          <template v-else>
            <tr
              v-for="user in users"
              :key="user.username"
              class="hover:bg-base-200/40 group transition-colors duration-150 border-b border-base-200/50 last:border-0"
            >
              <td class="font-medium text-base-content pl-6 py-4">{{ user.username }}</td>
              <td>
                <StatusBadge :status="user.active ? 'active' : 'inactive'" />
              </td>
              <td class="text-base-content/80">{{ user.institution || '—' }}</td>
              <td class="text-base-content/80">{{ getRegionName(user.region) || '—' }}</td>
              <td class="pr-6 text-right">
                <button
                  @click="$emit('open-drawer', user)"
                  class="btn btn-sm btn-ghost border border-base-200/60 rounded-lg hover:bg-base-100 hover:border-base-300 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium h-8 min-h-8"
                >
                  View
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="p-4 border-t border-base-200 bg-base-200/50">
      <PaginationBar
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="totalItems"
        :from="from"
        :to="to"
        :page-range="pageRange"
        @prev-page="$emit('prev-page')"
        @next-page="$emit('next-page')"
        @go-to-page="(p) => $emit('go-to-page', p)"
      />
    </div>
  </div>
</template>
