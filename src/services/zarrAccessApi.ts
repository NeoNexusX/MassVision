/**
 * Zarr OSS access types & backend API.
 *
 * Backend endpoint:
 *   GET /processes/{run_id}/zarr
 *
 * Returns an Alibaba Cloud OSS STS token + the zarr directory prefix.
 * The STS token is signed and issued by the backend; the frontend never
 * hardcodes it, and must never print the cleartext in logs.
 */

import { auth_api } from '@/shared/api/httpClient'

interface ZarrStsToken {
  AccessKeyId: string
  AccessKeySecret: string
  SecurityToken: string
  /** ISO 8601, e.g. "2026-06-02T09:06:20Z" */
  Expiration: string
}

export interface ZarrAccessResponse {
  /** OSS zarr directory prefix, e.g. "processed/run_45.zarr/" */
  folder_path: string
  bucket: string
  /** OSS region, e.g. "cn-hangzhou" */
  region: string
  sts_token: ZarrStsToken
  /** Token lifetime in seconds, as agreed with the backend. */
  expires_in: number
}

/**
 * Fetch the zarr OSS access credentials for a given run.
 * Note: do not console.log the raw response — the STS secret fields
 * (AccessKeySecret, SecurityToken) are sensitive.
 */
export async function getZarrAccess(runId: string): Promise<ZarrAccessResponse> {
  if (!runId) throw new Error('[zarrAccessApi] runId is required')
  const { data } = await auth_api.get<ZarrAccessResponse>(`/processes/${runId}/zarr`)
  if (!data?.sts_token?.AccessKeyId) {
    throw new Error('[zarrAccessApi] invalid zarr access response: missing sts_token')
  }
  return data
}
