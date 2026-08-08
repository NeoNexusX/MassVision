/**
 * Zarr OSS access backend API.
 *
 * Backend endpoint:
 *   GET /processes/{run_id}/zarr
 *
 * Returns an Alibaba Cloud OSS STS token + the zarr directory prefix.
 * The STS token is signed and issued by the backend; the frontend never
 * hardcodes it, and must never print the cleartext in logs.
 */

import { auth_api } from '@/shared/api/httpClient'
import type { ZarrAccessResponse, ZarrType } from '../types/zarr'

/**
 * Fetch the zarr OSS access credentials for a given run.
 * Note: do not console.log the raw response - the STS secret fields
 * (AccessKeySecret, SecurityToken) are sensitive.
 */
export async function getZarrAccess(
  runId: string,
  zarrType: ZarrType = 'algorithm',
): Promise<ZarrAccessResponse> {
  if (!runId) throw new Error('[zarrAccessApi] runId is required')
  const { data } = await auth_api.get<ZarrAccessResponse>(`/processes/${runId}/zarr`, {
    params: { zarr_type: zarrType },
  })
  if (!data?.sts_token?.AccessKeyId) {
    throw new Error('[zarrAccessApi] invalid zarr access response: missing sts_token')
  }
  return data
}
