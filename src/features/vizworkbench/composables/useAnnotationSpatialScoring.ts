/**
 * Tier-2 空间证据的渐进打分——pySM（Palmer et al., Nat Methods 2017）参考
 * 管线的浏览器端复刻。
 *
 * 对 Top-K（默认 200，按 compositeScore 降序）匹配行：取理论同位素包络
 * （top-4 峰）各峰的离子图像 → p99 热点裁剪 → 三个参考度量 →
 * **MSM = chaos × spatial × spectral**：
 *
 *  - ρ_chaos   level-sets 空间混沌度（{@link ../utils/spatialScore.measureOfChaos}）；
 *               参考管线的守卫"得分恰为 1 → 0"在此应用
 *  - ρ_spatial  M 图像与各卫星同位素图像的加权 Pearson（理论强度权重）；
 *               单峰分子公式 → 1（pySM 管线语义）
 *  - ρ_spectral 图像强度模式 vs 理论包络（L2 归一 L1 距离；==1 → 0）
 *
 * 期望位置无采样点的卫星峰按**全零图像**参与（参考语义：ppm 窗口内无数据
 * 的图像即为零，压低 spatial 与 spectral）。
 *
 * 工程结构与参考实现的差异（有意为之）：图像按需渐进取回（zarr，每峰
 * 1–2 chunk）而非全量计算；度量计算在 Web Worker（utils/spatialScore.worker.ts）
 * 里跑——Top-K 连续打分是 O(像素×层数) 的逐像素工作，主线程跑会卡住
 * 滚动/悬停；结果放 `spatialByRowId`（每次 flush 换新 Map）。
 * 例外：多加合物组的空间反证（组内 Pearson < 0.7）经
 * annotationScoring.applyAdductGroupConfirmation **回馈** Tier-1——撤销该组的
 * composite 加成并刷新行数组身份（参考实现 min_spatial_correlation 门控
 * 的两层近似；pySM 的 MSM 排序所有权仍归 worker，未撤销的行不受影响）。
 */

import {
  computed,
  onUnmounted,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from 'vue'
import {
  mzAxisRef,
  dataModeRef,
  loadIonMatrixByIndex,
  getSharedZarrContext,
} from '@/features/vizworkbench/composables/useZarrIonImage'
import {
  measureOfChaos,
  isotopePatternMatch,
  isotopeImageCorrelation,
  hotspotClip,
  pearsonCorrelation,
  type SpatialScore,
} from '@/features/vizworkbench/utils/spatialScore'
import type {
  SpatialWorkerRequest,
  SpatialWorkerResponse,
} from '@/features/vizworkbench/utils/spatialScore.worker'
import {
  findClosestIndex,
  type MatchedAnnotationRow,
  type ToleranceMode,
} from '@/features/vizworkbench/utils/csvAnnotation'
import { applyAdductGroupConfirmation } from '@/features/vizworkbench/utils/annotationScoring'
import { isotopeEnvelope, chargeFromIonType } from '@/features/vizworkbench/utils/isotope'

/** 参考实现的 level-sets 层数（METASPACE/pySM 默认 10） */
const CHAOS_LEVELS = 10

/** 图像 LRU 的字节预算：缓存的是全分辨率 Float32Array 离子图（4 B/px），
 *  高分辨率数据集（2048² = 16MB/张）若只按条数封顶会驻留数百 MB——预算
 *  为主、条数（cacheCap）为辅。 */
const IMAGE_CACHE_BYTES = 128 * 1024 * 1024

export interface UseAnnotationSpatialScoring {
  /** row id → 空间分（每次 flush 换新 Map 身份） */
  spatialByRowId: ShallowRef<Map<number, SpatialScore>>
  /** 是否还有行在排队/在途 */
  spatialPending: Ref<boolean>
  spatialProgress: ComputedRef<{ done: number; total: number }>
  /** 把若干行提到高优先级道（悬停/可见窗口） */
  bumpPriority: (ids: number[]) => void
}

export function useAnnotationSpatialScoring(
  matchedRows: ShallowRef<MatchedAnnotationRow[]>,
  opts: {
    /** 容差单位与数值（面板的 tolMode/tolValue ref，随 rematch 变化） */
    tolMode: Ref<ToleranceMode>
    tolValue: Ref<number>
    /** 打分的行数上限；具体规模待用户确认后可调默认 */
    topK?: number
    concurrency?: number
    cacheCap?: number
  },
): UseAnnotationSpatialScoring {
  const topK = opts.topK ?? 200
  const concurrency = opts.concurrency ?? 3
  const cacheCap = opts.cacheCap ?? 40

  const spatialByRowId = shallowRef<Map<number, SpatialScore>>(new Map())
  const doneCount = shallowRef(0)
  const queuedTotal = shallowRef(0)
  const spatialPending = computed(() => queuedTotal.value > 0)
  const spatialProgress = computed(() => ({
    done: doneCount.value,
    total: queuedTotal.value,
  }))

  // ---- 队列状态 ----
  interface RowEntry {
    kind: 'row'
    rowId: number
    /** 同位素包络各峰的轴下标（[0] = M；-1 = 期望位置无采样点 → 零图像） */
    indices: number[]
    /** 对应理论相对强度（与 indices 等长） */
    theory: number[]
  }
  /** 多加合物组的空间确认任务：组内各成员行 M 图像两两 Pearson（对齐
   *  adduct_filter 的 min_spatial_correlation=0.7 门控），每成员取其最大
   *  相关（MST 支撑边的近似）。组成员全部进入 Top-K 才排队。 */
  interface GroupEntry {
    kind: 'group'
    rowIds: number[]
    /** 各成员行的 M 峰轴下标（与 rowIds 一一对应） */
    indices: number[]
    /** 成员行对象（与 rowIds 一一对应；反证撤销要改写其 Tier-1 字段） */
    rows: MatchedAnnotationRow[]
  }
  type Task = RowEntry | GroupEntry
  let highLane: Task[] = []
  let normalLane: Task[] = []
  let inFlight = 0
  let generation = 0
  let consecutiveErrors = 0
  let stopped = false
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let pendingFlush = new Map<number, SpatialScore>()

  // ---- 图像 LRU ----
  const imageCache = new Map<string, Float32Array>()
  let cacheBytes = 0
  let cacheAxis: Float64Array | null | undefined

  function tolDaOf(mz: number): number {
    return opts.tolMode.value === 'ppm'
      ? Math.abs(mz) * opts.tolValue.value * 1e-6
      : opts.tolValue.value
  }

  /** in-flight 去重：行任务与组任务（或两个行任务）并发请求同一 idx 时只发
   *  一次 zarr 加载——否则双载后第二张覆盖第一张而 cacheBytes 双计，预算
   *  被永久虚高、LRU 逐出一切，Tier-2 退化成每行重取 zarr chunk */
  const imagePending = new Map<string, Promise<Float32Array>>()

  function cacheImage(key: string, img: Float32Array): void {
    imageCache.set(key, img)
    cacheBytes += img.byteLength
    // 逐出：字节预算为主、条数为辅；至少保留刚插入的这一张（单张超预算
    // 也比每次都重新取回 zarr chunk 好）
    while (
      imageCache.size > 1 &&
      (cacheBytes > IMAGE_CACHE_BYTES || imageCache.size > cacheCap)
    ) {
      const oldest = imageCache.keys().next().value
      if (oldest === undefined) break
      const evicted = imageCache.get(oldest)
      imageCache.delete(oldest)
      cacheBytes -= evicted?.byteLength ?? 0
    }
  }

  async function cachedImage(idx: number, tolDa: number): Promise<Float32Array> {
    const key = `${idx}@${tolDa.toPrecision(4)}`
    const hit = imageCache.get(key)
    if (hit) {
      imageCache.delete(key)
      imageCache.set(key, hit) // LRU 触摸
      return hit
    }
    const pending = imagePending.get(key)
    if (pending) return pending
    const load = loadIonMatrixByIndex(idx, tolDa)
      .then((img) => {
        cacheImage(key, img)
        imagePending.delete(key)
        return img
      })
      .catch((err: unknown) => {
        imagePending.delete(key)
        throw err
      })
    imagePending.set(key, load)
    return load
  }

  // ---- flush（节流：8 行或 200ms）----
  function flushNow(): void {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (pendingFlush.size === 0) return
    const next = new Map(spatialByRowId.value)
    for (const [k, v] of pendingFlush) next.set(k, v)
    pendingFlush = new Map()
    spatialByRowId.value = next
  }

  function pushFlush(id: number, s: SpatialScore): void {
    pendingFlush.set(id, s)
    if (pendingFlush.size >= 8) flushNow()
    else if (!flushTimer) flushTimer = setTimeout(flushNow, 200)
  }

  /** 把局部字段（如 adductCorr）合并进该行已有/待冲刷的空间分。 */
  function pushFlushPartial(id: number, patch: Partial<SpatialScore>): void {
    const existing = pendingFlush.get(id) ?? spatialByRowId.value.get(id)
    pendingFlush.set(id, {
      chaos: null,
      spatial: null,
      spectral: null,
      msm: null,
      ...existing,
      ...patch,
    })
    if (pendingFlush.size >= 8) flushNow()
    else if (!flushTimer) flushTimer = setTimeout(flushNow, 200)
  }

  // ---- 度量计算：Web Worker 优先（主线程不卡），不可用时兜底 ----

  let scoreWorker: Worker | null = null
  /** worker 起不来（构造抛错 / 脚本加载失败）后闩锁置位，后续任务全部走
   *  主线程——不能每次都构造一个必死的 worker 重试（同 useAnnotationMatch） */
  let workerBroken = false
  let nextReqId = 0
  const inflight = new Map<
    number,
    { resolve: (r: SpatialWorkerResponse) => void; reject: (e: Error) => void }
  >()

  function ensureWorker(): Worker | null {
    if (workerBroken) return null
    if (scoreWorker) return scoreWorker
    try {
      scoreWorker = new Worker(new URL('../utils/spatialScore.worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      workerBroken = true
      return null
    }
    scoreWorker.onmessage = (e: MessageEvent<SpatialWorkerResponse>) => {
      const msg = e.data
      const p = inflight.get(msg.reqId)
      if (!p) return
      inflight.delete(msg.reqId)
      if (msg.type === 'error') p.reject(new Error(msg.message))
      else p.resolve(msg)
    }
    scoreWorker.onerror = (e) => {
      for (const [, p] of inflight) p.reject(new Error(e.message || 'spatial worker crashed'))
      inflight.clear()
      scoreWorker?.terminate()
      scoreWorker = null
      workerBroken = true
    }
    return scoreWorker
  }

  function postScoreTask(req: SpatialWorkerRequest): Promise<SpatialWorkerResponse> {
    const w = ensureWorker()
    if (!w) return Promise.reject(new Error('spatial worker unavailable'))
    const reqId = ++nextReqId
    return new Promise<SpatialWorkerResponse>((resolve, reject) => {
      inflight.set(reqId, { resolve, reject })
      // transfer 的是上面 fresh 出来的副本 buffer，LRU 里的原图不动
      w.postMessage({ ...req, reqId }, req.images.map((img) => img.buffer))
    })
  }

  /** 主线程兜底（worker 不可用）：与 worker 分支逐字段同语义 */
  function computeRowSync(
    raws: Float32Array[],
    dims: { width: number; height: number } | null,
    theory: number[],
  ): SpatialScore {
    const images = raws.map((img) => hotspotClip(img, 99))
    let chaos = dims ? measureOfChaos(images[0]!, dims.width, dims.height, CHAOS_LEVELS) : null
    if (chaos === 1) chaos = 0
    const spatial = theory.length < 2 ? 1 : isotopeImageCorrelation(images, theory.slice(1))
    const spectral = isotopePatternMatch(images, theory)
    return {
      chaos,
      spatial,
      spectral,
      msm: (chaos ?? 0) * (spatial ?? 0) * (spectral ?? 0),
    }
  }

  // ---- 工作循环 ----
  function pump(): void {
    if (stopped) return
    while (inFlight < concurrency) {
      const entry = highLane.shift() ?? normalLane.shift()
      if (!entry) break
      inFlight++
      void runEntry(entry, generation)
    }
    queuedTotal.value = doneCount.value + highLane.length + normalLane.length + inFlight
  }

  async function runEntry(task: Task, gen: number): Promise<void> {
    if (task.kind === 'group') {
      // 组确认任务必须同样走 try/finally：跳过 finally 会泄漏 inFlight 槽位
      //（并发 3 跑满 3 个组任务后整个队列永久卡死）。计数器只属于启动时的
      // 代：reset() 已把旧代的 inFlight/doneCount 清零，陈旧任务的收尾若再
      // 减会把计数推负——并发上限被永久抬高、进度 done>total。
      try {
        await runGroup(task, gen)
      } finally {
        if (gen === generation) {
          inFlight--
          doneCount.value++
          pump()
        }
      }
      return
    }
    const entry = task
    try {
      const dims = getSharedZarrContext().ionShape
      const axis = mzAxisRef.value
      const mTol = axis ? tolDaOf(axis[entry.indices[0]!] ?? 0) : opts.tolValue.value
      const raws: Float32Array[] = []
      for (const idx of entry.indices) {
        raws.push(
          idx >= 0
            ? await cachedImage(idx, mTol)
            : new Float32Array(dims ? dims.width * dims.height : 0),
        )
      }
      if (gen !== generation) return

      if (workerBroken) {
        pushFlush(
          entry.rowId,
          computeRowSync(
            raws,
            dims ? { width: dims.width, height: dims.height } : null,
            entry.theory,
          ),
        )
        consecutiveErrors = 0
        return
      }
      // 副本送 worker（transfer 副本 buffer，LRU 原图不动）；裁剪与三度量
      // 全在 worker 里跑，主线程只付一次 memcpy
      const copies = raws.map((img) => new Float32Array(img))
      const res = await postScoreTask({
        type: 'row',
        id: entry.rowId,
        images: copies,
        width: dims?.width ?? 0,
        height: dims?.height ?? 0,
        theory: entry.theory,
      })
      if (gen !== generation) return
      if (res.type !== 'row') return
      // pySM 结果表的 fillna(0) 语义（msm 在 worker 内按同式算好）
      pushFlush(entry.rowId, {
        chaos: res.chaos,
        spatial: res.spatial,
        spectral: res.spectral,
        msm: res.msm,
      })
      consecutiveErrors = 0
    } catch {
      if (gen !== generation) return
      pushFlush(entry.rowId, { chaos: null, spatial: null, spectral: null, msm: null, error: true })
      // 连续失败（网络/存储切换）→ 停止后台队列，避免无意义的重试风暴
      if (++consecutiveErrors >= 20) {
        stopped = true
        highLane = []
        normalLane = []
      }
    } finally {
      // 计数器只属于启动时的代（见函数头注释）；陈旧任务静默退场
      if (gen === generation) {
        inFlight--
        doneCount.value++
        pump()
      }
    }
  }

  /** Tier-2 反馈改写了行对象（撤销加分）后，替换数组身份让面板排序/渲染
   *  重新求值——行对象是 worker 克隆的普通对象，属性变更不会触发 shallowRef
   *  下游的 computed。本 composable 对 matchedRows 的 watch 以签名为键，
   *  同一批行的身份替换不会重建队列（纯 perm 早退）。 */
  function touchRows(): void {
    matchedRows.value = matchedRows.value.slice()
  }

  /** 多加合物组确认：组内各成员 M 图像两两 Pearson，每成员取最大值写入
   *  adductCorr，并回馈 Tier-1——Pearson < ADDUCT_CORR_MIN 的成员撤销其
   *  composite 加成（applyAdductGroupConfirmation，对齐参考 min_spatial_correlation
   *  门控）。失败（网络/存储）静默——adductCorr 保持缺失 = 未确认。 */
  async function runGroup(entry: GroupEntry, gen: number): Promise<void> {
    try {
      const axis = mzAxisRef.value
      const mTol = axis ? tolDaOf(axis[entry.indices[0]!] ?? 0) : opts.tolValue.value
      const raws = await Promise.all(entry.indices.map((idx) => cachedImage(idx, mTol)))
      if (gen !== generation) return

      let corrs: (number | null)[]
      let matrix: (number | null)[][]
      if (workerBroken) {
        const images = raws.map((img) => hotspotClip(img, 99))
        matrix = images.map((img, i) =>
          images.map((_, j) => (i === j ? null : pearsonCorrelation(img, images[j]!))),
        )
        corrs = matrix.map((row) =>
          row.reduce<number | null>(
            (best, r) => (r != null && (best == null || r > best) ? r : best),
            null,
          ),
        )
      } else {
        const copies = raws.map((img) => new Float32Array(img))
        const res = await postScoreTask({ type: 'group', ids: entry.rowIds, images: copies })
        if (gen !== generation) return
        if (res.type !== 'group') return
        corrs = res.corrs.map((c) => c ?? null)
        matrix = res.matrix
      }

      for (let i = 0; i < entry.rowIds.length; i++) {
        pushFlushPartial(entry.rowIds[i]!, { adductCorr: corrs[i] ?? null })
      }
      // 组级确认：按 0.7 边的连通分量重验成组条件（对齐参考
      // _confirm_groups_from_correlations），而非逐行最大 Pearson
      const revoked = applyAdductGroupConfirmation(entry.rows, matrix)
      if (revoked) touchRows()
    } catch {
      /* 确认失败不重试不计数：组确认是渐进增强，不阻塞主队列 */
    }
  }

  function reset(): void {
    generation++
    highLane = []
    normalLane = []
    inFlight = 0
    consecutiveErrors = 0
    stopped = false
    doneCount.value = 0
    queuedTotal.value = 0
    pendingFlush = new Map()
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    spatialByRowId.value = new Map()
    if (cacheAxis !== mzAxisRef.value) {
      imageCache.clear()
      cacheBytes = 0
      cacheAxis = mzAxisRef.value
    }
  }

  // ---- Top-K 选取 + 签名失效 ----
  let lastSignature = ''
  /** 上一代 Top-K 的行对象集合：签名（id:峰位）相同但对象是新克隆时同样
   *  必须重建——重匹配会把 Tier-1 加成重新授予新行对象，若跳过，上一代被
   *  Tier-2 撤销的加成会带着 spatialByRowId 里陈旧的 adductCorr 复活 */
  let lastTopRows = new Set<MatchedAnnotationRow>()
  watch(
    matchedRows,
    (rows) => {
      if (dataModeRef.value !== 'continuous' || !mzAxisRef.value || rows.length === 0) {
        if (spatialByRowId.value.size > 0) reset()
        lastSignature = ''
        return
      }
      const axis = mzAxisRef.value
      // Top-K by compositeScore（插入有序有界列表，避免全体排序）
      const top: MatchedAnnotationRow[] = []
      for (const r of rows) {
        if (r.matchStatus !== 'matched' || r.matchedIndex == null || r.compositeScore == null)
          continue
        if (top.length < topK) {
          top.push(r)
          if (top.length === topK) top.sort((a, b) => b.compositeScore! - a.compositeScore!)
        } else if (r.compositeScore! > top[topK - 1]!.compositeScore!) {
          top[topK - 1] = r
          for (
            let i = top.length - 1;
            i > 0 && top[i]!.compositeScore! > top[i - 1]!.compositeScore!;
            i--
          ) {
            const t = top[i]!
            top[i] = top[i - 1]!
            top[i - 1] = t
          }
        }
      }
      // 签名必须包含容差：mTol 决定每张图像的加载窗口，容差收紧/放宽后即使
      // matchedIndex 不变（同一最近峰），缓存分数也是按旧窗口算的——不失效
      // 的话 hover 卡与导出 CSV 会显示与当前容差不符的 Chaos/MSM。
      const tolKey = `${opts.tolMode.value}:${opts.tolValue.value}`
      // 签名做有序化比较（纯排序 perm 不重建），并叠加行对象同一性检查
      const signature =
        `${tolKey}|` + top.map((r) => `${r.id}:${r.matchedIndex}`).sort().join('|')
      const sameObjects = top.length === lastTopRows.size && top.every((r) => lastTopRows.has(r))
      if (signature === lastSignature && sameObjects) return
      lastSignature = signature
      lastTopRows = new Set(top)
      reset()
      for (const r of top) {
        const z = chargeFromIonType(r.ionType)
        const env = isotopeEnvelope(r.formulaIon, z)
        if (!env || env.length < 1) continue
        // 参考用 top-4 峰的图像；无采样点的卫星峰以 -1（零图像）参与
        const indices: number[] = []
        for (const p of env) {
          const expected = (r.matchedMz ?? r.expMz) + p.dm
          let idx: number
          if (expected > axis[0]! && expected < axis[axis.length - 1]!) {
            const i = findClosestIndex(axis, expected)
            idx = Math.abs(axis[i]! - expected) <= tolDaOf(expected) * 2 + 1e-4 ? i : -1
          } else {
            idx = -1
          }
          indices.push(p.dm === 0 ? r.matchedIndex! : idx)
        }
        normalLane.push({
          kind: 'row',
          rowId: r.id,
          indices,
          theory: env.map((p) => p.rel),
        })
      }
      // 多加合物组确认任务：排在所有行任务之后（M 图像大概率已在 LRU 中）
      const topIds = new Set(top.map((r) => r.id))
      const idToIndex = new Map(top.map((r) => [r.id, r.matchedIndex!] as const))
      const idToRow = new Map(top.map((r) => [r.id, r] as const))
      const groupSeen = new Set<string>()
      for (const r of top) {
        if (r.adductPeerIds.length === 0) continue
        const ids = [r.id, ...r.adductPeerIds]
        if (ids.some((id) => !topIds.has(id))) continue
        const key = [...ids].sort((a, b) => a - b).join(',')
        if (groupSeen.has(key)) continue
        groupSeen.add(key)
        const idxs = ids.map((id) => idToIndex.get(id))
        if (idxs.some((i) => i == null)) continue
        const rows = ids.map((id) => idToRow.get(id))
        if (rows.some((row) => row == null)) continue
        normalLane.push({
          kind: 'group',
          rowIds: ids,
          indices: idxs as number[],
          rows: rows as MatchedAnnotationRow[],
        })
      }
      pump()
    },
    { immediate: true },
  )

  function bumpPriority(ids: number[]): void {
    if (ids.length === 0 || stopped) return
    const want = new Set(ids)
    const bumped = normalLane.filter(
      (e): e is RowEntry => e.kind === 'row' && want.has(e.rowId),
    )
    if (bumped.length === 0) return
    normalLane = normalLane.filter((e) => !(e.kind === 'row' && want.has(e.rowId)))
    highLane = [...highLane, ...bumped]
    pump()
  }

  onUnmounted(() => {
    generation++
    stopped = true
    highLane = []
    normalLane = []
    if (flushTimer) clearTimeout(flushTimer)
    imageCache.clear()
    cacheBytes = 0
    // worker 及其在途请求一并回收（reject 让挂起的 runEntry 走 catch 收尾，
    // gen 已递增，不会再写状态）
    for (const [, p] of inflight) p.reject(new Error('spatial scoring disposed'))
    inflight.clear()
    scoreWorker?.terminate()
    scoreWorker = null
  })

  return { spatialByRowId, spatialPending, spatialProgress, bumpPriority }
}
