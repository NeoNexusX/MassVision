<script setup lang="ts">
import type { AdminUser, UserListFilters } from '@/features/users/api/userAdminApi'
import StatusBadge from '@/shared/components/StatusBadge.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import { getRegionName } from '@/shared/utils/regionOptions'
import { getConfig } from '@/shared/config/runtimeConfig'

defineProps<{
  users: AdminUser[]
  loading: boolean
  filters: UserListFilters
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
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
  (e: 'change-size', size: number): void
}>()

const pageSizeOptions = getConfig().pagination.pageSizeOptions
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
          class="input input-bordered rounded-lg bg-base-100 w-full pl-9 focus:outline-none focus:border-primary/50 text-base"
        />
        <SvgIcon
          type="search"
          class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
        />
      </div>

      <select
        v-model="filters.status"
        class="select select-bordered rounded-lg bg-base-100 font-normal text-base w-36"
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
        class="input input-bordered rounded-lg bg-base-100 font-normal text-base w-44 focus:outline-none focus:border-primary/50"
      />

      <input
        v-model="filters.region"
        @keyup.enter="$emit('search')"
        type="text"
        placeholder="Region..."
        class="input input-bordered rounded-lg bg-base-100 font-normal text-base w-36 focus:outline-none focus:border-primary/50"
      />

      <div class="flex-1"></div>

      <button
        @click="$emit('search')"
        class="btn btn-primary rounded-lg font-medium shadow-sm"
      >
        Search
      </button>

      <button
        @click="$emit('reset-filters')"
        class="btn btn-outline border border-base-300 text-base-content/70 hover:bg-base-200 font-medium"
      >
        Reset Filters
      </button>
    </div>

    <div class="overflow-x-auto w-full">
      <table class="table table-fixed w-full">
        <colgroup>
          <col style="width: 22%" />
          <col style="width: 12%" />
          <col style="width: 12%" />
          <col style="width: 24%" />
          <col style="width: 18%" />
          <col style="width: 12%" />
        </colgroup>
        <thead>
          <tr class="bg-base-200 text-base-content/60 border-b border-base-200 text-lg">
            <th class="font-medium py-3 px-4 text-center">Username</th>
            <th class="font-medium py-3 px-4 text-center">Identity</th>
            <th class="font-medium py-3 px-4 text-center">Status</th>
            <th class="font-medium py-3 px-4 text-center">Institution</th>
            <th class="font-medium py-3 px-4 text-center">Region</th>
            <th class="font-medium py-3 px-4 text-center">View</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && users.length === 0">
            <td colspan="6" class="py-20 text-center text-base-content/40 text-lg">
              <div class="flex flex-col items-center justify-center">
                <SvgIcon type="duplicate" class="h-10 w-10 mb-3 opacity-30" />
                <span>No users match your filters.</span>
              </div>
            </td>
          </tr>

          <template v-if="loading">
            <tr v-for="index in 3" :key="`skel-${index}`" class="border-b border-base-200/50">
              <td class="py-4 px-4 text-center"><div class="skeleton h-5 w-32 rounded mx-auto"></div></td>
              <td class="px-4 text-center"><div class="skeleton h-5 w-16 rounded-full mx-auto"></div></td>
              <td class="px-4 text-center"><div class="skeleton h-5 w-16 rounded-full mx-auto"></div></td>
              <td class="px-4 text-center"><div class="skeleton h-5 w-40 rounded mx-auto"></div></td>
              <td class="px-4 text-center"><div class="skeleton h-5 w-24 rounded mx-auto"></div></td>
              <td class="px-4 text-center">
                <div class="skeleton h-8 w-14 inline-block rounded-lg"></div>
              </td>
            </tr>
          </template>

          <template v-else>
            <tr
              v-for="user in users"
              :key="user.username"
              class="hover:bg-base-200/40 group transition-colors duration-150 border-b border-base-200/50 last:border-0 text-lg"
            >
              <td class="font-medium text-base-content py-4 px-4 text-center">{{ user.username }}</td>
              <td class="px-4 text-center">
                <span
                  class="badge badge-sm uppercase text-[10px] font-medium border-0"
                  :class="
                    user.identity === 'admin'
                      ? 'bg-info/15 text-info'
                      : 'bg-success/15 text-success'
                  "
                >
                  {{ user.identity }}
                </span>
              </td>
              <td class="px-4 text-center">
                <StatusBadge :status="user.active ? 'active' : 'inactive'" />
              </td>
              <td class="text-base-content/80 px-4 text-center">{{ user.institution || '—' }}</td>
              <td class="text-base-content/80 px-4 text-center">{{ getRegionName(user.region) || '—' }}</td>
              <td class="px-4 text-center">
                <button
                  @click="$emit('open-drawer', user)"
                  class="btn btn-ghost border border-base-200/60 rounded-lg hover:bg-base-100 hover:border-base-300 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity text-base font-medium h-8 min-h-8"
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
      <div class="flex flex-wrap items-center gap-4 justify-end">
        <div class="flex items-center gap-2">
          <label class="whitespace-nowrap text-base text-base-content/60">Per page</label>
          <select
            :value="pageSize"
            @change="(e) => $emit('change-size', Number((e.target as HTMLSelectElement).value))"
            class="select select-bordered text-base pl-3 pr-8"
          >
            <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <PaginationBar
          :current-page="currentPage"
          :total-pages="totalPages"
          :total-items="totalItems"
          :from="from"
          :to="to"
          :page-range="pageRange"
          class="!justify-center"
          @prev-page="$emit('prev-page')"
          @next-page="$emit('next-page')"
          @go-to-page="(p) => $emit('go-to-page', p)"
        />
      </div>
    </div>
  </div>
</template>
