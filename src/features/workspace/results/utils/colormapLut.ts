const COLORMAP_TABLE: Record<string, [number, number, number][]> = {
  viridis: [
    [68, 1, 84],
    [72, 35, 116],
    [64, 74, 138],
    [49, 104, 142],
    [38, 130, 142],
    [31, 157, 137],
    [108, 206, 89],
    [254, 231, 37],
  ],
  inferno: [
    [0, 0, 4],
    [40, 11, 84],
    [101, 21, 110],
    [159, 42, 99],
    [212, 72, 66],
    [245, 125, 21],
    [250, 193, 39],
    [252, 255, 164],
  ],
  plasma: [
    [13, 8, 135],
    [70, 3, 159],
    [114, 1, 168],
    [156, 23, 158],
    [189, 55, 134],
    [216, 87, 107],
    [237, 121, 83],
    [253, 180, 47],
  ],
  gray: [
    [0, 0, 0],
    [255, 255, 255],
  ],
}

export function buildLUT(name: string): [number, number, number][] {
  const stops = (COLORMAP_TABLE[name] ?? COLORMAP_TABLE.viridis)!
  const lut: [number, number, number][] = new Array(256)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const segment = t * (stops.length - 1)
    const idx = Math.min(Math.floor(segment), stops.length - 2)
    const frac = segment - idx
    const a = stops[idx]!,
      b = stops[idx + 1]!
    lut[i] = [
      Math.round(a[0] + (b[0] - a[0]) * frac),
      Math.round(a[1] + (b[1] - a[1]) * frac),
      Math.round(a[2] + (b[2] - a[2]) * frac),
    ]
  }
  return lut
}
