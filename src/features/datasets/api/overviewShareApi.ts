import { api } from '@/shared/api/httpClient'
import type { FileImagesResponse } from '@/features/datasets/types/dataset'

/** Shared Overview always uses the anonymous/public client. */
export async function getSharedOverviewMetadata(fileId: string | number) {
  const res = await api.get(`/files/${fileId}/metadata`)
  return res.data
}

/** Shared Overview images always use the anonymous/public client. */
export async function getSharedOverviewImages(
  fileId: string | number,
): Promise<FileImagesResponse> {
  const res = await api.get(`/files/${fileId}/images`)
  return res.data
}
