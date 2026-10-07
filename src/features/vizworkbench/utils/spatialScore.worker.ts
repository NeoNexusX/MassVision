/**
 * Tier-2 空间度量的 Web Worker：p99 热点裁剪 + chaos/spatial/spectral/MSM
 * + 多加合物组内 Pearson 全部在此计算。
 *
 * 动机：这些度量是 O(像素 × 层数) 的逐像素工作（500×500 图像一次
 * ~15M 次访存 + 排序），Top-K（默认 200 行）连续跑时主线程每次阻塞
 * 几十毫秒，正好卡在用户滚动/悬停注释表的时机。纯函数全部复用
 * {@link ./spatialScore}；图像缓冲以**拷贝**转入（transfer 的是副本，
 * 不掏空主线程的图像 LRU 缓存——同 useAnnotationMatch 的约定）。
 *
 * 协议（请求带 reqId，响应原样回带）：
 * - { type:'row',   reqId, images[], width, height, theory[] }
 *     → { type:'row', reqId, chaos, spatial, spectral, msm }
 * - { type:'group', reqId, ids[], images[] }
 *     → { type:'group', reqId, ids, corrs[], matrix[][] }（corrs = 每成员
 *       与组内其他成员的最大 Pearson；matrix = 完整成对矩阵，供主线程按
 *       连通分量重验成组条件——对齐参考 _confirm_groups_from_correlations）
 * - 计算抛错 → { type:'error', reqId, message }
 */

import {
  hotspotClip,
  isotopeImageCorrelation,
  isotopePatternMatch,
  measureOfChaos,
  pearsonCorrelation,
} from './spatialScore'

/** 参考实现的 level-sets 层数（METASPACE/pySM 默认 10） */
const CHAOS_LEVELS = 10

export interface SpatialRowRequest {
  type: 'row'
  /** 行 id（响应回带） */
  id: number
  /** 同位素包络各峰的原始图像（[0] = M；-1 峰为全零数组） */
  images: Float32Array[]
  width: number
  height: number
  /** 理论相对强度（与 images 等长） */
  theory: number[]
}

export interface SpatialGroupRequest {
  type: 'group'
  /** 组内各成员行 id（响应回带） */
  ids: number[]
  /** 各成员行的 M 峰原始图像 */
  images: Float32Array[]
}

export type SpatialWorkerRequest = SpatialRowRequest | SpatialGroupRequest

export type SpatialWorkerResponse =
  | {
      type: 'row'
      reqId: number
      chaos: number | null
      spatial: number | null
      spectral: number | null
      msm: number | null
    }
  | {
      type: 'group'
      reqId: number
      ids: number[]
      corrs: (number | null)[]
      matrix: (number | null)[][]
    }
  | { type: 'error'; reqId: number; message: string }

type ReqWithId = SpatialWorkerRequest & { reqId: number }

const post = (msg: SpatialWorkerResponse): void => {
  ;(self as unknown as Worker).postMessage(msg)
}

self.onmessage = (e: MessageEvent<ReqWithId>) => {
  const msg = e.data
  try {
    if (msg.type === 'row') {
      const images = msg.images.map((img) => hotspotClip(img, 99))
      // 参考守卫：得分恰为 1 → 0；单峰分子公式 spatial = 1（pySM 管线语义）
      let chaos: number | null = msg.width
        ? measureOfChaos(images[0]!, msg.width, msg.height, CHAOS_LEVELS)
        : null
      if (chaos === 1) chaos = 0
      const spatial =
        msg.theory.length < 2 ? 1 : isotopeImageCorrelation(images, msg.theory.slice(1))
      const spectral = isotopePatternMatch(images, msg.theory)
      // pySM 结果表的 fillna(0) 语义：不适用分量按 0 参与乘积
      const msm = (chaos ?? 0) * (spatial ?? 0) * (spectral ?? 0)
      post({ type: 'row', reqId: msg.reqId, chaos, spatial, spectral, msm })
      return
    }
    // group：组内各成员 M 图像两两 Pearson——完整矩阵（供主线程按连通
    // 分量重验成组条件）+ 每成员最大值（adductCorr 展示口径）
    const images = msg.images.map((img) => hotspotClip(img, 99))
    const n = images.length
    const corrs: (number | null)[] = []
    const matrix: (number | null)[][] = []
    for (let i = 0; i < n; i++) {
      let best: number | null = null
      const row: (number | null)[] = []
      for (let j = 0; j < n; j++) {
        const r = i === j ? null : pearsonCorrelation(images[i]!, images[j]!)
        row.push(r)
        if (r != null && (best == null || r > best)) best = r
      }
      matrix.push(row)
      corrs.push(best)
    }
    post({ type: 'group', reqId: msg.reqId, ids: msg.ids, corrs, matrix })
  } catch (err) {
    post({
      type: 'error',
      reqId: msg.reqId,
      message: (err as Error)?.message || 'spatial worker error',
    })
  }
}
