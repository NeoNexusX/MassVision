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

    /** 分片上传 */
    multipartUpload(
      name: string,
      file: Blob | File | Buffer,
      options?: object,
    ): Promise<unknown>

    /** 取消分片上传 */
    abortMultipartUpload(
      name: string,
      uploadId: string,
      options?: object,
    ): Promise<unknown>

    /** 获取 object 元信息 */
    head(name: string, options?: object): Promise<{
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
