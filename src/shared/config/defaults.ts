/**
 * 内部代码常量（实现层调优参数，**非**「人来配置」的内容）。
 *
 * 面向用户/运维的偏好（名称、导航、分页、验证码）放运行时 config.json（见 runtimeConfig.ts）；
 * 地址类放 env/ 目录的 .env 文件（见 env.ts）。此处只保留改了会影响实现细节、不应暴露给配置文件的常量。
 */

/**
 * OSS 分片上传（凭证来自后端 STS，此处仅为客户端可调参数）。
 *
 * 压缩产物是边生成边上传的流，最终大小事先未知，因此使用**固定**片长而不是
 * 「按总大小均分 N 片」。片长 × maxPartCount 即单次上传的体积上限。
 */
export const OSS_UPLOAD = {
  /** OSS 客户端超时（ms）。只作用于 init / complete / abort 这类控制面请求 */
  timeout: 30000,
  /** 流式分片大小（bytes，16MiB）。16MiB × maxPartCount ≈ 156GB 物理上限 */
  partSize: 16 * 1024 * 1024,
  /** OSS 协议规定的单次 multipart 最大分片数 */
  maxPartCount: 9999,
  /**
   * 同时在途的分片数。既是上传并发度，也是压缩端的背压水位：
   * worker 最多攒 partSize × 此值 的字节就必须等待，因此内存占用有上界，
   * 且与数据集大小无关。
   */
  maxInFlightParts: 4,
  /** 单个分片的上传超时（ms）。16MiB / 120s ≈ 140KB/s 的带宽下限容忍 */
  partTimeout: 120000,
  /** 单个分片失败后的重试次数（指数退避）。覆盖绝大多数网络抖动 */
  partRetries: 4,
  /**
   * 单次上传的体积上限（bytes，100GB），按 **源文件之和**（imzML + ibd）计。
   *
   * 这是产品侧的策略上限，必须小于 partSize × maxPartCount 这个物理上限
   * （约 156GB），否则超过物理上限的上传会走到一半才在切片处失败。
   * 二者的关系有单测守着，调整任一个都会被测试拦下。
   *
   * 之所以按源文件而不是压缩产物计：产物大小事先未知，而且 ibd 基本不可压，
   * 极端情况下产物会比源文件略大（deflate 对不可压数据有约 0.03% 开销）。
   */
  maxUploadBytes: 100 * 1024 * 1024 * 1024,
  /** 会话（uploadId + 已完成分片）持久化节流间隔（ms），用于跨会话断点续传 */
  checkpointSaveIntervalMs: 5000,
} as const

/** Zarr OSS Store 配置 */
export const ZARR_STORE = {
  /** intensity chunk 缓存数量（LRU） */
  intensityChunkCacheSize: 5,
  /** data/mz chunk 缓存数量（LRU），仅 processed 模式使用 */
  mzChunkCacheSize: 5,
  /** 默认 m/z 容差 */
  defaultMzTolerance: 0.0001,
  /** m/z 容差取值范围：最小 1e-8，最大 1 */
  minMzTolerance: 1e-8,
  maxMzTolerance: 1,
} as const

/** 下载限制 */
export const DOWNLOAD_LIMIT = {
  /** 两次下载之间的冷却时长（秒） */
  cooldownSeconds: 60,
} as const
