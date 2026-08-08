import type { FileImagesResponse } from '@/features/datasets/types/dataset'

/** 根据 storage_mode 从 urls 中取出正确的图片 URL */
export function pickImageUrl(images: FileImagesResponse): string {
  const { storage_mode: mode, urls } = images
  const values = Object.values(urls)
  const fallback = values[0] ?? ''

  if (mode === 'continuous') return urls['umap_image.jpg'] || fallback
  if (mode === 'processed')   return urls['tic_image.png']  || fallback
  return fallback
}
