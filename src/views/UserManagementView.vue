<script setup lang="ts">
import { useUserManagement } from '@/features/users/composables/useUserManagement'
import UserStats from '@/features/users/components/UserStats.vue'
import UserTable from '@/features/users/components/UserTable.vue'
import UserDrawer from '@/features/users/components/UserDrawer.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'

const {
  users,
  loading,
  error,
  authStore,
  isConfirmOpen,
  filters,
  currentPage,
  pageSize,
  totalItems,
  isDrawerOpen,
  selectedUser,
  totalPages,
  stats,
  from,
  to,
  pageRange,
  fetchUsers,
  resetFilters,
  handleSearch,
  openDrawer,
  closeDrawer,
  promptDeleteUser,
  cancelDeleteUser,
  executeDeleteUser,
  prevPage,
  nextPage,
  goToPage,
} = useUserManagement()
</script>

<template>
  <div class="drawer drawer-end min-h-screen bg-base-200 font-sans">
    <input id="user-drawer" type="checkbox" class="drawer-toggle" v-model="isDrawerOpen" />

    <!-- Main Content -->
    <div class="drawer-content p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <!-- 1. Top Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-base-content tracking-tight">User Management</h1>
          <p class="text-base-content/60 mt-1">View and manage registered users across regions.</p>
        </div>
        <button
          class="btn btn-primary rounded-xl shadow-sm border-none"
          @click="fetchUsers"
          :disabled="loading"
        >
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          <SvgIcon v-else type="refresh" class="h-4 w-4" />
          Refresh
        </button>
      </div>

      <UserStats :stats="stats" />

      <!-- Error State -->
      <div
        v-if="error"
        class="alert alert-error alert-soft rounded-2xl shadow-sm border border-error/20"
      >
        <SvgIcon type="error" class="stroke-current shrink-0 h-6 w-6" />
        <div class="flex-1">
          <h3 class="font-bold">Failed to load users</h3>
          <div class="text-sm opacity-80">{{ error }}</div>
        </div>
        <button class="btn btn-sm btn-ghost" @click="fetchUsers">Retry</button>
      </div>

      <UserTable
        :users="users"
        :loading="loading"
        :filters="filters"
        :current-page="currentPage"
        :page-size="pageSize"
        :total-items="totalItems"
        :total-pages="totalPages"
        :from="from"
        :to="to"
        :page-range="pageRange"
        @search="handleSearch"
        @reset-filters="resetFilters"
        @open-drawer="openDrawer"
        @prev-page="prevPage"
        @next-page="nextPage"
        @go-to-page="goToPage"
      />
    </div>

    <UserDrawer
      :selected-user="selectedUser"
      :current-username="authStore.user?.username"
      @close="closeDrawer"
      @delete="promptDeleteUser"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmDialog
      :open="isConfirmOpen"
      title="Confirm Deletion"
      :message="`Are you sure you want to permanently delete user ${selectedUser?.username}? This action cannot be undone.`"
      confirm-label="Yes, Delete"
      :danger="true"
      :loading="loading"
      @confirm="executeDeleteUser"
      @cancel="cancelDeleteUser"
    />
  </div>
</template>

<style scoped></style>
