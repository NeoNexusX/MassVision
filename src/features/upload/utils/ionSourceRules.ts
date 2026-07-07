/**
 * Ion source normalization and dynamic field rule resolution for the upload form.
 *
 * Family definitions live in `public/config.json` → `ionSourceFieldRules`.
 * This module only contains the matching logic; adding a new ion source family
 * is a pure config change.
 */

import { getConfig } from '@/shared/config/runtimeConfig'

function normalize(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[–—_]+/g, '-')
    .replace(/\s+/g, '-')
}

function resolveKey(ionSource: string): string {
  const source = normalize(ionSource)
  if (!source || source === 'other') return 'unknown'

  for (const family of getConfig().ionSourceFieldRules.families) {
    if (family.match.some((p) => source.includes(p))) {
      return family.key
    }
  }

  return 'unknown'
}

export function getIonSourceFieldRules(ionSource: string) {
  const { defaults: defs, families } = getConfig().ionSourceFieldRules
  const key = resolveKey(ionSource)
  const family = families.find((f) => f.key === key)

  return {
    solvent: {
      ...defs.solvent,
      ...(family?.solvent ?? {}),
    },
    maldiMatrix: {
      ...defs.maldiMatrix,
      ...(family?.maldiMatrix ?? {}),
    },
    maldiMatrixApplication: {
      ...defs.maldiMatrixApplication,
      ...(family?.maldiMatrixApplication ?? {}),
    },
  }
}
