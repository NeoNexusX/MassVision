import { afterEach, describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatNumber, formatTime } from '../format'
import { i18n } from '@/i18n'

const SAMPLE = new Date('2026-09-14T12:34:56Z')

afterEach(() => {
  i18n.global.locale.value = 'en'
})

describe('日期 / 数字格式化跟随界面语言', () => {
  /**
   * 不断言具体的输出字符串——那取决于运行环境的 ICU 数据，换台机器就可能红。
   * 这里断言的是「传给 toLocale* 的是界面语言」这件事本身：改造前这些调用点不传参数，
   * 跟的是浏览器语言，在英文机器上跑这个用例就会失败。
   */
  it.each(['en', 'zh-CN'] as const)('formatDate 用 %s 排版', (locale) => {
    i18n.global.locale.value = locale

    expect(formatDate(SAMPLE)).toBe(SAMPLE.toLocaleDateString(locale))
  })

  it.each(['en', 'zh-CN'] as const)('formatDateTime 用 %s 排版', (locale) => {
    i18n.global.locale.value = locale

    expect(formatDateTime(SAMPLE)).toBe(SAMPLE.toLocaleString(locale))
  })

  it.each(['en', 'zh-CN'] as const)('formatTime 用 %s 排版', (locale) => {
    i18n.global.locale.value = locale

    expect(formatTime(SAMPLE)).toBe(SAMPLE.toLocaleTimeString(locale))
  })

  it.each(['en', 'zh-CN'] as const)('formatNumber 用 %s 排版', (locale) => {
    i18n.global.locale.value = locale

    expect(formatNumber(1234567)).toBe((1234567).toLocaleString(locale))
  })

  it('接受字符串与时间戳，与 Date 结果一致', () => {
    expect(formatDate(SAMPLE.toISOString())).toBe(formatDate(SAMPLE))
    expect(formatDate(SAMPLE.getTime())).toBe(formatDate(SAMPLE))
  })
})

describe('空值与非法值', () => {
  it.each([[undefined], [null], ['']])('日期为 %s 时返回空串', (value) => {
    expect(formatDate(value)).toBe('')
    expect(formatDateTime(value)).toBe('')
    expect(formatTime(value)).toBe('')
  })

  it('无法解析的日期返回空串而不是 Invalid Date', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('数字为空时按 0 处理（与改造前的 (n ?? 0) 行为一致）', () => {
    expect(formatNumber(undefined)).toBe('0')
    expect(formatNumber(null)).toBe('0')
  })
})
