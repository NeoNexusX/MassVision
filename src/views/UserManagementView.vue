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
  isDrawerOpen,
  selectedUser,
  meta,
  stats,
  pageRange,
  from,
  to,
  fetchUsers,
  resetFilters,
  handleSearch,
  openDrawer,
  closeDrawer,
  promptDeleteUser,
  cancelDeleteUser,
  executeDeleteUser,
  goToPage,
  changeSize,
  quotaLimits,
  quotaLoading,
  saveUserQuota,
} = useUserManagement()
</script>

<template>
  <div class="min-h-screen bg-base-200 font-sans page-type">
    <!-- Main Content -->
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-8">
      <!-- 1. Top Banner -->
      <div class="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="page-title font-semibold text-base-content">User Management</h1>
          <p class="page-subtitle text-base-content/60 mt-1">View and manage registered users across regions.</p>
        </div>
        <button
          class="btn btn-primary rounded-lg shadow-sm border-none"
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
        :total-pages="meta.total_pages"
        :total-items="meta.total_records"
        :from="from"
        :to="to"
        :page-range="pageRange"
        @search="handleSearch"
        @reset-filters="resetFilters"
        @open-drawer="openDrawer"
        @go-to-page="goToPage"
        @change-size="changeSize"
      />
    </div>

    <UserDrawer
      :selected-user="selectedUser"
      :current-username="authStore.user?.username"
      :quota-limits="quotaLimits"
      :quota-loading="quotaLoading"
      @close="closeDrawer"
      @delete="promptDeleteUser"
      @save-quota="saveUserQuota"
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
