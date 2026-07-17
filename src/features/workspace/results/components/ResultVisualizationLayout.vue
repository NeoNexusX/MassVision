<template>
  <div class="flex flex-col bg-base-100 min-h-screen lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
    <div class="flex-1 min-h-0 flex flex-col max-w-[1640px] mx-auto w-full">
      <div class="px-4 shrink-0">
        <slot name="top-bar"></slot>
      </div>
      <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 pt-2 lg:overflow-hidden">
        <div class="min-h-0 min-w-0 flex flex-col gap-4 lg:flex-1">
          <slot name="main"></slot>
        </div>
        <slot name="side-panel"></slot>
      </div>
    </div>
  </div>
</template>
