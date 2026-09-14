import { i18n } from '@/i18n'

/**
 * 日期 / 数字的本地化格式化。
 *
 * 站内原先散落着十几处裸 `toLocaleDateString()` / `toLocaleString()`，它们不传 locale，
 * 跟的是**浏览器语言**而不是界面语言——切成中文后会出现「界面中文、日期英文」的割裂。
 * 统一收口到这里，显式传当前界面语言。
 *
 * 只负责「按哪国习惯排版」，不负责解析：后端那种不带时区后缀的 UTC 时间戳仍需先过
 * shared/utils/date.ts 的 parseUtcDate()，否则会差 8 小时。
 *
 * 空值一律返回空串（与改造前各调用点的 `?? ''` 行为一致），不返回占位符——
 * 是否显示「—」由各自的模板决定。
 */
function currentLocale(): string {
  return i18n.global.locale.value
}

/** 日期：en → 9/14/2026，zh-CN → 2026/9/14 */
export function formatDate(value?: Date | string | number | null): string {
  if (value == null || value === '') return ''
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(currentLocale())
}

/** 日期 + 时间 */
export function formatDateTime(value?: Date | string | number | null): string {
  if (value == null || value === '') return ''
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(currentLocale())
}

/** 仅时间 */
export function formatTime(value?: Date | string | number | null): string {
  if (value == null || value === '') return ''
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(currentLocale())
}

/** 数字千分位。en 与 zh-CN 的分组写法相同，收口是为了将来加语言时不必再找一遍调用点。 */
export function formatNumber(value?: number | null): string {
  return (value ?? 0).toLocaleString(currentLocale())
}

export function formatBytes(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}
