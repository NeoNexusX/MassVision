<template>
  <div class="flex flex-col min-h-screen bg-base-200">
    <!-- Navbar: Glassmorphism effect -->
    <div class="navbar bg-base-100/80 backdrop-blur-md sticky top-0 z-50 px-6 shadow-sm">
      <div class="flex-1">
        <a class="btn btn-ghost text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          MassVision
        </a>
      </div>
      <div class="flex-none gap-2">
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar placeholder">
            <div class="bg-neutral text-neutral-content rounded-full w-10">
              <span class="text-xs">U</span>
            </div>
          </div>
          <ul tabindex="0" class="mt-3 z-[1] p-2 shadow-lg menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
            <li><a>Profile</a></li>
            <li><a>Settings</a></li>
            <li><a class="text-error" @click="handleLogout">Logout</a></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="p-6 space-y-6 max-w-7xl mx-auto w-full">
      
      <!-- Stats Section: Cards grid instead of single bar -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="stat bg-base-100 shadow-xl rounded-2xl border-l-4 border-primary">
          <div class="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          </div>
          <div class="stat-title font-semibold">Total Downloads</div>
          <div class="stat-value text-primary">31K</div>
          <div class="stat-desc">Jan 1st - Feb 1st</div>
        </div>

        <div class="stat bg-base-100 shadow-xl rounded-2xl border-l-4 border-secondary">
          <div class="stat-figure text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <div class="stat-title font-semibold">New Users</div>
          <div class="stat-value text-secondary">4,200</div>
          <div class="stat-desc">↗︎ 40 (2%)</div>
        </div>

        <div class="stat bg-base-100 shadow-xl rounded-2xl border-l-4 border-accent">
          <div class="stat-figure text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <div class="stat-title font-semibold">Active Registers</div>
          <div class="stat-value text-accent">1,200</div>
          <div class="stat-desc">↘︎ 90 (14%)</div>
        </div>
      </div>

      <!-- Dashboard Panels -->
      <div class="grid lg:grid-cols-2 gap-6 h-[calc(100vh-18rem)]">
        <!-- Panel Left -->
        <div class="card bg-base-100 shadow-xl overflow-hidden h-full">
          <div class="card-body p-0 h-full flex flex-col">
            <h2 class="card-title px-6 pt-6 mb-2">Server Status A</h2>
            <div class="flex-1 bg-base-200/50 m-4 rounded-xl flex flex-col items-center justify-center relative group hover:bg-base-200 transition-all">
              <div class="radial-progress text-primary group-hover:scale-110 transition-transform duration-300" style="--value:70; --size:10rem; --thickness: 1rem;" aria-valuenow="70" role="progressbar">
                <span class="text-2xl font-bold text-base-content">70%</span>
              </div>
              <p class="mt-4 text-sm font-medium opacity-60">CPU Usage</p>
            </div>
          </div>
        </div>

        <!-- Panel Right -->
        <div class="card bg-base-100 shadow-xl overflow-hidden h-full">
          <div class="card-body p-0 h-full flex flex-col">
            <h2 class="card-title px-6 pt-6 mb-2">Server Status B</h2>
             <div class="flex-1 bg-base-200/50 m-4 rounded-xl flex flex-col items-center justify-center relative group hover:bg-base-200 transition-all">
              <div class="radial-progress text-secondary group-hover:scale-110 transition-transform duration-300" style="--value:45; --size:10rem; --thickness: 1rem;" aria-valuenow="45" role="progressbar">
                <span class="text-2xl font-bold text-base-content">45%</span>
              </div>
              <p class="mt-4 text-sm font-medium opacity-60">Memory Load</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const handleLogout = () => {
  // 1. 清除 Token
  localStorage.removeItem('access_token');
  // 2. 跳转回登录页
  router.push('/login');
};
</script>