import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite';

/**
 * 构建期预压缩：为产物额外写出 .gz / .br，配合 nginx 的 gzip_static / brotli_static。
 *
 * 预压缩比 nginx 运行时压缩好在两点：能用上最高压缩等级（运行时用 level 11 太费 CPU），
 * 且每个请求省掉一次压缩计算。实测本项目最大的 index CSS：
 * nginx 默认 gzip level 1 = 40.3KB，level 6 = 32.0KB，预压缩 gzip -9 = 31.7KB，brotli q11 = 25.7KB。
 *
 * 只处理 bundle 产物（带 hash 的 assets + index.html），**不碰 public/ 拷贝过来的文件**。
 * 这是有意为之：config.json / content.json 允许运维在服务器上直接改，若存在一份陈旧的
 * .gz，开了 gzip_static 的 nginx 会优先返回那份压缩件，改动就再也不生效了。
 */
function precompressAssets(): Plugin {
  const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|txt|map)$/
  // 小文件压缩后常常更大，且 nginx 也有 gzip_min_length 下限，一并跳过
  const MIN_BYTES = 1024

  return {
    name: 'precompress-assets',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir
      if (!outDir) return
      for (const fileName of Object.keys(bundle)) {
        if (!COMPRESSIBLE.test(fileName)) continue
        const full = path.join(outDir, fileName)
        let buf: Buffer
        try {
          buf = readFileSync(full)
        } catch {
          continue
        }
        if (buf.length < MIN_BYTES) continue
        writeFileSync(`${full}.gz`, zlib.gzipSync(buf, { level: 9 }))
        writeFileSync(
          `${full}.br`,
          zlib.brotliCompressSync(buf, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
            },
          }),
        )
      }
    },
  }
}

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
      vueDevTools(),
      tailwindcss(),
      precompressAssets(),
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
    // ESM workers: csvAnnotation.worker uses `new Worker(url, { type: 'module' })`.
    // Without this Vite defaults to iife workers, which fail to load an ESM
    // entry and silently fall back to the main-thread sync path.
    worker: {
      format: 'es',
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
