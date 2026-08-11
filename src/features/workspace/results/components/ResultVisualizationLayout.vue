<script setup lang="ts">
withDefaults(
  defineProps<{
    showLeftPanel?: boolean
    showCompare?: boolean
  }>(),
  {
    showLeftPanel: true,
    showCompare: true,
  },
)
</script>

<template>
  <div
    :class="[
      // Small screens
      'flex flex-col bg-base-100',
      // Desktop
      'lg:h-[100dvh] lg:overflow-hidden',
    ]"
  >
    <div
      :class="[
        // Small screens
        'mx-auto flex w-full flex-col',
        // Desktop
        'lg:h-full',
      ]"
    >
      <div
        :class="[
          // Small screens
          'flex min-h-0 flex-1 flex-col gap-4 px-3 pb-4 pt-4',
          // Medium screens
          'sm:px-6',
          // Desktop
          'lg:flex-row lg:gap-8 lg:overflow-hidden lg:px-10',
        ]"
      >
        <!-- 左列 -->
        <div
          v-if="showLeftPanel"
          :class="[
            // Small screens
            'w-full scrollbar-thin',
            // Desktop
            'lg:h-full lg:w-auto lg:min-h-0 lg:shrink-0 lg:self-stretch lg:overflow-y-auto',
          ]"
        >
          <slot name="left-panel"></slot>
        </div>
        <!-- 中列 -->
        <div
          :class="[
            // Small screens
            'flex min-w-0 flex-col gap-4 no-scrollbar',
            // Desktop
            'lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto',
          ]"
        >
          <div
            :class="[
              // Small screens
              'contents',
              // Desktop: reserve 2.5rem rail + 1rem gap only when Compare is enabled.
              'lg:flex lg:min-h-0 lg:flex-none lg:flex-col lg:gap-2',
              showCompare ? 'lg:h-[calc(100%_-_3.5rem)]' : 'lg:h-full',
            ]"
          >
            <slot name="viz"></slot>
          </div>
          <!-- Compare uses its natural height. Collapsed it is a 2.5rem rail;
               expanded content extends the middle column's scroll area without
               resizing the viewport-sized visualization section above it. -->
          <div
            v-if="showCompare"
            :class="[
              // Small screens
              'contents',
              // Desktop
              'lg:block lg:shrink-0',
            ]"
          >
            <slot name="compare"></slot>
          </div>
        </div>
        <!-- 右列-->
        <div
          :class="[
            // Small screens
            'w-full scrollbar-thin',
            // Desktop
            'lg:w-auto lg:min-h-0 lg:shrink-0 lg:overflow-y-auto',
          ]"
        >
          <slot name="side-panel"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
