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

describe('zarr tuning config', () => {
  it('falls back to built-in defaults when the block is missing', async () => {
    mockConfig({ appName: 'Test' })

    await loadConfig()

    expect(getConfig().zarr).toEqual({
      spectraChunkCacheSize: 100,
      spectraConcurrency: 16,
    })
  })

  it('preserves valid explicit values', async () => {
    mockConfig({
      appName: 'Test',
      zarr: { spectraChunkCacheSize: 40, spectraConcurrency: 32 },
    })

    await loadConfig()

    expect(getConfig().zarr).toEqual({
      spectraChunkCacheSize: 40,
      spectraConcurrency: 32,
    })
  })

  it('rejects out-of-range or non-integer values', async () => {
    mockConfig({
      appName: 'Test',
      zarr: { spectraChunkCacheSize: 0, spectraConcurrency: 1.5 },
    })

    await loadConfig()

    expect(getConfig().zarr).toEqual({
      spectraChunkCacheSize: 100,
      spectraConcurrency: 16,
    })
  })
})
