import { describe, expect, it } from 'vitest'
import { readFullArray } from '../zarrReader'
import { computeNDChunkKey } from '../zarrMetadata'
import type { ZarrV3ArrayMetadata } from '../types/zarrV3'

/**
 * readFullArray 的 chunk 拼装往返测试。
 *
 * zarr v3 规范要求边缘 chunk 按实际大小（不填充）存储，但后端写入方会把
 * 每个 chunk 填充到完整 chunk_shape（UMAP 蓝底纹 bug 的根因：(n,3) 数组配
 * (m,2) chunk 时，最后一维的填充值与真值交错）。读取器按 payload 实际字节
 * 数自动识别两种布局，这里对两种布局各做一轮"合成 chunk → readFullArray →
 * 与原数组逐元素相等"的验证。
 */

function makeMeta(shape: number[], chunkShape: number[]): ZarrV3ArrayMetadata {
  return {
    shape,
    data_type: 'float32',
    chunk_grid: { name: 'regular', configuration: { chunk_shape: chunkShape } },
    chunk_key_encoding: { name: 'default', configuration: { separator: '/' } },
    fill_value: 0,
    codecs: [{ name: 'bytes', configuration: { endian: 'little' } }],
    zarr_format: 3,
    node_type: 'array',
    storage_transformers: [],
  } as unknown as ZarrV3ArrayMetadata
}

/**
 * 按 chunk 网格坐标切一块数据。`padded` = 写入方把这块存储成完整
 * chunk_shape（边缘填 fill），否则按规范存实际大小。
 */
function buildChunk(
  full: Float32Array,
  shape: number[],
  chunkShape: number[],
  coords: number[],
  padded: boolean,
): Uint8Array {
  const ndim = shape.length
  const origin = coords.map((c, d) => c * chunkShape[d]!)
  const actual = coords.map((c, d) => Math.min(chunkShape[d]!, shape[d]! - origin[d]!))
  const lens = padded ? chunkShape : actual
  const out = new Float32Array(lens.reduce((a, b) => a * b, 1)).fill(-999)
  const strides = new Array<number>(ndim)
  strides[ndim - 1] = 1
  for (let i = ndim - 2; i >= 0; i--) strides[i] = strides[i + 1]! * lens[i + 1]!
  const fullStrides = new Array<number>(ndim)
  fullStrides[ndim - 1] = 1
  for (let i = ndim - 2; i >= 0; i--) fullStrides[i] = fullStrides[i + 1]! * shape[i + 1]!

  const outerCount = actual.slice(0, -1).reduce((a, b) => a * b, 1)
  for (let r = 0; r < outerCount; r++) {
    let rem = r
    let chunkOff = 0
    let fullOff = 0
    for (let d = ndim - 2; d >= 0; d--) {
      const coord = rem % actual[d]!
      rem = Math.floor(rem / actual[d]!)
      chunkOff += coord * strides[d]!
      fullOff += (origin[d]! + coord) * fullStrides[d]!
    }
    fullOff += origin[ndim - 1]!
    for (let e = 0; e < actual[ndim - 1]!; e++) out[chunkOff + e] = full[fullOff + e]!
  }
  return new Uint8Array(out.buffer, 0, out.byteLength)
}

/** 合成数组 + 两种布局的 chunk 存储，跑 readFullArray 并逐元素比对。 */
async function expectRoundTrip(
  shape: number[],
  chunkShape: number[],
  padded: boolean,
): Promise<void> {
  const meta = makeMeta(shape, chunkShape)
  const n = shape.reduce((a, b) => a * b, 1)
  // 每个元素唯一：任何错位/取到填充值都无法通过
  const full = new Float32Array(n)
  for (let i = 0; i < n; i++) full[i] = i + 0.5

  const chunkCounts = shape.map((s, i) => Math.ceil(s / chunkShape[i]!))
  const store = new Map<string, Uint8Array>()
  const enumerate = (d: number, acc: number[]) => {
    if (d === shape.length) {
      const coords = [...acc]
      store.set(
        computeNDChunkKey(meta, coords),
        buildChunk(full, shape, chunkShape, coords, padded),
      )
      return
    }
    for (let i = 0; i < chunkCounts[d]!; i++) {
      acc[d] = i
      enumerate(d + 1, acc)
    }
  }
  enumerate(0, new Array(shape.length).fill(0))

  const out = await readFullArray(meta, 'test', async (coords) => {
    const chunk = store.get(computeNDChunkKey(meta, coords))
    if (!chunk) throw new Error(`missing chunk ${computeNDChunkKey(meta, coords)}`)
    return chunk
  })
  const view = new Float32Array(out.buffer, out.byteOffset, n)
  expect(Array.from(view)).toEqual(Array.from(full))
}

describe('readFullArray chunk reassembly', () => {
  // UMAP 蓝底纹 bug 的确切布局：(n,3) 数组 + (m,2) chunk，最后一维边缘
  it('assembles last-dim edge chunks in spec-compliant unpadded layout', async () => {
    await expectRoundTrip([59071, 3], [29536, 2], false)
  })

  it('assembles last-dim edge chunks in padded-to-chunk_shape layout', async () => {
    await expectRoundTrip([59071, 3], [29536, 2], true)
  })

  it('assembles row-edge chunks (axes/coordinates layout) in both layouts', async () => {
    await expectRoundTrip([59071, 2], [29536, 2], false)
    await expectRoundTrip([59071, 2], [29536, 2], true)
  })

  it('assembles interior-only chunk grids in both layouts', async () => {
    await expectRoundTrip([100, 4], [50, 4], false)
    await expectRoundTrip([100, 4], [50, 4], true)
  })

  it('assembles single-chunk arrays', async () => {
    await expectRoundTrip([37, 5], [37, 5], false)
  })

  it('assembles 3D arrays with edges in multiple dims in both layouts', async () => {
    await expectRoundTrip([70, 5, 3], [32, 2, 2], false)
    await expectRoundTrip([70, 5, 3], [32, 2, 2], true)
    await expectRoundTrip([65, 7, 5], [32, 4, 3], true)
  })

  it('assembles 1D multi-chunk arrays in both layouts', async () => {
    await expectRoundTrip([1000], [300], false)
    await expectRoundTrip([1000], [300], true)
  })

  it('reads a single oversized padded chunk (chunk_shape > shape) correctly', async () => {
    // 病态配置：chunk_shape 两维都大于 shape，写入方按 chunk_shape 填充。
    // 快速路径不直接返回，走通用拼装逻辑（会重新 fetch 一次）。
    const shape = [10, 3]
    const chunkShape = [16, 4]
    const full = new Float32Array(30)
    for (let i = 0; i < 30; i++) full[i] = i
    const meta = makeMeta(shape, chunkShape)
    const paddedChunk = new Float32Array(16 * 4).fill(-999)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 3; c++) paddedChunk[r * 4 + c] = full[r * 3 + c]!
    }
    const out = await readFullArray(meta, 'oversized', async () => new Uint8Array(paddedChunk.buffer))
    const view = new Float32Array(out.buffer, out.byteOffset, 30)
    expect(Array.from(view)).toEqual(Array.from(full))
  })
})
