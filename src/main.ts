import './style.css'
// import './assets/main.css'
import './shared/icons/offlineRegistry'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import SvgIcon from './shared/components/SvgIcon.vue'
import { vReveal } from './shared/directives/reveal'
import { loadConfig } from './shared/config/runtimeConfig'
import { initTheme } from './shared/composables/useTheme'

// Apply theme before mounting to avoid a flash of the wrong theme (FOUC).
initTheme()

/**
 * 启动顺序很关键：必须先 await loadConfig() 拉到 config.json，再动态导入 App 与 router。
 * 这样整棵组件树（含模块顶层通过 getConfig() 读取配置的常量）都在配置就位后才求值，
 * 下游模块无需关心加载时序。
 */
async function bootstrap() {
  const config = await loadConfig()

  // 标题取自运行时 config.json 的 appName（index.html 里的静态标题仅作 JS 执行前兜底）
  document.title = config.appName

  const [{ default: App }, { default: router }] = await Promise.all([
    import('./app/App.vue'),
    import('./router'),
  ])

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  // Register SvgIcon globally so templates can use <SvgIcon /> without local import
  app.component('SvgIcon', SvgIcon)

  // Register v-reveal so templates can use scroll-reveal entrance animation
  app.directive('reveal', vReveal)

  app.mount('#app')
}

bootstrap().catch((err) => {
  console.error('Failed to start app: could not load config.json', err)
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML =
      '<div style="font-family:sans-serif;padding:2rem;color:#b00">应用启动失败：无法加载 config.json，请检查该文件是否存在且为合法 JSON。</div>'
  }
})
