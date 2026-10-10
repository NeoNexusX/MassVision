import { OSS_UPLOAD } from '@/shared/config'
import {
  uploadImzmlZipFileOSS,
  tooLargeMessage,
  sourceIdentityOf,
  sourceMatches,
} from '@/features/upload/utils/imzmlOssUpload'
import { parseImzMLMSSettings } from '@/features/upload/utils/imzmlParser'
import type { ImzmlFilePair, UnifiedUploadProgress } from '@/features/upload/utils/imzmlHelper'

export type { ImzmlFilePair, UnifiedUploadProgress }
export { tooLargeMessage }
export { sourceIdentityOf, sourceMatches }

export const MIN_PUBLIC_IBD_SIZE = 10 * 1024 * 1024

/** 单次上传体积上限（源文件 imzML + ibd 之和） */
export const MAX_UPLOAD_BYTES = OSS_UPLOAD.maxUploadBytes

export function parseImzmlUploadMetadata(imzmlFile: File) {
  return parseImzMLMSSettings(imzmlFile)
}

export function uploadImzmlDataset(options: {
  /** 续传同样需要源文件：流式上传不缓存 ZIP，必须重新压缩 */
  files: ImzmlFilePair
  datasetName: string
  metadata?: Record<string, any>
  signal: AbortSignal
  resume?: boolean
  onProgress: (progress: UnifiedUploadProgress) => void
}) {
  return uploadImzmlZipFileOSS(options)
}
