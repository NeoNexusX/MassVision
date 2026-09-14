import { afterEach, describe, expect, it } from 'vitest'
import { i18n, loadCoreMessages, loadFeatureMessages } from '../index'

afterEach(() => {
  i18n.global.locale.value = 'en'
})

describe('消息加载', () => {
  it('加载核心消息后 common 命名空间可用', async () => {
    await loadCoreMessages('zh-CN')
    i18n.global.locale.value = 'zh-CN'

    expect(i18n.global.t('common.action.save')).toBe('保存')
  })

  it('非英文语言会顺带预热 en，保证缺译文时能回退到英文而不是空串', async () => {
    await loadCoreMessages('zh-CN')

    expect(i18n.global.getLocaleMessage('en')).toHaveProperty('common')
  })

  it('语言包尚不存在的命名空间静默跳过，不抛错', async () => {
    // vizworkbench 的语言包要到 P3 才建；在那之前路由照样要能正常 resolve
    await expect(loadFeatureMessages('vizworkbench')).resolves.toBeUndefined()
  })
})
