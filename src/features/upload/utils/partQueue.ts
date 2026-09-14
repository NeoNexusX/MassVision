export interface QueuedPart {
  partNo: number
  blob: Blob | null
}

/**
 * 主线程侧的分片缓冲区，消费者从这里取片上传。
 *
 * `push()` 同步、不设容量检查 —— 容量已经由对端的信用额度保证：worker 初始
 * 持有 n 点，每外发一片消耗 1 点，消费者出队时归还 1 点，所以「已外发但未出队」
 * 的分片数恒 ≤ n，而这正是「postMessage 在途 + 队列中」的量。`size ≤ n`
 * 因此是不变式，不需要在这边再拦一道。
 *
 * 容量只交给单侧是刻意的：跨线程的两个有界队列互相等待就是死锁的标准配方，
 * 而同步的 `push()` 根本不可能挂住。
 */
export class PartQueue {
  private items: QueuedPart[] = []
  private waiters: Array<() => void> = []
  private producerSealed = false
  private failed = false
  private failureReason: unknown = null

  push(part: QueuedPart): void {
    this.items.push(part)
    this.wake()
  }

  /** 生产端已把字节全部外发。队列排空后消费者即可退出 */
  sealProducer(): void {
    this.producerSealed = true
    this.wake()
  }

  /**
   * 让所有消费者立刻带错退出。中止和消费端失败都走这里 —— 阻塞在 `take()` 上的
   * 消费者不会因为生产端停了就自己醒过来，必须显式唤醒，否则等它们的
   * `Promise.all` 永远不 settle。
   *
   * `reason` 是 `unknown` 且被**原样**抛出，不包一层 Error：中止原因是个普通
   * 对象字面量（见 uploadAbort.ts），包一层会把「用户取消 / 组件卸载」的意图
   * 压成 `"[object Object]"`，pipeline 的 `dispositionFor` 就分不出该作废分片
   * 还是该保留会话。
   */
  fail(reason: unknown): void {
    if (this.failed) return
    this.failed = true
    this.failureReason = reason
    this.wake()
  }

  private wake(): void {
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }

  /** 取一片。队列空且生产端已封口时返回 null（正常收尾）；失败时抛出 */
  async take(): Promise<QueuedPart | null> {
    for (;;) {
      if (this.failed) throw this.failureReason
      const item = this.items.shift()
      if (item) return item
      if (this.producerSealed) return null
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
  }
}
