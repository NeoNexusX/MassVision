import type { ImzmlFilePair } from './imzml-helper';

/** Conservative estimate: ibd binary data compresses poorly, imzml XML compresses well */
export function estimateZipSize(pair: ImzmlFilePair): number {
  return pair.ibd.size * 0.9 + pair.imzml.size * 0.15 + 2048;
}

export async function checkStorageQuota(pair: ImzmlFilePair): Promise<void> {
  const estimated = estimateZipSize(pair);
  if (!navigator.storage?.estimate) return
  const { quota, usage } = await navigator.storage.estimate();
  const available = (quota ?? 0) - (usage ?? 0);

  if (estimated > available) {
    const estMB = (estimated / 1048576).toFixed(0);
    const availMB = (available / 1048576).toFixed(0);
    throw new Error(
      `Insufficient storage: estimated ${estMB} MB needed, but only ${availMB} MB available. ` +
      `Please free up disk space or use a smaller dataset.`
    );
  }
}
