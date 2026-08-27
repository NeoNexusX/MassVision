<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 左侧面板（Annotation）是否收起；收起时左列不占弹性份额，中列占满 */
    leftPanelCollapsed?: boolean
  }>(),
  {
    leftPanelCollapsed: false,
  },
)
</script>

<template>
  <div class="result-page flex flex-col bg-base-100 lg:h-[100dvh] lg:overflow-hidden">
    <div
      class="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-2 pt-2 lg:flex-row lg:gap-8 lg:overflow-hidden lg:px-6"
    >
      <!-- 左列 -->
      <div
        :class="[
          'visualize-fluid-type w-full scrollbar-thin lg:h-full lg:min-h-0 lg:min-w-0 lg:self-stretch lg:overflow-y-auto',
          leftPanelCollapsed ? 'lg:flex-none lg:w-auto' : 'lg:flex-[1_1_0%]',
        ]"
      >
        <slot name="left-panel"></slot>
      </div>

      <!-- 中列 -->
      <div
        class="visualize-fluid-type flex min-w-0 flex-col gap-2 no-scrollbar lg:h-full lg:min-h-0 lg:flex-[3_1_0%] lg:overflow-y-auto"
      >
        <div
          class="contents lg:flex lg:min-h-0 lg:flex-none lg:flex-col lg:gap-2 lg:h-[calc(100%_-_3.5rem)]"
        >
          <slot name="viz"></slot>
        </div>
        <!-- Compare uses its natural height. Collapsed it is a 2.5rem rail;
             expanded content extends the middle column's scroll area without
             resizing the viewport-sized visualization section above it. -->
        <div class="contents lg:block lg:shrink-0">
          <slot name="compare"></slot>
        </div>
      </div>
      <!-- 右列：桌面下是弹性列（1 份）、封顶 340px，内部字号/图标用 em 等比缩放 -->
      <div
        class="visualize-fluid-type w-full scrollbar-thin lg:min-w-0 lg:flex-[1_1_0%] lg:max-w-[340px] lg:min-h-0 lg:overflow-y-auto"
      >
        <slot name="side-panel"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 可视化区流体字号基准（仅 ≥lg 桌面三列布局生效，断点值同 Tailwind lg = 64rem）。
   三个列容器提供基准，容器内部不覆盖任何原生档位，一律显式写 text-[nem] 相对比例
   （em 相对继承字号解析）。小屏无基准 -> 继承根 16px，text-[0.875em] 等恰好等于
   原生档位值，渲染不变；桌面继承基准 -> 随窗口等比缩放。
   锚点：≥1920px 恰为 16px（max 封顶不再放大），窗口变小线性收缩：
   1440px ≈ 15.3px、1024px ≈ 14.6px（min 0.4rem 之上由 vw 项决定）。 */
.visualize-fluid-type {
  font-size: clamp(0.8125rem, 0.65rem + 0.25vw, 1.25rem);
}

/* 给本页原本透明的 ghost 按钮补一道自适应细边框，使其与 New/Confirm 等实心按钮
   一样具备清晰轮廓（亮色模式深边、暗色模式浅边）。DaisyUI 的 .btn-ghost 只是把
   --btn-border 设成 #0000，边框本身一直在；真正读取它的只有 .btn 里的
   border-color: var(--btn-border)，所以这里覆盖 border-color 一次即可覆盖全部
   状态（hover / focus-visible / active）。已有边框的 outline / filled 按钮、
   带动态彩色边框的 UMAP/KMeans 开关不受影响。
   按钮分布在 AnnotationPanel / OverlayControls 等子组件中，需要 :deep() 才能
   跨过 scoped 样式的组件边界。 */
.result-page :deep(.btn-ghost) {
  border-color: color-mix(in oklch, var(--color-base-content) 25%, transparent);
}
</style>
