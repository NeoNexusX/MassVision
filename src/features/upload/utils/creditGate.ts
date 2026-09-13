export interface CreditGateOptions {
  /** 每片的字节数（尾片可以更小） */
  partSize: number
  /** 初始信用额度 = 缓冲区容量（分片数） */
  initialCredits: number
  /** OSS 单次 multipart 的分片数上限 */
  maxPartCount: number
  /** 续传：这些分片号已在 OSS 上，重新生成但不外发 */
  donePartNumbers?: Iterable<number>
  /** 续传：重新生成到这个分片号时调用 `emitVerify` */
  verifyPartNo?: number | null
  /** 外发一片。消耗 1 点额度；消费端出队后调 `addCredits()` 归还 */
  emitPart: (partNo: number, chunks: Uint8Array[]) => void
  /** 已完成分片被重新生成时回传，供调用方做可复现性校验 */
  emitVerify?: (partNo: number, chunks: Uint8Array[]) => void | Promise<void>
  /**
   * 每切出一片就调用一次，报告这一片消耗了多少**源文件**字节。进度条的数据源。
   *
   * 跨度是观测值而不是换算值：切块时的 `srcDone` 减去上次切块时的 `srcDone`。
   * 所以压缩率在文件内部怎么变都不影响，各片的跨度会如实反映差异。
   *
   * 逐段相减意味着所有跨度之和恒等于源文件总大小，于是「已确认跨度之和 ÷
   * 源文件总大小」天然单调、天然不超 100%。
   *
   * **续传时被跳过的分片也会调用**，见 `emit()` 里的调用点注释。
   */
  onCut?: (partNo: number, srcSpan: number) => void
}

/**
 * 把一条字节流切成等长分片外发，并用信用额度对生产端施加背压。
 *
 * 额度耗尽时 `write()` 就地挂起，上游（zip 压缩）随之停下。这是「压缩产物不落
 * 本地磁盘」能成立的关键：压缩永远跑不到消费端前面超过一个缓冲区的量。
 *
 * 额度表达的是「缓冲区空出了一个位置」，消费端**取走**分片时就归还，与这一片
 * 传得成不成无关 —— 所以某片进入重试时压缩照常推进。失败不走流控通道，
 * 而是由 `fail()` 显式注入，生产端在下一个检查点抛出。
 *
 * 分片按字节精确切，与上游 chunk 边界无关。这是续传的前提：续传要求「第 N 片
 * 包含完全相同的字节」，而 CompressionStream 的输出分块大小不保证跨运行稳定。
 * 精确切分让片边界成为字节流的纯函数；换成「攒够就整批发出」会让字节流一致、
 * 片边界却错位，续传校验会判定不可复现并作废整轮。
 */
export class CreditGate {
  private pending: Uint8Array[] = []
  private buffered = 0
  private partNo = 0
  private credits: number
  private waiters: Array<() => void> = []
  private failure: Error | null = null
  private readonly done: Set<number>
  /** 最近一次 `write()` 报告的已读源字节数 */
  private srcDone = 0
  /** 上一次切块时的 `srcDone`，用来算跨度 */
  private cutSrc = 0
  /** 已结束的背压等待累计时长 */
  private stalled = 0
  /** 当前这段背压等待的起点；0 表示此刻没有被卡住 */
  private stalledSince = 0

  constructor(private readonly options: CreditGateOptions) {
    this.credits = options.initialCredits
    this.done = new Set(options.donePartNumbers ?? [])
  }

  /**
   * 生产端因额度耗尽而挂起的累计时长。压缩速度的分母要扣掉它，
   * 否则上传一慢，压缩就因为大部分时间停在 `emit()` 里等额度而显示得极慢。
   *
   * 含当前正在进行的那一段 —— 卡住期间没有事件触发上报，不算进去的话，
   * 界面上的压缩速度反而会在一次长背压里一路走高。
   */
  get stalledMs(): number {
    return this.stalled + (this.stalledSince > 0 ? Date.now() - this.stalledSince : 0)
  }

  /** 归还缓冲区空位，放行后续分片。消费端出队即调用，不等上传结果 */
  addCredits(count = 1): void {
    this.credits += count
    this.wake()
  }

  /** 放弃整条流（消费端失败 / zip 字节不可复现 / 中止），生产端在下一个检查点抛出 */
  fail(message: string): void {
    this.failure ??= new Error(message)
    this.wake()
  }

  private wake(): void {
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure
  }

  /** 从待发队列头部精确切出 size 字节。`subarray` 是零拷贝视图，只动指针 */
  private cut(size: number): Uint8Array[] {
    const out: Uint8Array[] = []
    let need = size
    while (need > 0) {
      const head = this.pending[0]!
      if (head.byteLength <= need) {
        out.push(head)
        need -= head.byteLength
        this.pending.shift()
      } else {
        out.push(head.subarray(0, need))
        this.pending[0] = head.subarray(need)
        need = 0
      }
    }
    this.buffered -= size
    return out
  }

  private async emit(chunks: Uint8Array[]): Promise<void> {
    this.throwIfFailed()
    const partNo = ++this.partNo

    if (partNo > this.options.maxPartCount) {
      throw new Error(
        `Archive exceeds the ${this.options.maxPartCount}-part OSS limit at ` +
          `${this.options.partSize} bytes per part; raise the partSize tier in pickPartPlan().`,
      )
    }

    // 跨度必须在下面那个「已完成分片提前 return」之前算。续传时被跳过的分片
    // 同样消耗了源字节，主线程要靠这条消息把它们计入进度 —— 漏掉的话，
    // 进度条会永远缺掉这些分片对应的那一段，最后停在 100% 以下。
    const srcSpan = this.srcDone - this.cutSrc
    this.cutSrc = this.srcDone
    this.options.onCut?.(partNo, srcSpan)

    // 续传：这一片已经在 OSS 上，只重算不重传。分片号照常递增，
    // 否则后续分片的编号会错位。不消耗额度 —— 它根本不出去。
    if (this.done.has(partNo)) {
      if (partNo === this.options.verifyPartNo) {
        await this.options.emitVerify?.(partNo, chunks)
      }
      return
    }

    if (this.credits <= 0) {
      this.stalledSince = Date.now()
      try {
        while (this.credits <= 0) {
          this.throwIfFailed()
          await new Promise<void>((resolve) => this.waiters.push(resolve))
        }
      } finally {
        // finally 而不是跟在循环后面：throwIfFailed() 从循环里抛出时也要结算，
        // 否则 stalledSince 一直挂着，stalledMs 会无限增长
        this.stalled += Date.now() - this.stalledSince
        this.stalledSince = 0
      }
    }
    this.throwIfFailed()

    this.credits--
    this.options.emitPart(partNo, chunks)
  }

  /**
   * 写入一段 zip 产物字节。
   *
   * `srcDone` 是此刻已从源文件读出的字节数，用来给分片标注源字节跨度。
   * 设成必填是为了不给「忘了传」留口子 —— 漏传会让所有跨度变成 0，
   * 后果是进度条永远停在 0%。
   *
   * 编码器内部有缓冲，源与产物之间有几百 KB 的滞后，所以单片跨度在边界上
   * 略有误差。但那是滞后不是漂移，下一片会吸收回来，总和始终精确。
   */
  async write(chunk: Uint8Array, srcDone: number): Promise<void> {
    this.srcDone = srcDone
    if (chunk.byteLength === 0) return
    this.pending.push(chunk)
    this.buffered += chunk.byteLength
    while (this.buffered >= this.options.partSize) {
      await this.emit(this.cut(this.options.partSize))
    }
  }

  /**
   * 冲刷尾片，返回总片数。**不等任何上传确认** —— 生产端的责任到「字节全部
   * 外发」为止，「全部落到 OSS」由消费端自己 await。
   *
   * 尾片不做大小下限判断：OSS 只对非尾片要求 ≥100KB。产物整体小于片长时，
   * 它作为唯一的一片（同时就是尾片）发出，complete 照常成功。
   * 余量恰好为 0 时不发空片。
   */
  async finish(): Promise<number> {
    if (this.buffered > 0) await this.emit(this.cut(this.buffered))
    this.throwIfFailed()
    return this.partNo
  }
}
