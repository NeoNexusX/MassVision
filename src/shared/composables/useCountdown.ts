import { ref, onUnmounted, computed } from 'vue'

export function useCountdown(
  initialCount = 60,
  storageKey = 'countdown_attempts',
  maxAttempts = 3,
) {
  const count = ref(initialCount)
  const isActive = ref(false)
  const attempts = ref(0)

  if (storageKey) {
    const savedAttempts = sessionStorage.getItem(storageKey)
    if (savedAttempts) {
      attempts.value = parseInt(savedAttempts, 10) || 0
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null

  const cstart = () => {
    if (isActive.value || attempts.value >= maxAttempts) return

    isActive.value = true
    count.value = initialCount

    attempts.value++
    if (storageKey) {
      sessionStorage.setItem(storageKey, attempts.value.toString())
    }

    timer = setInterval(() => {
      count.value--
      if (count.value <= 0) {
        stop()
      }
    }, 1000)
  }

  const stop = () => {
    isActive.value = false
    count.value = initialCount
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const resetAttempts = () => {
    attempts.value = 0
    if (storageKey) {
      sessionStorage.removeItem(storageKey)
    }
  }

  // Automatically clear the interval on component unmount to prevent memory leaks
  onUnmounted(() => {
    stop()
  })

  return {
    count,
    isActive,
    attempts,
    maxAttempts,
    isExhausted: computed(() => attempts.value >= maxAttempts),
    start: cstart,
    stop,
    resetAttempts,
  }
}
