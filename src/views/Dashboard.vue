<template>
  <div class="flex flex-col min-h-screen">
    <!-- status bar -->
    <div class="w-full border flex items-auto px-4">
      <div class="stats shadow w-full">
        <div class="stat place-items-center">
          <div class="stat-title">Downloads</div>
          <div class="stat-value">31K</div>
          <div class="stat-desc">From January</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Users</div>
          <div class="stat-value text-secondary">4,200</div>
          <div class="stat-desc text-secondary">↗︎ 40 (2%)</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">New Registers</div>
          <div class="stat-value">1,200</div>
          <div class="stat-desc">↘︎ 90 (14%)</div>
        </div>
      </div>
    </div>

    <div class="flex-1 flex">
      <div class="flex-1 mockup-window border-base-300 m-2">
        <div class="grid place-content-center border-t border-base-300 h-full">
          <div class="radial-progress" style="--value:70; --size:12rem; --thickness: 2rem;" aria-valuenow="70"
            role="progressbar">70%</div>
          <!-- <server-panel type="left" /> -->
          <div class="text-center p-4">Server Panel Left (Placeholder)</div>
        </div>
      </div>

      <div class="divider divider-horizontal"></div>

      <div class="flex-1 mockup-window border-base-300 m-2">
        <div class="grid place-content-center border-t border-base-300 h-full">
          <div class="radial-progress" style="--value:70; --size:12rem; --thickness: 2rem;" aria-valuenow="70"
            role="progressbar">70%</div>
          <!-- <server-panel type="right" /> -->
          <div class="text-center p-4">Server Panel Right (Placeholder)</div>
        </div>
      </div>
    </div>
  </div>
</template>