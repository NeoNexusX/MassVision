// ── PubChem PUG REST API types ──

/** A single compound result from PubChem, with all fields we display. */
export interface PubChemCompound {
  cid: number
  title: string
  molecularFormula: string
  molecularWeight: number
  iupacName: string
  /** PubChem's preferred SMILES representation, with an isomeric fallback. */
  smiles: string
  inchi: string
  inchiKey: string
  /** Direct URL to the compound's PubChem page. */
  pubchemUrl: string
  /** URL to the 2D structure image (PNG) for this CID. */
  structureImageUrl: string
}

/** Error thrown when PubChem returns no results for a query. */
export class PubChemNotFoundError extends Error {
  constructor(query: string) {
    super(`No PubChem results for "${query}".`)
    this.name = 'PubChemNotFoundError'
  }
}
