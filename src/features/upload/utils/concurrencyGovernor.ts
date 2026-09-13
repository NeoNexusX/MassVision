export interface ConcurrencyGovernorOptions {
  /** 片长（bytes）。目标并发的分母，必须与下面 `update()` 的分子同口径 */
  partSize: number
  /** 起点与下限 */
  min: number
  /** 上限。由内存与连接数预算反推，见 pickPartPlan */
  max: number
}

/**
 * 上传并发度的调度器。
 *
 * ## 目标值 = floor(上传速率 / 片长)
 *
 * 这个式子的量纲是**片/秒**，拿它当并发数等价于假设「一片的固定开销（握手 +
 * 首字节 + 响应）约 1 秒」，并发正好用来盖住这段开销。小片长上这个近似是对的：
 * 10MB 片在 40MB/s 下单片只跑 0.25s，固定开销占比极高，多开几条才填得满管道。
 *
 * 片长一大它就恒等于下限（128MB 片要 128MB/s 才升得到 2），这不是缺陷 ——
 * 那么大的片固定开销早被摊薄，并发对吞吐没有贡献。
 *
 * ## 分子必须是线路字节
 *
 * 分母 `partSize` 是 zip 产物的字节数，分子也就必须是**实际发上网的字节**，
 * 不能用面板上那个源字节口径的上传速度。两者差一个压缩率（imzML 段约 0.2），
 * 用错会在样本最少、最该保守的开头把速率高估约 5 倍。
 *
 * ## 只升不降
 *
 * 降并发要么得让多余的消费者自愿退出（它可能正卡在一个 30 分钟的请求里），
 * 要么得从 worker 手里收回额度（没有这个通道）。而内存上界本来就是按 `max`
 * 算的，降下来也不会让上界更低 —— 代价与收益不成比例，所以不做。
 */
export class ConcurrencyGovernor {
  private current: number

  constructor(private readonly options: ConcurrencyGovernorOptions) {
    this.current = options.min
  }

  /** 当前目标并发度 */
  get target(): number {
    return this.current
  }

  /**
   * 用最新的上传线路速率（bytes/s）重算目标，返回**需要新增的消费者数**。
   *
   * 返回增量而不是绝对值，调用方就不用自己记账「已经起了几个」；0 表示不变。
   * 速率为 0（还没有样本）时 floor 给出 0，被下限钳回 `min`，自然就是不变，
   * 不需要额外的「样本够不够」判断。
   */
  update(wireRate: number): number {
    const want = Math.min(
      this.options.max,
      Math.max(this.options.min, Math.floor(wireRate / this.options.partSize)),
    )
    if (want <= this.current) return 0
    const delta = want - this.current
    this.current = want
    return delta
  }
}
