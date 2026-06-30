import type { ImzmlFilePair } from './imzmlHelper'

/** Conservative estimate: ibd binary data compresses poorly, imzml XML compresses well */
function estimateZipSize(pair: ImzmlFilePair): number {
  return pair.ibd.size * 0.9 + pair.imzml.size * 0.15 + 2048
}

export async function checkStorageQuota(pair: ImzmlFilePair): Promise<void> {
  const estimated = estimateZipSize(pair)
  if (!navigator.storage?.estimate) return
  const { quota, usage } = await navigator.storage.estimate()
  const available = (quota ?? 0) - (usage ?? 0)

  if (estimated > available) {
    const estMB = (estimated / 1048576).toFixed(0)
    const availMB = (available / 1048576).toFixed(0)
    throw new Error(
      `Insufficient browser storage: this upload needs ~${estMB} MB, but only ${availMB} MB is available in your browser's temporary storage. ` +
        `Please close other tabs, clear browser cache, or use a smaller dataset.`,
    )
  }
}
