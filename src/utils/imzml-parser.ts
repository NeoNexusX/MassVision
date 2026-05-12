export type ImzMLParam = {
  tagName: 'cvParam' | 'userParam'
  accession?: string
  name: string
  value: string
}

export type ImzMLMSSettings = {
  polarity?: 'positive' | 'negative'
  ionSource?: string
  analyzer?: string
  pixelSizeX?: number
  pixelSizeY?: number
}

function safeNumber(v: any): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = Number((v as any).toString().trim())
  return Number.isFinite(n) ? n : undefined
}

export async function parseImzMLMSSettings(file: File): Promise<ImzMLMSSettings> {
  try {
    const text = await file.text()
    const params = extractParamsFromImzML(text)
    const polarity = parsePolarity(params)
    const ionSource = parseIonSource(params)
    const analyzer = parseAnalyzer(params)
    const { pixelSizeX, pixelSizeY } = parsePixelSize(params)
    return { polarity, ionSource, analyzer, pixelSizeX, pixelSizeY }
  } catch (e) {
    // outermost handler: return empty result on failure to avoid throwing in UI
    return {}
  }
}

// Backwards-compatible wrapper: older code imports `parseImzMLMetadata`.
export async function parseImzMLMetadata(file: File): Promise<ImzMLMSSettings> {
  return parseImzMLMSSettings(file)
}

export function extractParamsFromImzML(xmlText: string): ImzMLParam[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'application/xml')
    if (doc.querySelector('parsererror')) return []
    const out: ImzMLParam[] = []
    const cvNodes = Array.from(doc.getElementsByTagName('cvParam'))
    for (const n of cvNodes) {
      const acc = n.getAttribute('accession') ?? undefined
      const name = (n.getAttribute('name') ?? '').trim()
      const value = (n.getAttribute('value') ?? n.textContent ?? '').trim()
      if (name) out.push({ tagName: 'cvParam', accession: acc, name, value })
    }
    const userNodes = Array.from(doc.getElementsByTagName('userParam'))
    for (const n of userNodes) {
      const name = (n.getAttribute('name') ?? '').trim()
      const value = (n.getAttribute('value') ?? n.textContent ?? '').trim()
      if (name) out.push({ tagName: 'userParam', name, value })
    }
    return out
  } catch {
    return []
  }
}

/* ---------- field parsers (stricted per request) ---------- */

export function parsePolarity(params: ImzMLParam[]): 'positive' | 'negative' | undefined {
  // 1) accession priority
  for (const p of params) {
    const acc = (p.accession || '').toUpperCase()
    if (acc === 'MS:1000130') return 'positive'
    if (acc === 'MS:1000129') return 'negative'
  }
  // 2) strict name fallback (case-insensitive exact match)
  for (const p of params) {
    const name = (p.name || '').toString().trim().toLowerCase()
    if (name === 'positive scan') return 'positive'
    if (name === 'negative scan') return 'negative'
  }
  return undefined
}

export function parseIonSource(params: ImzMLParam[]): string | undefined {
  // 1) accession priority
  for (const p of params) {
    const acc = (p.accession || '').toUpperCase()
    if (acc === 'MS:1000075') return 'MALDI'
    if (acc === 'MS:1000485') return 'DESI'
  }
  // 2) fallback: name or value contains explicit phrases (case-insensitive)
  const phrases = [
    'matrix-assisted laser desorption ionization',
    'desorption electrospray ionization'
  ]
  for (const p of params) {
    const txt = ((p.name || '') + ' ' + (p.value || '')).toString().toLowerCase()
    for (const ph of phrases) {
      if (txt.includes(ph)) {
        if (ph.startsWith('matrix-assisted')) return 'MALDI'
        if (ph.startsWith('desorption electrospray')) return 'DESI'
      }
    }
  }
  return undefined
}

export function parseAnalyzer(params: ImzMLParam[]): string | undefined {
  // 1) accession priority
  for (const p of params) {
    const acc = (p.accession || '').toUpperCase()
    if (acc === 'MS:1000484') return 'Orbitrap'
    if (acc === 'MS:1000079') return 'FTICR'
    if (acc === 'MS:1000264') return 'TOF'
  }
  // 2) fallback: name or value contains explicit analyzer keywords (case-insensitive)
  for (const p of params) {
    const txt = ((p.name || '') + ' ' + (p.value || '')).toString().toLowerCase()
    if (txt.includes('orbitrap')) return 'Orbitrap'
    if (txt.includes('fticr')) return 'FTICR'
    if (txt.includes('time-of-flight') || txt.includes('time of flight')) return 'TOF'
  }
  // 3) final fallback: generic FTMS if present (only if no specific analyzer found)
  for (const p of params) {
    const txt = ((p.name || '') + ' ' + (p.value || '')).toString().toUpperCase()
    if (txt.includes('FTMS')) return 'FTMS'
  }
  return undefined
}

/* m/z range parsing removed — not needed in current UI */

export function parsePixelSize(params: ImzMLParam[]): { pixelSizeX?: number; pixelSizeY?: number } {
  let x: number | undefined
  let y: number | undefined

  // Strict name matching only (case-insensitive exact match after trim)
  for (const p of params) {
    const nameRaw = (p.name || '').toString().trim().toLowerCase()
    if (nameRaw === 'pixel size x') {
      const v = safeNumber(p.value)
      if (v !== undefined) x = v
    } else if (nameRaw === 'pixel size y') {
      const v = safeNumber(p.value)
      if (v !== undefined) y = v
    }
    if (x !== undefined && y !== undefined) break
  }

  return { pixelSizeX: x, pixelSizeY: y }
}

/* helpers */
function extractFirstNumber(p: ImzMLParam): string | undefined {
  const s = (p.value || p.name || '').toString()
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? m[1] : undefined
}

export function findAllNumbers(s: string): string[] {
  const m = s.match(/(\d+(?:\.\d+)?)/g)
  return m ?? []
}
