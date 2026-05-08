declare module 'ali-oss' {
  interface OssClient {
    put(name: string, file: Blob | File | Buffer, options?: any): Promise<any>;
    // Add other methods as needed
  }

  interface OssOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken?: string;
    authorizationV4?: boolean;
    bucket: string;
    timeout?: number;
  }

  class OSS {
    constructor(options: OssOptions);
    put(name: string, file: Blob | File | Buffer, options?: any): Promise<any>;
    multipartUpload(name: string, file: Blob | File | Buffer, options?: any): Promise<any>;
    abortMultipartUpload(name: string, uploadId: string, options?: any): Promise<any>;
    head(name: string, options?: any): Promise<{ res: { status: number } }>;
  }

  export default OSS;
}
