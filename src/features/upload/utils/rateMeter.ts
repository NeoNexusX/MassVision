/**
 * 速率计算的两个原语。
 *
 * 上传流水线里有三个「速度」，分子分母各不相同，混用会得出看起来合理、
 * 实际无意义的数字：
 *
 *   压缩    已读源字节 ÷ (压缩挂钟 − 被背压卡住的时间)
 *   上传    已确认源字节 ÷ 至少一片在飞的时间
 *   端到端  已确认源字节 ÷ 压缩挂钟（什么都不扣）
 *
 * 三者统一用**源字节**做分子，所以可以直接横向比较：端到端天然不高于另外两个，
 * 谁跟端到端贴得近谁就是瓶颈。
 */

/**
 * 「至少有一个分片在飞」的挂钟时长，也就是忙碌区间的**并集**：
 * 第一个上传开始时起表，最后一个上传结束时停表。
 *
 * 上传速度的分母不能用总挂钟 —— 消费者大量时间阻塞在 `queue.take()` 上等压缩
 * 产出，算进去得到的是端到端吞吐而不是网络吞吐。也不能用各片耗时之和 ——
 * 并发 k 片在飞会把同一段挂钟时间算 k 遍。
 */
export class BusyClock {
  private active = 0
  private since = 0
  private accumulated = 0

  enter(): void {
    if (this.active++ === 0) this.since = Date.now()
  }

  leave(): void {
    // 多余的 leave 直接忽略。让 active 掉到负数的话，下一次 enter 不会重置
    // `since`，之后就会累加出一段凭空多出来的忙碌时间。
    if (this.active <= 0) return
    if (--this.active === 0) this.accumulated += Date.now() - this.since
  }

  /** 含当前正在进行的那一段 —— 否则一次长传输期间速度会一直挂着旧值 */
  get elapsedMs(): number {
    return this.accumulated + (this.active > 0 ? Date.now() - this.since : 0)
  }
}

/**
 * 累计平均速率（bytes/s）。
 *
 * 用累计平均而不是滑动窗口：分子按分片确认跳变（一片 50~128MB），瞬时速率会
 * 在「0、0、一大跳」之间抖到没法读，而累计平均天然平滑，也正好是用户想知道的
 * 「这趟传输平均多快」。
 *
 * 样本不足时返回 0，调用方据此「暂不显示」而不是显示一个 0.0 MB/s。
 */
export function averageRate(bytes: number, elapsedMs: number): number {
  if (bytes <= 0 || elapsedMs <= 0) return 0
  return (bytes * 1000) / elapsedMs
}
