import {
  uploadImzmlZipFileOSS,
  invalidateUploadGeneration,
  cancelOssUpload,
} from '@/features/upload/utils/imzmlOssUpload'
import { parseImzMLMSSettings } from '@/features/upload/utils/imzmlParser'
import type { ImzmlFilePair, UnifiedUploadProgress } from '@/features/upload/utils/imzmlHelper'

export type { ImzmlFilePair, UnifiedUploadProgress }

export const MIN_PUBLIC_IBD_SIZE = 10 * 1024 * 1024

export function parseImzmlUploadMetadata(imzmlFile: File) {
  return parseImzMLMSSettings(imzmlFile)
}

export function uploadImzmlDataset(options: {
  files?: ImzmlFilePair
  datasetName: string
  metadata?: Record<string, any>
  signal: AbortSignal
  resume?: boolean
  onProgress: (progress: UnifiedUploadProgress) => void
}) {
  return uploadImzmlZipFileOSS(options)
}

export function abortImzmlUpload() {
  invalidateUploadGeneration()
  cancelOssUpload()
}
