/**
 * 运行时配置里的可本地化文本。
 *
 * config.json 与 content.json 的核心价值是「部署后直接改服务器上的文件、刷新即生效、
 * 无需重新构建」（见 runtimeConfig.ts 与 contentConfig.ts 的文件头）。把导航文案、
 * Hero 标语搬进 src/i18n/locales/ 会直接废掉这个性质——那些是编译进包的。
 *
 * 所以这类文案改为**在 JSON 里内联多语言值**，由本文件的 localized() 在读取时解析：
 *
 *   "label": "Home"                              // 旧写法，继续有效（视为所有语言通用）
 *   "label": { "en": "Home", "zh-CN": "首页" }    // 新写法，可逐项增量补充
 *
 * 向后兼容是有意的：运维不必一次性把整份 config.json 改完，可以一项一项加 zh-CN。
 *
 * ⚠️ 这是普通字符串解析，**不经过 vue-i18n 的消息编译器**，因此不支持 {name} 插值、
 * 复数等语法，也不受 vite.config.ts 里 runtimeOnly 的影响。需要插值的文案说明它不属于
 * 「运维可编辑的配置」，应该放进 src/i18n/locales/ 走 t()。
 *
 * ⚠️ 消费端必须写在 computed 里，例如 `computed(() => localized(item.label))`。
 * 直接在模块顶层求值会把语言固化在首次求值的那一刻，切语言后不再更新。
 *
 * ⚠️ 不要把这个函数命名成 tc —— 那是 vue-i18n 遗留的复数 API 名字，
 * @intlify/eslint-plugin-vue-i18n 会把每一次调用都当成翻译调用来校验 key 而全部误报。
 *
 * 刻意不从 `@/shared/config` 桶文件导出：那样会让所有 `import { ENV } from '@/shared/config'`
 * 的模块（含 worker）连带拉进整个 vue-i18n 实例。按需直接导入本文件即可。
 */
import { i18n } from '@/i18n'
import type { Locale } from '@/i18n'

/** 运行时配置里的可本地化文本：纯字符串（所有语言通用）或按语言分写的映射 */
export type LocalizedText = string | Partial<Record<Locale, string>>

/**
 * 解析可本地化配置值。
 * 回退链：当前语言 → en → 映射里第一个非空值 → 空串。
 *
 * 最后两级兜底是为了「配了但没配全」的现实情况：只写了 zh-CN 的项，英文用户
 * 至少还能看到中文，好过界面上出现一块空白。
 */
export function localized(value: LocalizedText | undefined | null): string {
  if (value == null) return ''
  if (typeof value === 'string') return value

  const current = i18n.global.locale.value
  return value[current] ?? value.en ?? Object.values(value).find(Boolean) ?? ''
}
