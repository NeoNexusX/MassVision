/**
 * Generate dataset filename from metadata + hash.
 * Format: {organism}_{organism_part}_{ionSource}_{hash8}
 * Example: Mouse_Brain_MALDI_8f7c2e1a
 *
 * Organism is abbreviated from the config value format "CommonName (ScientificName)",
 * taking only the common name part and removing spaces/punctuation.
 */

export function abbreviateOrganism(name: string): string {
  if (!name) return 'Unknown'
  // Extract common name: "Mouse (Mus musculus)" → "Mouse"
  // "E. coli (Escherichia coli)" → "Ecoli"
  const common = name.split('(')[0]!.trim()
  // Remove spaces and dots for clean filename token
  return common.replace(/[.\s]+/g, '')
}

export function generateDatasetFilename(metadata: Record<string, any>, fileHash: string): string {
  const organism = abbreviateOrganism(metadata.organism || 'Unknown')
  const part = (metadata.organism_part || 'Unknown').replace(/\s+/g, '_')
  const source = (metadata.ionisation_source || 'Unknown').replace(/[-\s]+/g, '_').toUpperCase()
  const hash8 = fileHash.slice(0, 8)
  return `${organism}_${part}_${source}_${hash8}`
}
