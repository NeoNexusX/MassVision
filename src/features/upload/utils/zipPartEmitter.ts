export interface PartEmitterOptions {
  /** 每片的字节数（尾片可以更小） */
  partSize: number
  /** 允许同时在途（已外发、尚未确认落到 OSS）的分片数 */
  maxInFlight: number
  /** OSS 单次 multipart 的分片数上限 */
  maxPartCount: number
  /** 续传：这些分片号已在 OSS 上，重新生成但不外发 */
  donePartNumbers?: Iterable<number>
  /** 续传：重新生成到这个分片号时调用 `emitVerify` */
  verifyPartNo?: number | null
  /** 外发一片。调用方负责在它落到 OSS 后调用 `ack()` */
  emitPart: (partNo: number, chunks: Uint8Array[]) => void
  /** 已完成分片被重新生成时回传，供调用方做可复现性校验 */
  emitVerify?: (partNo: number, chunks: Uint8Array[]) => void | Promise<void>
}

/**
 * 把一条字节流切成等长分片外发，并对生产端施加背压。
 *
 * 在途分片达到 `maxInFlight` 时 `write()` 就地挂起，上游（zip 压缩）随之停下，
 * 直到某片被 `ack()`。这是「压缩产物不落本地磁盘」能成立的关键：压缩永远跑不到
 * 上传前面超过一个窗口的量，因此内存占用上界是 `partSize × maxInFlight`，
 * 与数据集大小无关。
 *
 * 分片边界与上游 chunk 边界无关 —— zip 输出的 chunk 大小任意，这里按字节精确切。
 */
export class ZipPartEmitter {
  private pending: Uint8Array[] = []
  private buffered = 0
  private partNo = 0
  private inFlight = 0
  private waiters: Array<() => void> = []
  private failure: Error | null = null
  private readonly done: Set<number>

  constructor(private readonly options: PartEmitterOptions) {
    this.done = new Set(options.donePartNumbers ?? [])
  }

  /** 已外发但尚未确认的分片数（测试与诊断用） */
  get inFlightCount(): number {
    return this.inFlight
  }

  /** 确认一片已落到 OSS，放行下一片 */
  ack(): void {
    this.inFlight--
    this.wake()
  }

  /** 放弃某片（重试耗尽 / 用户中止），生产端在下一个检查点抛出 */
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

  /** 从待发队列头部精确切出 size 字节 */
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
          `${this.options.partSize} bytes per part; raise OSS_UPLOAD.partSize.`,
      )
    }

    // 续传：这一片已经在 OSS 上，只重算不重传。分片号照常递增，
    // 否则后续分片的编号会错位。
    if (this.done.has(partNo)) {
      if (partNo === this.options.verifyPartNo) {
        await this.options.emitVerify?.(partNo, chunks)
      }
      return
    }

    while (this.inFlight >= this.options.maxInFlight) {
      this.throwIfFailed()
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    this.throwIfFailed()

    this.inFlight++
    this.options.emitPart(partNo, chunks)
  }

  async write(chunk: Uint8Array): Promise<void> {
    if (chunk.byteLength === 0) return
    this.pending.push(chunk)
    this.buffered += chunk.byteLength
    while (this.buffered >= this.options.partSize) {
      await this.emit(this.cut(this.options.partSize))
    }
  }

  /** 冲刷尾片，再等所有在途分片确认。返回总片数 */
  async finish(): Promise<number> {
    if (this.buffered > 0) await this.emit(this.cut(this.buffered))
    while (this.inFlight > 0) {
      this.throwIfFailed()
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    this.throwIfFailed()
    return this.partNo
  }
}
