<template>
  <div class="flex flex-col bg-base-100 lg:h-screen lg:overflow-hidden">
    <div class="flex flex-col max-w-[1920px] mx-auto w-full lg:h-full">
      <div class="px-10 shrink-0">
        <slot name="top-bar"></slot>
      </div>
      <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6 px-10 py-4 pt-2 lg:overflow-hidden">
        <div class="lg:shrink-0 lg:min-h-0 lg:self-stretch lg:h-full lg:overflow-y-auto scrollbar-thin">
          <slot name="left-panel"></slot>
        </div>
        <div class="min-w-0 flex flex-col gap-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto no-scrollbar">
          <slot name="main"></slot>
        </div>
        <div class="lg:shrink-0 lg:min-h-0 lg:overflow-y-auto scrollbar-thin">
          <slot name="side-panel"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
