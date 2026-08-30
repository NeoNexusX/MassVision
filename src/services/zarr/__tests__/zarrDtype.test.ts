import { describe, expect, it } from 'vitest'
import { bytesPerElement, makeTypedArray, normalizeDtype } from '../zarrDtype'

// Uint8Array.buffer 的类型是 ArrayBufferLike（含 SharedArrayBuffer），
// 直接 .buffer 传不进要求 ArrayBuffer 的签名，这里显式构造
function bufOf(...bytes: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length)
  new Uint8Array(buf).set(bytes)
  return buf
}

describe('normalizeDtype', () => {
  it('maps numpy-style dtype strings to canonical names', () => {
    expect(normalizeDtype('<f4')).toBe('float32')
    expect(normalizeDtype('<f8')).toBe('float64')
    expect(normalizeDtype('>f4')).toBe('float32')
    expect(normalizeDtype('>f8')).toBe('float64')
    expect(normalizeDtype('<u4')).toBe('uint32')
    expect(normalizeDtype('<i8')).toBe('int64')
  })

  it('passes canonical names through unchanged', () => {
    expect(normalizeDtype('float32')).toBe('float32')
    expect(normalizeDtype('uint8')).toBe('uint8')
  })
})

describe('bytesPerElement', () => {
  it('returns the element size for every supported dtype', () => {
    expect(bytesPerElement('<f4')).toBe(4)
    expect(bytesPerElement('float64')).toBe(8)
    expect(bytesPerElement('uint8')).toBe(1)
    expect(bytesPerElement('int16')).toBe(2)
    expect(bytesPerElement('uint64')).toBe(8)
  })

  it('throws for unsupported dtypes instead of guessing', () => {
    expect(() => bytesPerElement('<f2')).toThrow(/unsupported dtype/)
  })
})

describe('makeTypedArray', () => {
  it('interprets little-endian bytes with the matching typed array', () => {
    // 1.0 的 float32 表示是 0x3F800000，LE 字节序 [0x00, 0x00, 0x80, 0x3F]
    const f32 = makeTypedArray('<f4', bufOf(0x00, 0x00, 0x80, 0x3f))
    expect(f32).toBeInstanceOf(Float32Array)
    expect(f32[0]).toBe(1.0)

    // int16 按补码解释：0xFFFF -> -1
    const i16 = makeTypedArray('int16', bufOf(0xff, 0xff))
    expect(i16).toBeInstanceOf(Int16Array)
    expect(i16[0]).toBe(-1)

    const u8 = makeTypedArray('uint8', bufOf(1, 2, 3))
    expect(u8).toBeInstanceOf(Uint8Array)
    expect(u8.length).toBe(3)

    const i64 = makeTypedArray('<i8', new ArrayBuffer(8))
    expect(i64).toBeInstanceOf(BigInt64Array)
    expect(i64[0]).toBe(0n)
  })

  it('throws for unsupported dtypes — 历史上这里会退化成空数组、渲染出全透明且无报错的图', () => {
    expect(() => makeTypedArray('<f2', new ArrayBuffer(2))).toThrow(/unsupported dtype/)
    expect(() => makeTypedArray('float16', new ArrayBuffer(2))).toThrow(/unsupported dtype/)
  })
})
