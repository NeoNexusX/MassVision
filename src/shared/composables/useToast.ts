import { ref } from 'vue'

type ToastType = 'info' | 'success' | 'warning' | 'error'
interface Toast {
  id: number
  message: string
  type: ToastType
}

// Module-level state (shared singleton across consumers)
const toasts = ref<Toast[]>([])
let idCounter = 0

export function useToast() {
  // Methods
  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = idCounter++
    toasts.value.push({ id, message, type })

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }

    return id
  }

  return { toasts, showToast, removeToast }
}
