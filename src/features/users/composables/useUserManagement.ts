import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { useToast } from '@/shared/composables/useToast'
import { usePagination } from '@/shared/composables/usePagination'
import {
  deleteAdminUser,
  listAdminUsers,
  type AdminUser,
  type UserListFilters,
} from '@/features/users/api/userAdminApi'

export function useUserManagement() {
  // External composables
  const authStore = useAuthStore()
  const router = useRouter()
  const { showToast } = useToast()
  const pagination = usePagination(() => fetchUsers())

  // State
  const users = ref<AdminUser[]>([])
  const loading = ref(true)
  const error = ref('')
  const isConfirmOpen = ref(false)

  const filters = ref<UserListFilters>({
    username: '',
    status: 'Active',
    institution: '',
    region: '',
  })

  const isDrawerOpen = ref(false)
  const selectedUser = ref<AdminUser | null>(null)

  // Computed
  const stats = computed(() => {
    const total = pagination.totalItems.value
    const active = users.value.filter((user) => user.active).length
    const inactive = users.value.length - active
    const instCount = new Set(users.value.map((user) => user.institution).filter(Boolean)).size
    return { total, active, inactive, instCount }
  })

  // Methods
  const fetchUsers = async () => {
    loading.value = true
    error.value = ''
    try {
      const res = await listAdminUsers(
        filters.value,
        pagination.currentPage.value,
        pagination.pageSize.value,
      )
      users.value = res.data?.data || []
      pagination.totalItems.value = res.data?.meta?.total_records || users.value.length
    } catch (err: any) {
      console.error('Failed to load users:', err)
      error.value = err.message || 'Failed to load users from server.'
    } finally {
      loading.value = false
    }
  }

  const resetFilters = () => {
    filters.value = { username: '', status: 'Active', institution: '', region: '' }
    pagination.currentPage.value = 1
    fetchUsers()
  }

  const handleSearch = () => {
    pagination.currentPage.value = 1
    fetchUsers()
  }

  const openDrawer = (user: AdminUser) => {
    selectedUser.value = user
    isDrawerOpen.value = true
  }

  const closeDrawer = () => {
    isDrawerOpen.value = false
    setTimeout(() => {
      selectedUser.value = null
    }, 300)
  }

  const promptDeleteUser = () => {
    if (selectedUser.value) isConfirmOpen.value = true
  }

  const cancelDeleteUser = () => {
    isConfirmOpen.value = false
  }

  const executeDeleteUser = async () => {
    if (!selectedUser.value) return
    loading.value = true
    try {
      await deleteAdminUser(selectedUser.value.id)
      showToast('User deleted successfully', 'success')
      isConfirmOpen.value = false
      closeDrawer()
      fetchUsers()
    } catch (err: any) {
      console.error('Failed to delete user:', err)
      showToast(err.message || 'Failed to delete user', 'error')
    } finally {
      loading.value = false
    }
  }

  // Watchers
  watchEffect(() => {
    if (authStore.user !== null && !authStore.isAdmin) {
      router.replace('/')
    }
  })

  // Lifecycle
  onMounted(async () => {
    if (authStore.user) {
      if (authStore.isAdmin) fetchUsers()
      return
    }

    if (authStore.token) {
      try {
        await authStore.fetchUser()
        if (authStore.isAdmin) fetchUsers()
      } catch {
        /* fetchUser handles invalid auth */
      }
    }
  })

  return {
    users,
    loading,
    error,
    authStore,
    isConfirmOpen,
    filters,
    isDrawerOpen,
    selectedUser,
    stats,
    ...pagination,
    fetchUsers,
    resetFilters,
    handleSearch,
    openDrawer,
    closeDrawer,
    promptDeleteUser,
    cancelDeleteUser,
    executeDeleteUser,
  }
}
