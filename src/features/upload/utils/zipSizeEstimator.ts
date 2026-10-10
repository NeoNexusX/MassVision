import { formatSpeed, formatETA, type ImzmlMilestone } from './imzmlHelper'
import { BusyClock, averageRate } from './rateMeter'

/**
 * zip 产物大小估算 + 上传进度/速度换算。
 *
 * 进度口径是「已确认落到 OSS 的源字节 / 源文件总大小」：分子由 CreditGate 切块
 * 时记下的源字节跨度累加而来（见 `UploadProgressMeter.partCut`），分母是
 * File.size。两端都精确，所以百分比不依赖下面这个估算器 —— 估算器只负责给
 * 消息文案算「第几片 / 共几片」，估偏了不影响进度条。
 */

/** imzML 是 XML，deflate 实测压缩率 0.15~0.25。取 0.30 是刻意高估（见下） */
const IMZML_PRIOR_RATIO = 0.3
/** ibd 是 float 二进制，deflate 实测 0.85~0.95。取 1.0 是刻意高估 */
const IBD_PRIOR_RATIO = 1.0
/** 2 个 local header + central directory + zip64 EOCD，GB 级下可忽略 */
const ZIP_OVERHEAD_BYTES = 512

export interface ZipSizeInput {
  imzmlSize: number
  ibdSize: number
  /** false 时 ibd 走 STORE，产物大小几乎完全可算（见 estimate 的注释） */
  compressIbd: boolean
}

/**
 * 先验刻意偏向**高估**，因为两种误差的体感不对等：
 *   高估 → 总片数偏多 → 进度偏低，最后跳一下到 100%
 *   低估 → 总片数偏少 → 进度超 100% 被钳住，卡在 100% 干等
 * 后者用户会以为卡死了，比「跳一下」糟得多。
 */
export class ZipSizeEstimator {
  /** imzML entry 压完时的 zip 字节数；null 表示还没压完 */
  private zipAfterImzml: number | null = null

  constructor(private readonly input: ZipSizeInput) {}

  /** imzML entry 压完时调用。`zipDone` 是此刻已产出的 zip 字节 */
  imzmlDone(zipDone: number): void {
    this.zipAfterImzml = zipDone
  }

  /**
   * 当前对 zip 产物总字节的最佳估计，三段逐步收敛：
   *
   *   ① imzML 压缩中 —— 两段都只能用先验
   *   ② imzML 压完   —— 它的压缩后大小已是确切值，只有 ibd 还要估
   *   ③ ibd 压缩中   —— 用实测压缩率外推剩余部分
   *
   * `compressIbd: false` 时第 ② 段就已经精确（ibd 走 STORE，字节原样写入），
   * 第 ③ 段的实测外推只在 `compressIbd: true` 时才真正起作用。
   *
   * 第 ① 段的偏差持续多久取决于 imzML 有多大 —— 它并不总是小文件。
   * 但这个偏差只会让文案里的「共几片」在开头偏大，不影响进度条。
   */
  estimate(zipDone: number, ibdDone: number): number {
    const { imzmlSize, ibdSize, compressIbd } = this.input

    // ① 还没压完 imzML
    if (this.zipAfterImzml === null) {
      return imzmlSize * IMZML_PRIOR_RATIO + ibdSize * IBD_PRIOR_RATIO + ZIP_OVERHEAD_BYTES
    }

    // ② ibd 走 STORE（原样写入），或者还没出字节、没有实测样本
    if (!compressIbd || ibdDone <= 0) {
      return this.zipAfterImzml + ibdSize * IBD_PRIOR_RATIO + ZIP_OVERHEAD_BYTES
    }

    // ③ 实测外推。ibd 是同构的二进制质谱数据，压缩率在文件内部高度均匀，
    //    压过百分之几之后比值就基本定死了，误差收敛到 1% 以内。
    const ratio = (zipDone - this.zipAfterImzml) / ibdDone
    return zipDone + (ibdSize - ibdDone) * ratio + ZIP_OVERHEAD_BYTES
  }
}

/** 估算字节 → 总片数。至少 1 片：产物再小也要发一片（它同时是尾片，无下限） */
function partsFromEstimate(estZipBytes: number, partSize: number): number {
  return Math.max(1, Math.ceil(estZipBytes / partSize))
}

export interface ProgressSnapshot {
  percent: number
  /** 已确认落到 OSS 的源字节。副行显示「已安全上传 X / Y」 */
  doneSourceBytes: number
  /** 端到端（源字节/s）—— 用户体感的速度，也是 ETA 的分母 */
  speedStr: string
  etaStr: string
  /** 压缩（源字节/s），已扣掉被背压卡住的时间 */
  compressSpeedStr: string
  /** 上传（源字节/s），分母是「至少一片在飞」的时间 */
  uploadSpeedStr: string
  /** 谁让对方等得更久。样本不足时为 null */
  bottleneck: 'upload' | 'compress' | null
  /** imzML 段完成时的一次性结算，之后每次快照都原样带着（UI 常驻显示） */
  imzmlMilestone: ImzmlMilestone | null
}

/**
 * ETA 所需的最少分片样本数。
 *
 * 不只是为了平滑：源字节口径下，高压缩率的 entry（比如大 imzML）会让头几片
 * 背着远超平均的源字节，算出来的速度偏乐观。多等两片能回到以 ibd 为主的常态。
 */
const ETA_MIN_PARTS = 3

/** 瓶颈判断的最短观察窗口。太早时两边的等待时间都还没积累出差别 */
const BOTTLENECK_MIN_ELAPSED_MS = 3000

/** 速率 0 = 样本不足，给空串让 UI 整项不显示，而不是显示一个 0.0 MB/s */
const speedText = (rate: number) => (rate > 0 ? formatSpeed(rate) : '')

/**
 * 上传进度与速度表：源字节进，百分比和三个速度出。
 *
 * ## 百分比用源字节
 *
 * 分子是「已确认落到 OSS 的分片所对应的源字节」，由 CreditGate 切块时逐段相减
 * 得出（见 `partCut`）。中间项全部抵消，所以跨度之和恒等于源文件总大小，
 * 而分母 `File.size` 精确且恒定 —— 百分比因此天然单调、天然不超 100%，
 * 不需要任何钳位。下面那个 `Math.min(100, …)` 只是显示兜底，不承担语义。
 *
 * 代价：它精确的是**数据量**而不是**时间**。等待时间正比于要传的 zip 字节，
 * 压缩率在文件内部变化大时（imzML 能压到 1:5，ibd 几乎压不动），进度条会
 * 先快后慢。换来的是分母精确、语义明确：「我的数据安全了多少」。
 *
 * ## 三个速度的分母各不相同
 *
 *   压缩    压缩挂钟 − 被背压卡住的时间   （上传慢不该算成压缩慢）
 *   上传    至少一片在飞的时间             （消费者等分片的空转不算）
 *   端到端  压缩挂钟，什么都不扣           （用户体感的速度）
 *
 * 三者分子统一用源字节，所以可以直接横向比较。
 */
export class UploadProgressMeter {
  private startedAt = Date.now()
  /**
   * 分片号 → 源字节跨度。计入后立即删除，于是「重复计入」和「还没收到 cut」
   * 都自然成为空操作，不需要额外的已计入集合。
   */
  private readonly spans = new Map<number, number>()
  /** 已确认落到 OSS 的源字节，含续传时上一轮就传好的部分 */
  private doneSource = 0
  /**
   * 其中本次会话真正上传的部分。
   *
   * 续传已有的分片没占用这次的带宽，算进速度会让读数虚高、ETA 过于乐观，
   * 所以速度分子一律用它，只有百分比用 `doneSource`。
   */
  private sessionSource = 0
  private ackedThisSession = 0
  private srcDone = 0
  private stalledMs = 0
  private totalParts: number
  private donePartCount = 0
  private readonly busy = new BusyClock()
  private readonly resumed: Set<number>
  /**
   * 本次会话实际发上网的 zip 字节。与 `sessionSource` 的区别是口径不是范围：
   * 那个是源字节，这个是压缩后的线路字节。并发调度器的分母是片长（线路字节），
   * 只能用这一个；面板上的三个速度统一用源字节以便横向比较。两者不可互换。
   */
  private wireBytes = 0
  /** imzML 段的一次性结算。非 null 即表示已触发，不会再变 */
  private milestone: ImzmlMilestone | null = null

  /** `resumedPartNumbers` 是续传时已在 OSS 上的分片号，计入进度但不计入速度 */
  constructor(
    private readonly partSize: number,
    private readonly sourceBytes: number,
    resumedPartNumbers: Iterable<number> = [],
    /** imzML entry 的源字节数。`doneSource` 越过它即触发里程碑 */
    private readonly imzmlBytes = 0,
  ) {
    this.resumed = new Set(resumedPartNumbers)
    // 压缩还没开始，先用源文件总量兜着；worker 一进入压缩就会发来第一个估算
    this.totalParts = partsFromEstimate(sourceBytes, partSize)
  }

  /**
   * 开始计时。与构造分开是因为中间隔着 `initMultipartUpload` 的一次网络往返，
   * 把它算进端到端时间会让开头几秒的速度读数无端偏低。
   */
  start(): void {
    this.startedAt = Date.now()
  }

  get totalPartCount(): number {
    return this.totalParts
  }

  get uploadedPartCount(): number {
    return this.donePartCount
  }

  /** 只影响消息文案里的「共几片」，不影响进度条 */
  updateEstimate(estZipBytes: number): void {
    this.totalParts = Math.max(partsFromEstimate(estZipBytes, this.partSize), this.donePartCount)
  }

  /**
   * worker 切出一片，报告它消耗了多少源字节。
   *
   * 续传时已在 OSS 上的分片**立刻计入进度**：它们的字节上一轮就落地了，
   * 这一轮只是重新压一遍。所以续传的进度条会先以磁盘速度快速爬过前半段，
   * 再转入网速 —— 那段重压确实是在花时间干活。
   */
  partCut(partNo: number, srcSpan: number): void {
    this.spans.set(partNo, srcSpan)
    if (this.resumed.has(partNo)) this.credit(partNo, false)
  }

  /**
   * 一片确认落到 OSS。`wireBytes` 是这一片实际发上网的字节数（= blob.size）。
   * 必须在 `credit()` **之前**累加 —— 里程碑在 credit() 里触发，而触发它的
   * 正是这一片，它的字节理应算进那一刻的平均速率。
   */
  partAcked(partNo: number, wireBytes: number): void {
    this.wireBytes += wireBytes
    this.credit(partNo, true)
    this.ackedThisSession++
  }

  /**
   * 线路字节口径的平均上传速率（bytes/s）。
   * **只给并发调度器和 imzML 里程碑用，不进面板。**
   *
   * 调度器的分母是片长，也就是线路字节，所以只能用这个口径；
   * 和面板那三个源字节速度差一个压缩率，混用会让 imzML 段高估四五倍。
   */
  get wireUploadRate(): number {
    return averageRate(this.wireBytes, this.busy.elapsedMs)
  }

  private credit(partNo: number, thisSession: boolean): void {
    const span = this.spans.get(partNo)
    if (span === undefined) return
    this.spans.delete(partNo)
    this.doneSource += span
    this.donePartCount++
    if (thisSession) this.sessionSource += span
    if (this.donePartCount > this.totalParts) this.totalParts = this.donePartCount
    this.checkImzmlMilestone()
  }

  /**
   * imzML 段是否刚刚全部落地。口径是「已确认的源字节越过 imzml.size」。
   *
   * 那一段的最后几个字节夹在某个跨界分片里，所以里程碑只能挂在分片确认上，
   * 精度是一个分片 —— 对一条给人看的提示来说够了。
   *
   * 续传时 `doneSource` 在开头就直接越过阈值，而那时 `wireBytes` 还是 0，
   * averageRate 返回 0、格式化成空串，于是自然变成「只报状态不报速度」，
   * 不需要为续传单开一支判断。
   */
  private checkImzmlMilestone(): void {
    if (this.milestone || this.imzmlBytes <= 0 || this.doneSource < this.imzmlBytes) return
    this.milestone = {
      uploadSpeedStr: speedText(this.wireUploadRate),
      compressSpeedStr: speedText(this.compressRate()),
    }
  }

  /** 压缩速率：分母扣掉被背压卡住的时间。`elapsed` 由调用方复用同一个时间基准 */
  private compressRate(elapsed = Date.now() - this.startedAt): number {
    return averageRate(this.srcDone, elapsed - this.stalledMs)
  }

  /** 一片开始上传 / 结束上传。成对调用，用来量「至少一片在飞」的时长 */
  uploadStarted(): void {
    this.busy.enter()
  }

  uploadFinished(): void {
    this.busy.leave()
  }

  compressStats(srcDone: number, stalledMs: number): void {
    this.srcDone = srcDone
    this.stalledMs = stalledMs
  }

  /**
   * 谁是瓶颈：比较两边互相等待的时间占比，谁等得少谁就是瓶颈。
   * 比直接比两个速度值可靠 —— 速度受缓冲区领先量影响，开头几十秒里压缩总是
   * 显得更快，据此判断会一直误报「上传是瓶颈」。等待时间没有这个偏差。
   */
  private bottleneckOf(elapsed: number): 'upload' | 'compress' | null {
    if (elapsed < BOTTLENECK_MIN_ELAPSED_MS || this.ackedThisSession < 1) return null
    const compressWaiting = this.stalledMs / elapsed // 压缩在等上传
    const uploadWaiting = 1 - this.busy.elapsedMs / elapsed // 上传在等压缩
    return compressWaiting > uploadWaiting ? 'upload' : 'compress'
  }

  snapshot(): ProgressSnapshot {
    const elapsed = Date.now() - this.startedAt
    const e2e = averageRate(this.sessionSource, elapsed)
    const remaining = Math.max(0, this.sourceBytes - this.doneSource)

    return {
      // min 纯属防御：跨度之和恒等于 sourceBytes，正常情况下到不了 100 以上
      percent:
        this.sourceBytes > 0
          ? Math.min(100, Math.round((this.doneSource / this.sourceBytes) * 100))
          : 0,
      doneSourceBytes: this.doneSource,
      speedStr: speedText(e2e),
      etaStr: this.ackedThisSession >= ETA_MIN_PARTS && e2e > 0 ? formatETA(remaining / e2e) : '',
      compressSpeedStr: speedText(this.compressRate(elapsed)),
      uploadSpeedStr: speedText(averageRate(this.sessionSource, this.busy.elapsedMs)),
      bottleneck: this.bottleneckOf(elapsed),
      imzmlMilestone: this.milestone,
    }
  }
}
