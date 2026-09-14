import { afterEach, describe, expect, it } from 'vitest'
import { detectLocale, setLocale } from '../useLocale'
import { STORAGE_KEYS } from '@/shared/config'
import { i18n } from '@/i18n'

/**
 * jsdom 的 navigator.languages 是原型上的 getter，直接赋值无效。
 * 在实例上定义同名属性把它遮住，afterEach 再删掉恢复原型行为。
 */
function stubLanguages(...tags: string[]) {
  Object.defineProperty(window.navigator, 'languages', { value: tags, configurable: true })
  Object.defineProperty(window.navigator, 'language', { value: tags[0] ?? '', configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'languages')
  Reflect.deleteProperty(window.navigator, 'language')
  localStorage.clear()
  i18n.global.locale.value = 'en'
})

describe('detectLocale', () => {
  it('用户显式保存过的偏好优先于浏览器语言', () => {
    localStorage.setItem(STORAGE_KEYS.locale, 'en')
    stubLanguages('zh-CN')

    expect(detectLocale()).toBe('en')
  })

  it('忽略非法的已保存值，回退到浏览器语言探测', () => {
    localStorage.setItem(STORAGE_KEYS.locale, 'fr-FR')
    stubLanguages('zh-CN')

    expect(detectLocale()).toBe('zh-CN')
  })

  it.each(['zh', 'zh-CN', 'zh-TW', 'zh-Hant-HK', 'ZH-cn'])(
    '中文浏览器（含繁体与地区变体）一律归简体中文：%s',
    (tag) => {
      stubLanguages(tag)

      expect(detectLocale()).toBe('zh-CN')
    },
  )

  it('英文浏览器用英文', () => {
    stubLanguages('en-GB')

    expect(detectLocale()).toBe('en')
  })

  it('既非中文也非英文的语言回退英文', () => {
    stubLanguages('ja-JP', 'de-DE')

    expect(detectLocale()).toBe('en')
  })

  it('按 languages 的优先级取第一门认识的语言', () => {
    stubLanguages('ja-JP', 'zh-CN', 'en-US')

    expect(detectLocale()).toBe('zh-CN')
  })

  it('浏览器什么都没给时兜底英文', () => {
    stubLanguages()

    expect(detectLocale()).toBe('en')
  })
})

describe('setLocale', () => {
  it('切换后写入偏好并同步 <html lang>', async () => {
    await setLocale('zh-CN')

    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBe('zh-CN')
    expect(document.documentElement.getAttribute('lang')).toBe('zh-CN')
  })

  it('切到当前语言时不重复写入', async () => {
    await setLocale('en')

    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBeNull()
  })
})
