export function generateMockMatrix(rows: number, cols: number): number[][] {
  const H = rows,
    W = cols,
    cx = W / 2,
    cy = H * 0.46
  function hash(x: number, y: number, seed = 0): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453
    return n - Math.floor(n)
  }
  function smoothNoise(x: number, y: number, scale: number, seed = 0): number {
    const sx = x / scale,
      sy = y / scale,
      ix = Math.floor(sx),
      iy = Math.floor(sy)
    const fx = sx - ix,
      fy = sy - iy
    const sx1 = fx * fx * (3 - 2 * fx),
      sy1 = fy * fy * (3 - 2 * fy)
    const a = hash(ix, iy, seed),
      b = hash(ix + 1, iy, seed),
      c = hash(ix, iy + 1, seed),
      d = hash(ix + 1, iy + 1, seed)
    return a * (1 - sx1) * (1 - sy1) + b * sx1 * (1 - sy1) + c * (1 - sx1) * sy1 + d * sx1 * sy1
  }
  function brainMask(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.42),
      ny = (r - cy) / (H * 0.44)
    const dBase = Math.sqrt(nx * nx + ny * ny)
    const wobble =
      1 + smoothNoise(c, r, 10, 0) * 0.06 + Math.sin(Math.atan2(ny, nx) * 2 + 0.3) * 0.04
    return 1 / (1 + Math.exp((dBase * wobble - 0.9) * 25))
  }
  function cortexSignal(r: number, c: number): number {
    const d = Math.sqrt(((c - cx) / (W * 0.42)) ** 2 + ((r - cy) / (H * 0.44)) ** 2)
    const rim = Math.max(
      0,
      Math.exp(-((1 - d - 0.18) ** 2) / 0.005) * 1.0 +
        Math.exp(-((1 - d - 0.28) ** 2) / 0.01) * 0.6,
    )
    return rim * (0.8 + smoothNoise(c, r, 6, 10) * 0.2)
  }
  function midlineVentricle(r: number, c: number): number {
    const nx = (c - cx) / (W * 0.015),
      ny = (r - (cy + H * 0.02)) / (H * 0.15)
    return Math.exp(-nx * nx * 3.0) * Math.exp(-ny * ny * 1.5)
  }
  function lateralVentricles(r: number, c: number): number {
    let dip = 0
    for (const side of [-1, 1]) {
      const vx = cx + side * W * 0.05,
        vy = cy - H * 0.08
      const nx = (c - vx) / (W * 0.03),
        ny = (r - vy) / (H * 0.03)
      dip += Math.exp(-nx * nx * 2.5) * Math.exp(-ny * ny * 2.5)
    }
    return dip
  }
  function hippocampusSignal(r: number, c: number): number {
    let total = 0
    for (const side of [-1, 1]) {
      const hcx = cx + side * W * 0.16,
        hcy = cy - H * 0.08
      const d = Math.sqrt(((c - hcx) / (W * 0.08)) ** 2 + ((r - hcy) / (H * 0.07)) ** 2)
      total +=
        (Math.exp(-((d - 0.6) ** 2) / 0.05) * 0.8 + Math.exp(-d * d * 1.8) * 0.25) *
        (0.8 + smoothNoise(c, r, 5, 20 + side) * 0.2)
    }
    return total
  }
  function striatumSignal(r: number, c: number): number {
    let total = 0
    for (const side of [-1, 1]) {
      const scx = cx + side * W * 0.11,
        scy = cy + H * 0.06
      const d = Math.sqrt(((c - scx) / (W * 0.07)) ** 2 + ((r - scy) / (H * 0.09)) ** 2)
      total += Math.exp(-d * d * 2.5) * (0.35 + smoothNoise(c, r, 5, 30 + side) * 0.65)
    }
    return total
  }
  const BASE = 1.2e6,
    matrix: number[][] = []
  let gaussSpare = 0,
    gaussHasSpare = false
  function gaussR(): number {
    if (gaussHasSpare) {
      gaussHasSpare = false
      return gaussSpare
    }
    let u = 0,
      v = 0,
      s = 0
    while (s >= 1 || s === 0) {
      u = Math.random() * 2 - 1
      v = Math.random() * 2 - 1
      s = u * u + v * v
    }
    const mag = Math.sqrt((-2 * Math.log(s)) / s)
    gaussSpare = v * mag
    gaussHasSpare = true
    return u * mag
  }
  for (let r = 0; r < H; r++) {
    const row: number[] = []
    for (let c = 0; c < W; c++) {
      const mask = brainMask(r, c)
      const v = 1 - midlineVentricle(r, c) * 0.9 - lateralVentricles(r, c) * 0.85
      let signal =
        (cortexSignal(r, c) * 1.0 + hippocampusSignal(r, c) * 0.7 + striatumSignal(r, c) * 0.4) *
        Math.max(0, v)
      signal += 0.04 * smoothNoise(c, r, 15, 50)
      signal = Math.max(0, signal)
      let intensity = signal * mask * BASE
      intensity += gaussR() * BASE * 0.003
      if (mask < 0.08) intensity = Math.random() * BASE * 0.004
      if (Math.random() < 0.0004 && mask > 0.5) intensity = BASE * (0.8 + Math.random() * 0.2)
      row.push(Math.max(0, intensity))
    }
    matrix.push(row)
  }
  return matrix
}
