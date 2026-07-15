/**
 * E2E 测试共享工具函数
 */

/**
 * 解析含 "X.X KB/MB/GB/TB" 的文本为 MB。
 * 无法解析时返回 Infinity，便于在过滤逻辑中直接跳过（sizeToMB(text) < max 恒为 false）。
 */
export function sizeToMB(text: string | null): number {
  if (!text) return Infinity
  const m = text.match(/([\d.]+)\s*(KB|MB|GB|TB)/i)
  if (!m) return Infinity
  const v = parseFloat(m[1])
  switch (m[2].toUpperCase()) {
    case 'KB': return v / 1024
    case 'MB': return v
    case 'GB': return v * 1024
    case 'TB': return v * 1024 * 1024
    default: return Infinity
  }
}

/**
 * 算法测试（Explore / New Analysis submit）只选小于此阈值的数据集，
 * 避免选到大文件（如 1G 上传测试数据）导致算法跑不完超时。
 * 下载测试的阈值单独定义在各 spec 内（MAX_DOWNLOAD_MB）。
 */
export const ALGO_MAX_MB = 30
