/**
 * 谱库索引 worker：massbank-index.json（~33MB / 87k 条）的下载 + JSON.parse
 * + 检索全部在本 worker 内完成——主线程只收最终格式化文本，流式聊天中
 * 调用 spectral_library_search 不再冻结 UI（JSON.parse 33MB 在主线程是
 * 0.1–2s 的整段阻塞），解析后的索引对象也常驻 worker 堆、不挤占主线程的
 * zarr/注释缓存。检索逻辑与主线程兜底共用 spectralIndexCore（同一份代码）。
 */

import {
  searchSpectralIndex,
  spectralIndexNotFound,
  type SpectralLibEntry,
} from './spectralIndexCore'

interface SpectralSearchRequest {
  type: 'search'
  reqId: number
  precursorMz: number
  ppm: number
  polarity: 'positive' | 'negative' | null
  peaks: { mz: number; intensity: number }[]
  max: number
}

let indexPromise: Promise<SpectralLibEntry[]> | null = null

/** 单例加载（失败重置：下次消息可重试；成功后 SPA 生命周期内复用） */
function loadIndex(): Promise<SpectralLibEntry[]> {
  indexPromise ??= fetch(`${import.meta.env.BASE_URL}data/massbank-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(spectralIndexNotFound(r.status))
      return r.json() as Promise<SpectralLibEntry[]>
    })
    .catch((err: unknown) => {
      indexPromise = null
      throw err
    })
  return indexPromise
}

self.onmessage = async (e: MessageEvent<SpectralSearchRequest>) => {
  const msg = e.data
  if (msg?.type !== 'search') return
  try {
    const index = await loadIndex()
    const text = searchSpectralIndex(
      index,
      msg.precursorMz,
      msg.ppm,
      msg.polarity,
      msg.peaks ?? [],
      msg.max ?? 10,
    )
    self.postMessage({ type: 'result', reqId: msg.reqId, text })
  } catch (err) {
    self.postMessage({
      type: 'error',
      reqId: msg.reqId,
      message: (err as Error)?.message || 'spectral index worker failed',
    })
  }
}
