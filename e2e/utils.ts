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

/**
 * 跑算法 / 可视化任务（explore raw-convert、new-analysis submit）用的真实数据集，
 * 按名称优先匹配（先后端搜 Ecoli，没有再搜 Human）。
 *
 * 不能用 1KB 合成 imzML（spectrumList count=0 + 随机 ibd）：后端解析必然失败，
 * 任务 Failed，等待 Completed 的断言会超时。必须换成后端上真实存在的 MSI 数据集。
 */
export const ALGO_DATASET_NAMES = [
  'Ecoli_Brain_MALDI_49_Negative_a6e46f',
  'Human_Kidney_MALDI_50_Negative_69bdd1',
] as const
