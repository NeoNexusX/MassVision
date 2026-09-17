import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ossDownloadRawMock,
  showToastMock,
  removeToastMock,
  extractBackendErrorMock,
  downloadStore,
} = vi.hoisted(() => ({
  ossDownloadRawMock: vi.fn(),
  showToastMock: vi.fn(() => 7),
  removeToastMock: vi.fn(),
  extractBackendErrorMock: vi.fn(() => 'backend error'),
  downloadStore: {
    downloading: false,
    canDownload: vi.fn(() => true),
    cooldownRemaining: vi.fn(() => 0),
    startDownload: vi.fn(),
    completeDownload: vi.fn(),
    failDownload: vi.fn(),
  },
}))

vi.mock('@/features/datasets/utils/downloadHelper', () => ({
  ossDownloadRaw: ossDownloadRawMock,
}))

vi.mock('@/features/datasets/stores/downloadStore', () => ({
  useDownloadStore: () => downloadStore,
}))

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock, removeToast: removeToastMock }),
}))

vi.mock('@/shared/api/httpClient', () => ({
  extractBackendError: extractBackendErrorMock,
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

import { useDownloadProgress } from '../useDownloadProgress'

describe('useDownloadProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    downloadStore.downloading = false
    downloadStore.canDownload.mockReturnValue(true)
  })

  it('shows the localized download-limit message for a 403 response', async () => {
    ossDownloadRawMock.mockRejectedValueOnce({
      response: { status: 403, data: { detail: 'user download limit reached' } },
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { handleDownloadRaw, packingIds } = useDownloadProgress()

    await handleDownloadRaw('403-file')

    expect(downloadStore.failDownload).toHaveBeenCalledOnce()
    expect(removeToastMock).toHaveBeenCalledWith(7)
    expect(showToastMock).toHaveBeenLastCalledWith('datasets.download.limitReached', 'error')
    expect(extractBackendErrorMock).not.toHaveBeenCalled()
    expect(packingIds.has('403-file')).toBe(false)
    consoleError.mockRestore()
  })
})
