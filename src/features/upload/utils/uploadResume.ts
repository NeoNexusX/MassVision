import type { DonePart } from './ossMultipart'

const STORAGE_KEY = 'oss_upload_session'
/** 旧版本（落盘 OPFS 再整体上传）留下的缓存文件，仅用于清理 */
const LEGACY_OPFS_ZIP_NAME = 'pending_upload.zip'

/** 源文件身份，用于续传时确认用户重新选择的是同一对文件 */
export interface UploadSourceIdentity {
  imzmlName: string
  imzmlSize: number
  ibdName: string
  ibdSize: number
}

export interface UploadSession {
  datasetName: string
  fileHash: string
  fileId: string
  /**
   * 续传需要重新压缩，因此必须记住源文件身份和最终 entry 名 ——
   * entry 名参与 zip 字节，换了名字产物就对不上已上传的分片。
   */
  source: UploadSourceIdentity
  entryNames: { imzmlName: string; ibdName: string }
  ossPath: string
  ossBucket: string
  ossRegion: string
  stsExpiration: string
  accessKeyId: string
  accessKeySecret: string
  stsToken: string
  multipart: {
    uploadId: string
    partSize: number
    doneParts: DonePart[]
  }
}

export function saveUploadSession(session: UploadSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadUploadSession(): UploadSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    // `multipart` 是流式上传引入的字段；旧格式（OPFS 缓存 + checkpoint）缺少它，直接丢弃。
    // 注意这里不能要求 uploadId 非空 —— 用户取消后 resetSessionForReupload() 会把它清空，
    // 但会话本身仍然有效（保留 file_id 与 STS，下次续传重开一轮 multipart）。
    if (!data.fileId || !data.ossPath || !data.fileHash) return null
    if (!data.source || !Array.isArray(data.multipart?.doneParts)) return null
    return data
  } catch {
    return null
  }
}

function clearUploadSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasPendingUpload(): boolean {
  const session = loadUploadSession()
  if (!session) return false
  if (new Date(session.stsExpiration).getTime() <= Date.now()) {
    clearUploadSession()
    return false
  }
  return true
}

/**
 * 删除旧版本遗留在 OPFS 里的压缩缓存。
 *
 * 流式上传不再写 OPFS，但从旧版本升上来的用户浏览器里可能还躺着一个和数据集
 * 同量级的 zip（数 GB），必须主动回收。
 */
async function deleteLegacyOpfsZip(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(LEGACY_OPFS_ZIP_NAME)
  } catch {
    /* 文件不存在，或浏览器不支持 OPFS */
  }
}

export async function cleanupResumable(): Promise<void> {
  clearUploadSession()
  await deleteLegacyOpfsZip()
}

/** 重置分片进度，让续传重新开一轮 OSS multipart（保留 STS 凭证与 file_id） */
export function resetSessionForReupload(): void {
  const session = loadUploadSession()
  if (!session) return
  session.multipart = { uploadId: '', partSize: session.multipart.partSize, doneParts: [] }
  saveUploadSession(session)
}
