import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // envDir 指向 env/ 目录，集中管理多环境 .env 文件
  const envDir = fileURLToPath(new URL('./env', import.meta.url))
  const env = loadEnv(mode, envDir, 'VITE_')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000'

  return {
    envDir: envDir,
    envPrefix: 'VITE_',
    plugins: [
      vue(),
      vueJsx(),
      vueDevTools(),
      tailwindcss(),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      // 单 chunk 警告阈值提到 1500KB（echarts/ali-oss 这类大库会超）
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // 手动分组 chunk，避免 Rollup 把跨路由共享模块拆成几十个微型 chunk。
          // src/shared/** 合并为一个 chunk，但排除 config/：其含运行时状态 _config，
          // 须与入口同 chunk 保证 loadConfig 求值时序（提前求值会抛错白屏）。
          // 重型库（echarts/ali-oss/zip）独立懒加载；其余业务代码按路由默认分包。
          manualChunks(id) {
            // src/shared 目录合并为一个 chunk（排除 config）
            if (
              id.includes('/src/shared/') &&
              !id.includes('/src/shared/config/')
            ) {
              return 'shared'
            }

            if (id.includes('node_modules')) {
              // Vue 运行时 + 路由 + Pinia：每页都用，尽早加载
              if (
                id.includes('node_modules/vue/') ||
                id.includes('node_modules/@vue/') ||
                id.includes('node_modules/vue-router/') ||
                id.includes('node_modules/pinia/') ||
                id.includes('plugin-vue/export-helper')
              ) {
                return 'vendor-vue'
              }
              // 重型库：仅特定路由用到，保持独立懒加载 chunk
              if (id.includes('node_modules/echarts/') || id.includes('node_modules/zrender/')) return 'vendor-echarts'
              if (id.includes('node_modules/ali-oss/')) return 'vendor-oss'
              if (id.includes('node_modules/@zip.js/')) return 'vendor-zip'
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
