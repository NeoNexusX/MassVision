import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginPlaywright from 'eslint-plugin-playwright'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    'docs/.vitepress/cache/**',
    'docs/.vitepress/dist/**',
    'dist-docs/**',
  ]),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
    rules: {
      ...pluginVitest.configs.recommended.rules,
      // 断言封装在辅助函数里（如 expectRoundTrip）时，规则默认只认 expect，
      // 需显式把这类函数名加入白名单，否则会误报 "Test has no assertions"。
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
    },
  },
  
  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    name: 'app/architecture-boundaries',
    files: ['src/**/*.{ts,mts,tsx,vue}'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/*',
                '@/components/**',
                '@/composables/*',
                '@/composables/**',
                '@/utils/*',
                '@/utils/**',
                '@/stores/*',
                '@/stores/**',
                '@/types/*',
                '@/types/**',
                '@/constants/*',
                '@/constants/**',
              ],
              message:
                'Root-level frontend folders are deprecated. Import from @/shared/* or the owning @/features/* module instead.',
            },
          ],
        },
      ],
      'vue/block-lang': 'warn',
      'vue/multi-word-component-names': 'warn',
      'vue/no-mutating-props': 'warn',
    },
  },
  skipFormatting,
)
