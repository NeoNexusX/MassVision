import { describe, expect, it } from 'vitest'
import { computeFitTransform, fitPointToMatrixCell, IMAGE_PAD } from '../fitTransform'

// 注意：avail = W * (1 - IMAGE_PAD*2) 有浮点误差（500 * 0.92 = 459.999...），
// drawW/drawH 再过 floor，所以期望值是 459 而不是 460——按实现的真实输出锁定
describe('computeFitTransform', () => {
  it('centers a square matrix with symmetric padding', () => {
    const t = computeFitTransform(500, 500, 100, 100)
    expect(t.scaleVal).toBeCloseTo(4.6)
    expect(t.drawW).toBe(459)
    expect(t.drawH).toBe(459)
    expect(t.ox).toBe(20)
    expect(t.oy).toBe(20)
  })

  it('scales by the constraining axis and centers the other dimension', () => {
    // 宽是限制轴：460/200 = 2.3 < 高度方向的 276/50 = 5.52
    const t = computeFitTransform(500, 300, 200, 50)
    expect(t.scaleVal).toBeCloseTo(2.3)
    expect(t.drawW).toBe(459)
    expect(t.drawH).toBe(114)
    expect(t.ox).toBe(20)
    expect(t.oy).toBe(93)
  })

  it('never lets the drawn image exceed the padded area', () => {
    const t = computeFitTransform(373, 619, 97, 421)
    expect(t.drawW).toBeLessThanOrEqual(Math.floor(373 * (1 - IMAGE_PAD * 2)))
    expect(t.drawH).toBeLessThanOrEqual(Math.floor(619 * (1 - IMAGE_PAD * 2)))
    expect(t.ox).toBeGreaterThanOrEqual(373 * IMAGE_PAD - 1)
    expect(t.oy).toBeGreaterThanOrEqual(619 * IMAGE_PAD - 1)
  })
})

describe('fitPointToMatrixCell', () => {
  const W = 500
  const H = 300
  const cols = 200
  const rows = 50
  const t = computeFitTransform(W, H, cols, rows)

  it('maps the image origin to cell (0, 0)', () => {
    expect(fitPointToMatrixCell(t.ox, t.oy, t, cols, rows)).toEqual({ col: 0, row: 0 })
  })

  it('maps the container center to the matrix center', () => {
    const center = fitPointToMatrixCell(W / 2, H / 2, t, cols, rows)
    expect(center.col).toBe(Math.floor(cols / 2))
    expect(center.row).toBe(Math.floor(rows / 2))
  })

  it('maps the last in-image pixel to the last cell', () => {
    const corner = fitPointToMatrixCell(t.ox + t.drawW - 1, t.oy + t.drawH - 1, t, cols, rows)
    expect(corner).toEqual({ col: cols - 1, row: rows - 1 })
  })

  it('round-trips: every cell center maps back to its own cell', () => {
    for (let col = 0; col < cols; col += 17) {
      for (let row = 0; row < rows; row += 7) {
        const cx = t.ox + ((col + 0.5) / cols) * t.drawW
        const cy = t.oy + ((row + 0.5) / rows) * t.drawH
        expect(fitPointToMatrixCell(cx, cy, t, cols, rows)).toEqual({ col, row })
      }
    }
  })
})
