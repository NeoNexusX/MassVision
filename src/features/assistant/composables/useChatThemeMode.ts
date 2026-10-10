/**
 * TDesign 聊天视图的根 DOM 主题副作用。
 *
 * TDesign 的暗色变量挂在 `html[theme-mode]` 上。此前视图组件直接
 * setAttribute / 卸载时无条件 removeAttribute；一旦未来站点其他地方也
 * 用 TDesign（或组件并发挂载），先卸载的会把后者脚下的主题抽掉。
 * 按引用计数管理：首个持有者写入，最后一个释放才移除，亮暗切换由唯一入口同步。
 */
import { watch, onUnmounted } from 'vue'
import { useTheme } from '@/shared/composables/useTheme'

/** 当前挂载中的持有者数量 */
let holders = 0

function apply(dark: boolean) {
  document.documentElement.setAttribute('theme-mode', dark ? 'dark' : 'light')
}

export function useChatThemeMode() {
  const { isDark } = useTheme()

  holders += 1
  apply(isDark.value)

  watch(isDark, (dark) => apply(dark))

  onUnmounted(() => {
    holders -= 1
    if (holders <= 0) document.documentElement.removeAttribute('theme-mode')
  })
}
