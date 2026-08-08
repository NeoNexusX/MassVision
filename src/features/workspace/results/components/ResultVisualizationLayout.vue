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
              // Desktop
              'lg:flex lg:min-h-[940px] lg:flex-1 lg:flex-col lg:gap-4',
            ]"
          >
            <slot name="viz"></slot>
          </div>
          <!-- 桌面端始终只为折叠栏保留 40px；展开内容向下溢出，不参与 viz 的 flex 高度重算。 -->
          <div
            :class="[
              // Small screens
              'contents',
              // Desktop
              'lg:block lg:h-[40px] lg:min-h-[40px] lg:shrink-0 lg:overflow-visible',
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
