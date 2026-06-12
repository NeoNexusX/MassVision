<template>
  <div class="flex flex-col h-screen max-h-screen overflow-hidden bg-base-100">
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden max-w-[1640px] mx-auto w-full">
      <div class="px-4">
        <slot name="top-bar"></slot>
      </div>
      <div class="flex-1 min-h-0 flex gap-6 p-4 pt-2 overflow-hidden">
        <div class="flex-1 min-h-0 min-w-0 flex flex-col gap-4">
          <slot name="main"></slot>
        </div>
        <slot name="side-panel"></slot>
      </div>
    </div>
  </div>
</template>
