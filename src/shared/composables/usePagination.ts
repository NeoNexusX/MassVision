import { computed, ref } from 'vue'

export function usePagination(fetchFn: (page: number) => void) {
  // State
  const currentPage = ref(1)
  const pageSize = ref(10)
  const totalItems = ref(0)

  // Computed
  const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value) || 1)

  const pageRange = computed(() => {
    const total = totalPages.value
    const cur = currentPage.value
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | string)[] = [1]
    if (cur > 3) pages.push('...')
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
      pages.push(i)
    }
    if (cur < total - 2) pages.push('...')
    pages.push(total)
    return pages
  })

  const from = computed(() => (totalItems.value ? (currentPage.value - 1) * pageSize.value + 1 : 0))
  const to = computed(() => Math.min(currentPage.value * pageSize.value, totalItems.value))

  // Methods
  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages.value, page))
    if (clamped === currentPage.value) return
    currentPage.value = clamped
    fetchFn(clamped)
  }

  const prevPage = () => goToPage(currentPage.value - 1)
  const nextPage = () => goToPage(currentPage.value + 1)

  const changeSize = (size: number) => {
    pageSize.value = size
    currentPage.value = 1
    fetchFn(1)
  }

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    pageRange,
    from,
    to,
    goToPage,
    prevPage,
    nextPage,
    changeSize,
  }
}
