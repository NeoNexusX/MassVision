/**
 * 内部代码常量（实现层调优参数，**非**「人来配置」的内容）。
 *
 * 面向用户/运维的偏好（名称、分页、验证码、选项表）放运行时 config.json（见 runtimeConfig.ts）；
 * 地址类放 env/ 目录的 .env 文件（见 env.ts）。此处只保留改了会影响实现细节、不应暴露给配置文件的常量。
 */

/** OSS 分片上传（凭证来自后端 STS，此处仅为客户端可调参数） */
export const OSS_UPLOAD = {
  /** OSS 客户端超时（ms） */
  timeout: 30000,
  /** 分片阈值（bytes）：小于此值用固定小片，否则按固定片数均分 */
  singlePartThreshold: 1e9,
  /** 小文件分片大小（bytes，1MB） */
  smallFilePartSize: 1 * 1024 * 1024,
  /** 大文件目标分片数 */
  largeFilePartCount: 1000,
  /** checkpoint 持久化节流间隔（ms），用于跨会话断点续传 */
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
