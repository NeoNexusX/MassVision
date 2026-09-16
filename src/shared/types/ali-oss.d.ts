/**
 * ali-oss v6.23 浏览器端类型声明。
 *
 * 仅声明项目中实际用到的 API,如有新用法再补充。
 */
declare module 'ali-oss' {
  // ---------- Options ----------

  interface OssOptions {
    region: string
    accessKeyId: string
    accessKeySecret: string
    stsToken?: string
    bucket: string
    /** 使用 HTTPS */
    secure?: boolean
    timeout?: number
    /** v4 签名(推荐开启) */
    authorizationV4?: boolean
    /** 自定义 endpoint(自建/加速域名),不填则由 region 推导 */
    endpoint?: string
  }

  // ---------- 分片上传 ----------

  interface OssInitMultipartResult {
    bucket: string
    name: string
    uploadId: string
  }

  interface OssUploadPartResult {
    /** 形如 `"D41D8CD98F00B204E9800998ECF8427E"`,带引号 */
    etag: string
    res: {
      status: number
      headers: Record<string, string>
    }
  }

  interface OssCompletedPart {
    number: number
    etag: string
  }

  // ---------- 通用返回 ----------

  interface OssGetResult {
    /** 浏览器端为 Blob,Node 端为 Buffer */
    content: Blob | Buffer | ArrayBuffer
    res: {
      status: number
      statusCode: number
      headers: Record<string, string>
      size?: number
      rt?: number
      remoteAddress?: string
    }
  }

  interface OssListResult {
    objects?: Array<{
      name: string
      url?: string
      lastModified?: string
      size?: number
    }>
    prefixes?: string[]
    nextMarker?: string
    isTruncated?: boolean
    res: {
      status: number
      headers: Record<string, string>
    }
  }

  // ---------- 客户端类 ----------

  class OSS {
    constructor(options: OssOptions)

    /** 下载 object,浏览器端返回 Blob */
    get(name: string, options?: object): Promise<OssGetResult>

    /** 上传 object */
    put(name: string, file: Blob | File | Buffer | string, options?: object): Promise<unknown>

    /** 分片上传(一次性传入完整文件,内部自行切片) */
    multipartUpload(name: string, file: Blob | File | Buffer, options?: object): Promise<unknown>

    /** 初始化分片上传,返回 uploadId */
    initMultipartUpload(name: string, options?: object): Promise<OssInitMultipartResult>

    /**
     * 上传单个分片。浏览器端 `file` 接受 File/Blob,内部按 [start, end) 切片。
     * 流式上传时直接传入已经切好的 Blob,配 start=0 / end=blob.size。
     */
    uploadPart(
      name: string,
      uploadId: string,
      partNo: number,
      file: Blob | File | Buffer,
      start: number,
      end: number,
      options?: object,
    ): Promise<OssUploadPartResult>

    /** 合并分片,完成上传 */
    completeMultipartUpload(
      name: string,
      uploadId: string,
      parts: OssCompletedPart[],
      options?: object,
    ): Promise<unknown>

    /** 取消分片上传 */
    abortMultipartUpload(name: string, uploadId: string, options?: object): Promise<unknown>

    /** 获取 object 元信息 */
    head(
      name: string,
      options?: object,
    ): Promise<{
      res: {
        status: number
        statusCode: number
        headers: Record<string, string>
      }
    }>

    /** 列举 object(key=文件名) */
    list(
      query: {
        prefix?: string
        delimiter?: string
        'max-keys'?: string | number
        marker?: string
      },
      options?: object,
    ): Promise<OssListResult>

    /** 生成签名 URL */
    signatureUrl(name: string, options?: object): string
  }

  export default OSS
}
