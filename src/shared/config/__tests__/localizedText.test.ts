import { afterEach, describe, expect, it } from 'vitest'
import { localized } from '../localizedText'
import { i18n } from '@/i18n'

afterEach(() => {
  i18n.global.locale.value = 'en'
})

describe('localized', () => {
  it('纯字符串视为所有语言通用（兼容尚未加 zh 的旧 config.json）', () => {
    expect(localized('Home')).toBe('Home')
  })

  it('命中当前语言', () => {
    i18n.global.locale.value = 'zh-CN'

    expect(localized({ en: 'Home', 'zh-CN': '首页' })).toBe('首页')
  })

  it('当前语言缺译文时回退 en', () => {
    i18n.global.locale.value = 'zh-CN'

    expect(localized({ en: 'Home' })).toBe('Home')
  })

  it('只配了非英语时，英文用户也能看到内容而不是一块空白', () => {
    expect(localized({ 'zh-CN': '首页' })).toBe('首页')
  })

  it.each([[undefined], [null], [{}], ['']])('空值一律返回空串：%s', (value) => {
    expect(localized(value)).toBe('')
  })
})
