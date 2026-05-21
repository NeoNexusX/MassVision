import { ref } from 'vue'

type ToastType = 'info' | 'success' | 'warning' | 'error'
interface Toast {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let idCounter = 0

export function useToast() {
  const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = idCounter++
    toasts.value.push({ id, message, type })

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, showToast, removeToast }
}
