import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { decodePayload, getZstdDecoder } from '../zarrDecode'
import type { ZarrV3ArrayMetadata } from '../types/zarrV3'

// zstd 走 WASM，单测 mock 掉：decode 返回哨兵值 [9,9,9]，
// 以此证明 decodePayload 确实把 zstd codec 路由到了 zstd 解码器
vi.mock('zstddec', () => {
  class ZSTDDecoder {
    init = async () => undefined
    decode = (_payload: Uint8Array) => new Uint8Array([9, 9, 9])
  }
  return { ZSTDDecoder }
})

function metaWithCodec(name?: string): ZarrV3ArrayMetadata {
  return { codecs: name ? [{ name }] : [] } as unknown as ZarrV3ArrayMetadata
}

function bufOf(bytes: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length)
  new Uint8Array(buf).set(bytes)
  return buf
}

/** 用 Node 原生 CompressionStream 压出真实 gzip / zlib 帧 */
async function streamCompress(bytes: number[], format: 'gzip' | 'deflate'): Promise<ArrayBuffer> {
  const stream = new Blob([new Uint8Array(bytes) as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream(format))
  return new Response(stream).arrayBuffer()
}

beforeAll(() => {
  // zarrDecode 用标准 web streams 管道（Blob.stream -> DecompressionStream -> Response）。
  // jsdom 的 Blob 与 Node 的 stream 实现跨 realm 不兼容，统一换成 Node 的 Blob
  vi.stubGlobal('Blob', NodeBlob)
})

describe('decodePayload', () => {
  it('passes raw bytes through when no compression codec is set', async () => {
    const out = await decodePayload(metaWithCodec(), bufOf([1, 2, 3]))
    expect(Array.from(out)).toEqual([1, 2, 3])
  })

  it('passes raw bytes through when codecs is missing entirely', async () => {
    const out = await decodePayload({} as ZarrV3ArrayMetadata, bufOf([4, 5]))
    expect(Array.from(out)).toEqual([4, 5])
  })

  it('decompresses gzip payloads', async () => {
    const gzipped = await streamCompress([10, 20, 30, 40], 'gzip')
    const out = await decodePayload(metaWithCodec('gzip'), gzipped)
    expect(Array.from(out)).toEqual([10, 20, 30, 40])
  })

  it("decompresses zlib payloads via the 'zlib' alias (deflate fallback branch)", async () => {
    // codec 名 'zlib' 不匹配 'gzip'，先试 deflate-raw 失败、再回落到 zlib 包装的 deflate
    const zipped = await streamCompress([1, 1, 2, 3, 5, 8], 'deflate')
    const out = await decodePayload(metaWithCodec('zlib'), zipped)
    expect(Array.from(out)).toEqual([1, 1, 2, 3, 5, 8])
  })

  it('routes zstd payloads through the zstd decoder', async () => {
    const out = await decodePayload(metaWithCodec('zstd'), bufOf([1, 2, 3]))
    // 哨兵返回值：内容变化即证明走了 mock 的 zstd 解码器，而非被当作未压缩数据透传
    expect(Array.from(out)).toEqual([9, 9, 9])
  })
})

describe('getZstdDecoder', () => {
  it('initializes the decoder once and reuses the same promise', () => {
    expect(getZstdDecoder()).toBe(getZstdDecoder())
  })
})
