<script setup lang="ts">
import { ref, computed, onMounted, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { auth_api } from '@/utils/api'; 
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

interface User {
  id: number;
  username: string;
  active: boolean;
  identity: string;
  institution: string;
  position: string;
  research_field: string;
  region: string;
  orcid: string;
  homepage: string;
  email: string;
  total_file_size?: number;
  file_count?: number;
}

// ---------------- State ----------------
const users = ref<User[]>([]);
const loading = ref(true);
const error = ref('');

const authStore = useAuthStore();
const router = useRouter();
const { showToast } = useToast();

const confirmModal = ref<HTMLDialogElement | null>(null);

// Restrict access
watchEffect(() => {
  if (authStore.user !== null && !authStore.isAdmin) {
    router.replace('/');
  }
});

// ---------------- Filters ----------------
const filters = ref({
  username: '',
  status: 'Active', // 默认 active 为 true
  institution: '',
  region: ''
});

// ---------------- Pagination ----------------
const currentPage = ref(1);
const pageSize = ref(10);
const totalItems = ref(0);

// ---------------- Drawer State ----------------
const isDrawerOpen = ref(false);
const selectedUser = ref<User | null>(null);

// ---------------- Fetch Data ----------------
const fetchUsers = async () => {
  loading.value = true;
  error.value = '';
  try {
    const payload = {
      username: filters.value.username,
      active: filters.value.status === 'Inactive' ? false : true,
      institution: filters.value.institution,
      region: filters.value.region
    };

    const res = await auth_api.post('/list_users', payload, {
      params: {
        page: currentPage.value,
        size: pageSize.value
      }
    });
    
    // 适配后端实际返回结构
    users.value = res.data?.data || [];
    totalItems.value = res.data?.meta?.total_records || users.value.length;
  } catch (err: any) {
    console.error('Failed to load users:', err);
    error.value = err.message || 'Failed to load users from server.';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // If user is already loaded, only fetch when user is admin
  if (authStore.user) {
    if (authStore.isAdmin) fetchUsers();
    return;
  }

  // If we have a token but no user loaded yet, fetch user first then conditionally fetch list
  if (authStore.token) {
    try {
      await authStore.fetchUser();
      if (authStore.isAdmin) fetchUsers();
    } catch (err) {
      // fetchUser handles logout on 401; if fetch failed, do not call fetchUsers
    }
  }
  // If no token and no user, do nothing (user not authenticated)
});

// ---------------- Computed ----------------
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value) || 1);

// ---------------- Stats ----------------
const stats = computed(() => {
  const total = totalItems.value;
  const active = users.value.filter(u => u.active).length;
  const inactive = users.value.length - active;
  const instCount = new Set(users.value.map(u => u.institution).filter(Boolean)).size;
  
  return { total, active, inactive, instCount };
});

// ---------------- Handlers ----------------
const resetFilters = () => {
  filters.value = { username: '', status: 'Active', institution: '', region: '' };
  currentPage.value = 1;
  fetchUsers();
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchUsers();
};

const openDrawer = (user: User) => {
  selectedUser.value = user;
  isDrawerOpen.value = true;
};

const closeDrawer = () => {
  isDrawerOpen.value = false;
  setTimeout(() => {
    selectedUser.value = null;
  }, 300); // clear after animation
};

const promptDeleteUser = () => {
  if (selectedUser.value) {
    confirmModal.value?.showModal();
  }
};

const executeDeleteUser = async () => {
  if (!selectedUser.value) return;

  loading.value = true;
  try {
    await auth_api.delete(`/user_delete/${selectedUser.value.id}`);

    showToast('User deleted successfully', 'success');
    confirmModal.value?.close();
    closeDrawer();
    fetchUsers();
  } catch (err: any) {
    console.error('Failed to delete user:', err);
    showToast(err.message || 'Failed to delete user', 'error');
  } finally {
    loading.value = false;
  }
};

const prevPage = () => { if (currentPage.value > 1) { currentPage.value--; fetchUsers(); } };
const nextPage = () => { if (currentPage.value < totalPages.value) { currentPage.value++; fetchUsers(); } };
const goToPage = (page: number) => { currentPage.value = page; fetchUsers(); };
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
        <button class="btn btn-primary rounded-xl shadow-sm border-none" @click="fetchUsers" :disabled="loading">
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          <SvgIcon v-else type="refresh" class="h-4 w-4" />
          Refresh
        </button>
      </div>

      <!-- 6. Stats Cards (Top) -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
          <div class="text-sm font-medium text-base-content/50">Total Users</div>
          <div class="text-3xl font-bold mt-2 text-base-content">{{ stats.total }}</div>
        </div>
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
          <div class="text-sm font-medium text-base-content/50">Active Users</div>
          <div class="text-3xl font-bold mt-2 text-success">{{ stats.active }}</div>
        </div>
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
          <div class="text-sm font-medium text-base-content/50">Inactive Users</div>
          <div class="text-3xl font-bold mt-2 text-base-content/40">{{ stats.inactive }}</div>
        </div>
        <div class="card bg-base-100 rounded-2xl shadow-sm border border-base-200/60 p-5">
          <div class="text-sm font-medium text-base-content/50">Institutions</div>
          <div class="text-3xl font-bold mt-2 text-base-content">{{ stats.instCount }}</div>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="alert alert-error alert-soft rounded-2xl shadow-sm border border-error/20">
        <SvgIcon type="error" class="stroke-current shrink-0 h-6 w-6" />
        <div class="flex-1">
          <h3 class="font-bold">Failed to load users</h3>
          <div class="text-sm opacity-80">{{ error }}</div>
        </div>
        <button class="btn btn-sm btn-ghost" @click="fetchUsers">Retry</button>
      </div>

      <!-- Main Data Area -->
      <div class="bg-base-100 rounded-2xl shadow-sm border border-base-200/60 flex flex-col overflow-hidden">
        
        <!-- 2. Filter Area -->
        <div class="p-4 border-b border-base-200 flex flex-wrap items-center gap-3 bg-base-100">
          <div class="relative w-full max-w-xs">
            <input 
              v-model="filters.username" 
              @keyup.enter="handleSearch"
              type="text" 
              placeholder="Search username..." 
              class="input input-sm input-bordered rounded-lg bg-base-100 w-full pl-9 focus:outline-none focus:border-primary/50 text-sm"
            />
            <SvgIcon type="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          </div>
          
          <select v-model="filters.status" class="select select-sm select-bordered rounded-lg bg-base-100 font-normal text-sm w-36">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <input 
            v-model="filters.institution" 
            @keyup.enter="handleSearch"
            type="text" 
            placeholder="Institution..." 
            class="input input-sm input-bordered rounded-lg bg-base-100 font-normal text-sm w-44 focus:outline-none focus:border-primary/50"
          >

          <input 
            v-model="filters.region" 
            @keyup.enter="handleSearch"
            type="text" 
            placeholder="Region..." 
            class="input input-sm input-bordered rounded-lg bg-base-100 font-normal text-sm w-36 focus:outline-none focus:border-primary/50"
          >

          <div class="flex-1"></div>
          
          <button @click="handleSearch" class="btn btn-sm btn-primary rounded-lg font-medium shadow-sm">
            Search
          </button>
          
          <button @click="resetFilters" class="btn btn-sm btn-outline border border-base-300 text-base-content/70 hover:bg-base-200 font-medium">
            Reset Filters
          </button>
        </div>

        <!-- 3. User Table -->
        <div class="overflow-x-auto w-full">
          <table class="table table-md w-full">
            <thead>
              <tr class="bg-base-50 text-base-content/60 border-b border-base-200 text-sm">
                <th class="font-medium py-3 pl-6">Username</th>
                <th class="font-medium py-3 w-32">Status</th>
                <th class="font-medium py-3">Institution</th>
                <th class="font-medium py-3">Region</th>
                <th class="font-medium py-3 rounded-tr-2xl text-right pr-6 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Empty state -->
              <tr v-if="!loading && users.length === 0">
                <td colspan="5" class="py-20 text-center text-base-content/40">
                  <div class="flex flex-col items-center justify-center">
                    <SvgIcon type="duplicate" class="h-10 w-10 mb-3 opacity-30" />
                    <span>No users match your filters.</span>
                  </div>
                </td>
              </tr>
              
              <!-- Loading Skeleton -->
              <template v-if="loading">
                <tr v-for="i in 3" :key="`skel-${i}`" class="border-b border-base-200/50">
                  <td class="pl-6 py-4"><div class="skeleton h-4 w-32 rounded"></div></td>
                  <td><div class="skeleton h-5 w-16 rounded-full"></div></td>
                  <td><div class="skeleton h-4 w-40 rounded"></div></td>
                  <td><div class="skeleton h-4 w-24 rounded"></div></td>
                  <td class="pr-6 text-right"><div class="skeleton h-7 w-14 inline-block rounded-lg"></div></td>
                </tr>
              </template>

              <!-- Data Rows -->
              <template v-else>
                <tr 
                  v-for="user in users" 
                  :key="user.username" 
                  class="hover:bg-base-200/40 group transition-colors duration-150 border-b border-base-200/50 last:border-0"
                >
                  <td class="font-medium text-base-content pl-6 py-4">{{ user.username }}</td>
                  <td>
                    <span 
                      class="badge badge-sm font-medium border-0" 
                      :class="user.active ? 'badge-success badge-soft bg-success/10 text-success' : 'badge-neutral badge-soft bg-base-200 text-base-content/60'"
                    >
                      {{ user.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="text-base-content/80">{{ user.institution || '—' }}</td>
                  <td class="text-base-content/80">{{ user.region || '—' }}</td>
                  <td class="pr-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button @click="openDrawer(user)" class="btn btn-sm btn-ghost border border-base-200/60 rounded-lg hover:bg-base-100 hover:border-base-300 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium h-8 min-h-8">
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- 4. Pagination -->
        <div class="p-4 border-t border-base-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-base-50/50">
          <div class="text-sm text-base-content/50 font-medium tracking-wide">
            Showing <span class="text-base-content">{{ totalItems ? (currentPage - 1) * pageSize + 1 : 0 }}</span> - <span class="text-base-content">{{ Math.min(currentPage * pageSize, totalItems) }}</span> of <span class="text-base-content">{{ totalItems }}</span>
          </div>
          
          <div class="join overflow-hidden border border-base-200/80 rounded-lg shadow-sm" v-if="totalPages > 1">
            <button 
              class="join-item btn btn-sm bg-base-100 hover:bg-base-200 border-0 px-4 text-base-content/70 h-9 min-h-9" 
              :disabled="currentPage === 1" 
              @click="prevPage"
            >
              Prev
            </button>
            <div class="join-item h-9 w-px bg-base-200/80"></div>
            
            <button 
              v-for="p in totalPages" 
              :key="p" 
              class="join-item btn btn-sm border-0 font-medium h-9 min-h-9"
              :class="currentPage === p ? 'bg-base-200/80 text-base-content' : 'bg-base-100 hover:bg-base-200/50 text-base-content/60'"
              @click="goToPage(p)"
            >
              {{ p }}
            </button>
            
            <div class="join-item h-9 w-px bg-base-200/80"></div>
            <button 
              class="join-item btn btn-sm bg-base-100 hover:bg-base-200 border-0 px-4 text-base-content/70 h-9 min-h-9" 
              :disabled="currentPage === totalPages" 
              @click="nextPage"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. Drawer / Details Panel -->
    <div class="drawer-side z-50">
      <div aria-label="close sidebar" class="drawer-overlay" @click="closeDrawer"></div>
      <div class="menu w-[400px] max-w-[100vw] min-h-full bg-base-100 p-0 flex flex-col text-base-content shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-base-200">
        
        <div class="px-6 py-5 border-b border-base-200 flex items-center justify-between bg-base-100">
          <h2 class="text-lg font-bold">User Details</h2>
          <button class="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:bg-base-200" @click="closeDrawer">✕</button>
        </div>

        <div class="p-6 flex-1 overflow-y-auto" v-if="selectedUser">
          
          <div class="flex items-center gap-5 mb-8 p-4 bg-base-200/40 rounded-2xl border border-base-200/60">
            <div class="avatar placeholder">
              <div class="bg-base-100 shadow-sm border border-base-200 text-base-content rounded-full w-14 h-14 flex items-center justify-center">
                <span class="text-xl font-bold uppercase">{{ selectedUser.username.substring(0, 1) }}</span>
              </div>
            </div>
            <div>
              <h3 class="text-lg font-bold mb-1">{{ selectedUser.username }}</h3>
              <div class="flex gap-2 items-center">
                <span 
                  class="badge badge-sm font-medium border-0" 
                  :class="selectedUser.active ? 'badge-success badge-soft bg-success/10 text-success' : 'badge-neutral badge-soft bg-base-200/80 text-base-content/60'"
                >
                  {{ selectedUser.active ? 'Active' : 'Inactive' }}
                </span>
                <span class="badge badge-sm badge-neutral badge-outline opacity-60 uppercase text-[10px]">
                  {{ selectedUser.identity }}
                </span>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="flex flex-wrap gap-4">
              <div class="w-full sm:w-1/2">
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">Institution</span>
                <p class="text-sm font-medium mt-1">{{ selectedUser.institution || '—' }}</p>
              </div>
              <div class="w-full sm:w-1/2">
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">Region</span>
                <p class="text-sm font-medium mt-1">{{ selectedUser.region || '—' }}</p>
              </div>
            </div>

            <hr class="border-base-200/60" />

            <div class="flex flex-wrap gap-4">
              <div class="w-full sm:w-1/2">
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">Position</span>
                <p class="text-sm font-medium mt-1">{{ selectedUser.position || '—' }}</p>
              </div>
              <div class="w-full sm:w-1/2">
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">Field</span>
                <p class="text-sm font-medium mt-1">{{ selectedUser.research_field || '—' }}</p>
              </div>
            </div>

            <hr class="border-base-200/60" />

            <div class="space-y-4">
              <div>
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">Email</span>
                <p class="text-sm font-medium mt-1">{{ selectedUser.email || '—' }}</p>
              </div>
              
              <div>
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">ORCID</span>
                <p class="text-sm font-medium mt-1">{{ selectedUser.orcid || '—' }}</p>
              </div>

              <div>
                <span class="text-xs font-semibold text-base-content/40 tracking-wider">Homepage</span>
                <p class="text-sm font-medium mt-1 truncate">
                  <a v-if="selectedUser.homepage" :href="selectedUser.homepage" target="_blank" class="hover:underline">{{ selectedUser.homepage }}</a>
                  <template v-else>—</template>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-5 border-t border-base-200 bg-base-100 flex gap-3">
          <button class="btn border-base-200 bg-base-100 hover:bg-base-200 hover:border-base-300 text-base-content flex-1 rounded-xl shadow-sm font-medium">
            Edit
          </button>
          <button
            v-if="selectedUser?.username !== authStore.user?.username"
            class="btn flex-1 rounded-xl shadow-sm text-white border-none font-medium bg-error hover:bg-error/80"
            @click="promptDeleteUser"
          >
            Delete
          </button>
        </div>
        
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <dialog ref="confirmModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg text-error flex items-center gap-2">
          <SvgIcon type="warning" class="h-6 w-6" />
          Confirm Deletion
        </h3>
        <p class="py-4 text-base">
          Are you sure you want to permanently delete user <span class="font-bold text-base-content">{{ selectedUser?.username }}</span>? 
          This action cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn" @click="confirmModal?.close()" :disabled="loading">Cancel</button>
          <button class="btn btn-error text-white" @click="executeDeleteUser" :disabled="loading">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            Yes, Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
</style>

