/**
 * 生成分页按钮序列：首尾页常驻，当前页附近展开，过长处用 '...' 省略。
 *
 * 纯函数（仅依赖入参），便于单测；从 useDatasetList 抽出，供任意列表分页复用。
 *
 * @param current 当前页（1 基）
 * @param total 总页数
 * @param maxButtons 不省略时最多展示的页码数（默认 7）
 * @returns 形如 [1, '...', 4, 5, 6, '...', 20] 的页码/省略号序列
 */
export function buildPageList(
  current: number,
  total: number,
  maxButtons = 7,
): (number | string)[] {
  const totalPages = Math.max(1, Number(total) || 1)
  const cur = Math.min(Math.max(1, Number(current) || 1), totalPages)
  const pages: (number | string)[] = []

  if (totalPages <= maxButtons) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
    return pages
  }

  pages.push(1)

  let left = Math.max(cur - 1, 2)
  let right = Math.min(cur + 1, totalPages - 1)
  if (cur <= 3) {
    left = 2
    right = 4
  }
  if (cur >= totalPages - 2) {
    left = totalPages - 3
    right = totalPages - 1
  }

  if (left > 2) pages.push('...')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages - 1) pages.push('...')

  pages.push(totalPages)
  return pages
}
