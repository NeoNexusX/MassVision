import { afterEach, describe, expect, it, vi } from 'vitest'
import { getConfig, loadConfig } from '../runtimeConfig'

function mockConfig(config: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => config,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('result feature config', () => {
  it('enables result features when an older config omits the flags', async () => {
    mockConfig({ appName: 'Test' })

    await loadConfig()

    expect(getConfig().resultFeatures).toEqual({
      compare: true,
      annotation: true,
    })
  })

  it('preserves explicitly disabled result features', async () => {
    mockConfig({
      appName: 'Test',
      resultFeatures: { compare: false, annotation: false },
    })

    await loadConfig()

    expect(getConfig().resultFeatures).toEqual({
      compare: false,
      annotation: false,
    })
  })
})
