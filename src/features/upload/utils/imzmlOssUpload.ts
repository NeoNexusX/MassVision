import { type ImzmlFilePair, type UnifiedUploadProgress } from './imzmlHelper'
import { prepareUpload, NON_DETERMINISTIC_ZIP } from './imzmlCompress'
import { auth_api } from '@/shared/api/httpClient'
import {
  saveUploadSession,
  loadUploadSession,
  cleanupResumable,
  resetSessionForReupload,
  type UploadSession,
  type UploadSourceIdentity,
} from './uploadResume'
import { openMultipartSession, normalizeEtag, type MultipartUploadSession } from './ossMultipart'
import { abortIntentOf, reasonOf } from './uploadAbort'
import { OSS_UPLOAD, ENV } from '@/shared/config'
import { generateDatasetFilename } from './filenameGenerator'

// POST /files/upload 的返回
export interface OssUploadResponse {
  oss_sts_token: {
    AccessKeyId: string
    AccessKeySecret: string
    SecurityToken: string
    Expiration: string
  }
  oss_bucket: string
  oss_path: string
  oss_region_id: string
}

export interface UploadImzmlOssConfig {
  files?: ImzmlFilePair
  datasetName?: string
  metadata?: Record<string, any>
  signal?: AbortSignal
  onProgress?: (progress: UnifiedUploadProgress) => void
  resume?: boolean
}

export function sourceIdentityOf(pair: ImzmlFilePair): UploadSourceIdentity {
  return {
    imzmlName: pair.imzml.name,
    imzmlSize: pair.imzml.size,
    ibdName: pair.ibd.name,
    ibdSize: pair.ibd.size,
  }
}

/** 名称+大小的即时比对。真正的判据是哈希，这里只是为了尽早给出可读的错误 */
export function sourceMatches(a: UploadSourceIdentity, b: UploadSourceIdentity): boolean {
  return (
    a.imzmlName === b.imzmlName &&
    a.imzmlSize === b.imzmlSize &&
    a.ibdName === b.ibdName &&
    a.ibdSize === b.ibdSize
  )
}

const MISMATCHED_SOURCE =
  'The selected files do not match the pending upload. Pick the same .imzML and .ibd pair, or discard the pending upload.'

/**
 * imzML → OSS 上传流水线（流式，不落本地磁盘）。
 *
 * 阶段 1  Worker 读源文件算 MD5（暂停在压缩之前）
 * 阶段 2  用「原始大小 + 哈希」preflight → file_id；命中秒传直接返回
 * 阶段 3  取 OSS STS 凭证并 initMultipartUpload  ← 必须在压缩之前，因为压缩即上传
 * 阶段 4  压缩产物边生成边切片直传 OSS，压缩端受在途分片数背压
 * 阶段 5  合并分片
 *
 * 断点续传的代价也随之改变：页面刷新后没有缓存的 ZIP，必须请用户重新选择同一
 * 对源文件并重新压缩。已传到 OSS 的分片不会重传 —— 依据是 ZIP 产物可复现
 * （固定的 lastModDate / 压缩参数 / entry 名），并在重新生成第一个已完成分片时
 * 用它的 MD5 与存下来的 ETag 比对来验证这一假设；对不上就整轮作废重来，
 * 绝不会把两次压缩的字节拼到同一个对象上。
 */
/**
 * 一次上传失败之后，会话和 OSS 分片该怎么处置。
 *
 *   discard-session  zip 字节不可复现 —— 这一轮 multipart 已不可信，全部丢弃
 *   reset-parts      用户主动放弃 —— 作废 OSS 分片并清空分片轮次，保留 file_id/STS
 *   keep-session     组件卸载 / 网络失败 / STS 过期 —— 原样保留，供续传
 *
 * 抽成纯函数是因为出错的正是这个判断：旧实现只有「不可复现」和「其它」两支，
 * 用户取消落进了「其它」，于是 persist() 把刚被 abortMultipartUpload 作废的
 * uploadId 和 ETag 又写回了 localStorage，下一次续传必然撞 NoSuchUpload。
 */
export type FailureDisposition = 'discard-session' | 'reset-parts' | 'keep-session'

export function dispositionFor(err: unknown, zipMismatch: boolean): FailureDisposition {
  if (zipMismatch || (err as { message?: unknown } | null)?.message === NON_DETERMINISTIC_ZIP) {
    return 'discard-session'
  }
  if (abortIntentOf(err) === 'user-cancel') return 'reset-parts'
  return 'keep-session'
}

/** 超限文案：UI 预检和管线兜底共用，避免两处措辞不一致 */
export function tooLargeMessage(sourceBytes: number): string {
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`
  return (
    `Dataset is too large: ${gb(sourceBytes)} (imzML + ibd). ` +
    `The maximum per upload is ${gb(OSS_UPLOAD.maxUploadBytes)}.`
  )
}

export async function uploadImzmlZipFileOSS({
  files,
  datasetName = 'mass_dataset',
  metadata = {},
  signal,
  onProgress,
  resume = false,
}: UploadImzmlOssConfig) {
  if (signal?.aborted) throw reasonOf(signal)
  if (!files) throw new Error('No files provided for upload')

  // 体积上限放在算哈希之前 —— 否则会先把整个数据集读一遍才拒绝
  const sourceBytes = files.imzml.size + files.ibd.size
  if (sourceBytes > OSS_UPLOAD.maxUploadBytes) {
    throw new Error(tooLargeMessage(sourceBytes))
  }

  // ---------- 续传会话 ----------
  let session: UploadSession | null = null
  if (resume) {
    session = loadUploadSession()
    if (!session) throw new Error('No pending upload session to resume')
    if (new Date(session.stsExpiration).getTime() <= Date.now()) {
      await cleanupResumable()
      throw new Error('Upload session expired, please start a new upload')
    }
    if (!sourceMatches(session.source, sourceIdentityOf(files))) {
      throw new Error(MISMATCHED_SOURCE)
    }
  }

  // -----------------------------------------------------------
  // 阶段 1：Worker 算哈希（停在压缩之前）
  // -----------------------------------------------------------
  onProgress?.({ stage: 'preflight', percent: 0, message: 'Preparing upload...' })
  const prep = await prepareUpload(files, {
    signal,
    onProgress: (p) =>
      onProgress?.({
        stage: 'preflight',
        percent: p.percent,
        message: 'Preparing upload...',
        speedStr: p.speedStr,
        etaStr: p.etaStr,
      }),
  })
  const fileHash = prep.fileHash

  let fileId: string
  let normalizedFilename: string
  let entryNames: { imzmlName: string; ibdName: string }
  let ossData: OssUploadResponse

  if (session) {
    // 哈希是「是不是同一对文件」的最终判据
    if (fileHash !== session.fileHash) {
      prep.dispose()
      throw new Error(MISMATCHED_SOURCE)
    }
    fileId = session.fileId
    normalizedFilename = session.datasetName || String(datasetName || 'mass_dataset')
    entryNames = session.entryNames
    ossData = {
      oss_sts_token: {
        AccessKeyId: session.accessKeyId,
        AccessKeySecret: session.accessKeySecret,
        SecurityToken: session.stsToken,
        Expiration: session.stsExpiration,
      },
      oss_bucket: session.ossBucket,
      oss_path: session.ossPath,
      oss_region_id: session.ossRegion,
    }
    onProgress?.({ stage: 'uploading', percent: 0, message: 'Resuming upload...' })
  } else {
    // 文件名：{hash6}_{organism}_{part}_{source}_{pixelX}_{polarity}
    normalizedFilename = generateDatasetFilename(metadata, fileHash)

    // -----------------------------------------------------------
    // 阶段 2：preflight（压缩之前做，命中秒传就省掉整个压缩）
    // -----------------------------------------------------------
    onProgress?.({
      stage: 'preflight',
      percent: 100,
      message: 'Checking server for existing file...',
    })

    let preflightData: any
    try {
      const preflightRes = await auth_api.post(
        '/files/preflight',
        {
          filename: normalizedFilename,
          size: files.ibd.size + files.imzml.size,
          file_verify_code: fileHash,
          is_public: metadata.is_public ?? false,
          total_parts: 1,
          ...metadata,
          storage_type: 'oss',
        },
        { signal },
      )
      preflightData = preflightRes.data || preflightRes
      fileId = preflightData.file_id
      if (!fileId) throw new Error('Preflight did not return file_id')
    } catch (err) {
      // worker 正暂停等待 startCompress，不会自行回收
      prep.dispose()
      throw err
    }

    if (preflightData.is_reuse) {
      prep.dispose()
      onProgress?.({
        stage: 'completed',
        percent: 100,
        message: 'File already exists on server, reused.',
      })
      return {
        upload_id: String(fileId),
        fileHash,
        oss_path: '',
        reused: true,
        datasetName: normalizedFilename,
      }
    }

    // -----------------------------------------------------------
    // 阶段 3：取 OSS 凭证（压缩之前 —— 压缩产物直接就要往上传）
    // -----------------------------------------------------------
    onProgress?.({ stage: 'preflight', percent: 100, message: 'Fetching upload credentials...' })
    try {
      const uploadRes = await auth_api.post(
        '/files/upload',
        new URLSearchParams({ filename: normalizedFilename, pre_file_id: String(fileId) }),
      )
      ossData = uploadRes.data || uploadRes
    } catch (err) {
      prep.dispose()
      throw err
    }

    if (!ossData.oss_sts_token || !ossData.oss_bucket || !ossData.oss_path) {
      prep.dispose()
      throw new Error('Backend did not return complete OSS credentials')
    }

    // entry 名参与 zip 字节，必须持久化，续传时原样复用
    entryNames = {
      imzmlName: `${normalizedFilename}.imzML`,
      ibdName: `${normalizedFilename}.ibd`,
    }
  }

  // -----------------------------------------------------------
  // 阶段 4 & 5：边压缩边直传
  // -----------------------------------------------------------
  const clientOptions = {
    region: `oss-${ossData.oss_region_id}`,
    accessKeyId: ossData.oss_sts_token.AccessKeyId,
    accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
    stsToken: ossData.oss_sts_token.SecurityToken,
    authorizationV4: true,
    bucket: ossData.oss_bucket,
    timeout: OSS_UPLOAD.timeout,
    // endpoint is a bare domain (VITE_OSS_ENDPOINT); force https so ali-oss
    // does not fall back to http:// when assembling the request URL
    secure: true,
    ...(ENV.ossEndpoint ? { endpoint: ENV.ossEndpoint } : {}),
  }
  // 延迟加载：只有真正开始上传才需要 ali-oss
  const { default: OSS } = await import('ali-oss')
  const client = new OSS(clientOptions)

  // 续传时片长必须沿用上一轮，否则分片边界对不上已上传的内容
  // uploadId 是否为空，就是「有没有可续的分片轮次」的唯一判据。
  // 用户取消时 resetSessionForReupload() 会把它清空，不需要第二个标志位 ——
  // 两个可能不同步的字段表达同一件事，正是旧实现里那个 bug 的温床。
  const canResumeParts = !!session && !!session.multipart.uploadId
  const partSize = canResumeParts ? session!.multipart.partSize : OSS_UPLOAD.partSize

  // 重试告警要沿用最后一次的百分比，否则每次重试都会把进度条打回 0
  let lastPercent = 0

  let mp: MultipartUploadSession
  try {
    mp = await openMultipartSession(
      client,
      ossData.oss_path,
      canResumeParts
        ? { uploadId: session!.multipart.uploadId, doneParts: session!.multipart.doneParts }
        : undefined,
      {
        signal,
        onRetry: (info) =>
          onProgress?.({
            stage: 'uploading',
            percent: lastPercent,
            message: 'Compressing and uploading...',
            retry: info,
          }),
      },
    )
  } catch (err) {
    prep.dispose()
    throw err
  }

  const persist = () =>
    saveUploadSession({
      datasetName: normalizedFilename,
      fileHash,
      fileId,
      source: sourceIdentityOf(files),
      entryNames,
      ossPath: ossData.oss_path,
      ossBucket: ossData.oss_bucket,
      ossRegion: ossData.oss_region_id || '',
      stsExpiration: ossData.oss_sts_token.Expiration,
      accessKeyId: ossData.oss_sts_token.AccessKeyId,
      accessKeySecret: ossData.oss_sts_token.AccessKeySecret,
      stsToken: ossData.oss_sts_token.SecurityToken,
      multipart: { uploadId: mp.uploadId, partSize, doneParts: mp.doneParts },
    })

  // 立刻落一次盘，哪怕第一片都还没传完就刷新页面也能续
  persist()
  let lastSaveTime = Date.now()

  // 续传校验点：重新生成的第一个已完成分片，用 MD5 对上次的 ETag
  const doneNumbers = mp.doneParts.map((p) => p.number).sort((a, b) => a - b)
  const verifyPartNo = doneNumbers[0] ?? null
  const expectedEtag = mp.doneParts.find((p) => p.number === verifyPartNo)?.etag ?? null
  let zipMismatch = false

  const totalSourceBytes = files.imzml.size + files.ibd.size

  try {
    await prep.startCompress({
      entryNames,
      partSize,
      maxInFlightParts: OSS_UPLOAD.maxInFlightParts,
      maxPartCount: OSS_UPLOAD.maxPartCount,
      donePartNumbers: doneNumbers,
      verifyPartNo,
      onVerify: (_partNo, md5) => {
        const ok = !!expectedEtag && normalizeEtag(md5) === normalizeEtag(expectedEtag)
        if (!ok) zipMismatch = true
        return ok
      },
      onPart: async (partNo, blob) => {
        // 抛 signal.reason 本身，而不是新建一个 AbortError —— 新建会丢掉
        // 中止意图，catch 就没法区分「用户取消」和「组件卸载」
        if (signal?.aborted) throw signal.reason
        await mp.uploadPart(partNo, blob)
        if (Date.now() - lastSaveTime > OSS_UPLOAD.checkpointSaveIntervalMs) {
          lastSaveTime = Date.now()
          persist()
        }
      },
      onProgress: (p) => {
        if (signal?.aborted) return
        lastPercent = p.percent
        // 进度以「已消耗的源字节」为准。背压保证压缩跑不到上传前面超过一个
        // 在途窗口（partSize × maxInFlightParts），所以它同时也是上传进度的忠实代理。
        //
        // 刻意不带 `retry` 字段：undefined 表示「这条消息不携带重试状态」，
        // 只有 ossMultipart 显式传 null 才清除告警。否则重试期间照常流动的
        // 压缩进度会把刚亮起的告警立刻抹掉。
        onProgress?.({
          stage: 'uploading',
          percent: p.percent,
          message: 'Compressing and uploading...',
          speedStr: p.speedStr,
          etaStr: p.etaStr,
        })
      },
    })

    onProgress?.({ stage: 'syncing', percent: 100, message: 'Finalizing upload...' })
    await mp.complete()

    onProgress?.({ stage: 'completed', percent: 100, message: 'Upload complete.' })
    await cleanupResumable()

    return {
      upload_id: String(fileId),
      fileHash,
      oss_path: ossData.oss_path,
      reused: false,
      datasetName: normalizedFilename,
      totalSourceBytes,
    }
  } catch (err: any) {
    // 会话的处置权在这里独占 —— 中止路径不再有第二个所有者。
    switch (dispositionFor(err, zipMismatch)) {
      case 'discard-session':
        // 同下：作废请求丢到后台，不占用户的时间
        void mp.abort().catch(() => {})
        await cleanupResumable()
        throw new Error(
          'The archive could not be reproduced byte-for-byte (the browser or its compression ' +
            'implementation likely changed), so the partial upload was discarded. Please upload again.',
        )

      case 'reset-parts':
        // 不 await：abortMultipartUpload 只是提前释放 OSS 上的分片存储，
        // bucket 的「清理未完成分片」生命周期规则才是最终兜底。让用户对着
        // 「Aborting…」等一个可能吊满 client timeout 的 DELETE 毫无意义 ——
        // 取消恰恰常常发生在网络已经坏掉的时候。
        //
        // 旧实现那个 P0 不是「没 await」造成的，而是会话处置有两个所有者：
        // pipeline 之外 fire-and-forget 地作废分片，pipeline 里又无差别地
        // persist() 把已作废的 uploadId/ETag 写了回去。现在这个 switch 独占
        // 处置权：本支不调 persist()，清空是同步的 localStorage 写、不依赖
        // DELETE 的结果，用户立刻重来也只会 init 出一个全新的 uploadId。
        void mp.abort().catch(() => {})
        resetSessionForReupload()
        throw err

      case 'keep-session':
        persist()
        throw err
    }
  }
}
