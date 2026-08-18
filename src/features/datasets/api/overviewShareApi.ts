import { api } from '@/shared/api/httpClient'

/** Shared Overview always uses the anonymous/public client. */
export async function getSharedOverviewMetadata(fileId: string | number) {
  const res = await api.get(`/files/${fileId}/metadata`)
  return res.data
}
