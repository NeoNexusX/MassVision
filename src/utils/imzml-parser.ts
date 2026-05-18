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
  spectrum_mode?: 'profile' | 'centroid'
  storage_mode?: 'continuous' | 'processed'
}

function safeNumber(v: any): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = Number((v as any).toString().trim())
  return Number.isFinite(n) ? n : undefined
}

async function readHeadText(file: File): Promise<string> {
  const sizes = [2 * 1024 * 1024, 5 * 1024 * 1024, 10 * 1024 * 1024]
  for (const size of sizes) {
    if (size >= file.size) return file.text()
    const text = await file.slice(0, size).text()
    if (text.includes('<cvParam') || text.includes('<userParam')) return text
  }
  // Even if tags not found in head, return the 10MB slice — string matching can use it
  return file.slice(0, sizes[sizes.length - 1]).text()
}

export async function parseImzMLMSSettings(file: File): Promise<ImzMLMSSettings> {
  try {
    const text = await readHeadText(file)

    // Validate: check for known imzML structural tags
    const structuralTags = ['<mzML', '<fileDescription', '<run', '<spectrumList']
    const hasStructure = structuralTags.some(tag => text.includes(tag))
    if (!hasStructure) {
      throw new Error('File does not appear to be a valid imzML')
    }

    const params = extractParamsFromImzML(text)
    return {
      polarity: parsePolarity(params),
      ionSource: parseIonSource(params),
      analyzer: parseAnalyzer(params),
      ...parsePixelSize(params),
      spectrum_mode: parseSpectrumMode(text),
      storage_mode: parseStorageMode(text),
    }
  } catch {
    return {}
  }
}

// Backwards-compatible wrapper: older code imports `parseImzMLMetadata`.
export async function parseImzMLMetadata(file: File): Promise<ImzMLMSSettings> {
  return parseImzMLMSSettings(file)
}

/**
 * Extract cvParam and userParam from XML text using regex.
 * Works with partial (truncated) XML — no DOMParser required.
 */
export function extractParamsFromImzML(xmlText: string): ImzMLParam[] {
  const out: ImzMLParam[] = []
  try {
    // Match self-closing cvParam tags: <cvParam accession="..." name="..." value="..."/>
    const cvRe = /<cvParam\s+([^>]*?)\s*\/>/gi
    let m: RegExpExecArray | null
    while ((m = cvRe.exec(xmlText)) !== null) {
      const attrs = m[1]!
      const acc = extractAttr(attrs, 'accession')
      const name = extractAttr(attrs, 'name')
      const value = extractAttr(attrs, 'value')
      if (name) out.push({ tagName: 'cvParam', accession: acc || undefined, name, value })
    }
    // Match self-closing userParam tags
    const userRe = /<userParam\s+([^>]*?)\s*\/>/gi
    while ((m = userRe.exec(xmlText)) !== null) {
      const attrs = m[1]!
      const name = extractAttr(attrs, 'name')
      const value = extractAttr(attrs, 'value')
      if (name) out.push({ tagName: 'userParam', name, value })
    }
  } catch { /* ignore */ }
  return out
}

function extractAttr(attrs: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')
  const m = attrs.match(re)
  return m ? m[1]!.trim() : ''
}

/* ---------- field parsers (strict per request) ---------- */

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

export function parseSpectrumMode(text: string): 'profile' | 'centroid' | undefined {
  if (text.includes('MS:1000127')) return 'centroid'
  if (text.includes('MS:1000128')) return 'profile'
  return undefined
}

export function parseStorageMode(text: string): 'continuous' | 'processed' | undefined {
  if (text.includes('IMS:1000030')) return 'continuous'
  if (text.includes('IMS:1000031')) return 'processed'
  return undefined
}
