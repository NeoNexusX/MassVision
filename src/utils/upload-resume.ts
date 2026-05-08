const STORAGE_KEY = 'oss_upload_session';
const OPFS_ZIP_NAME = 'pending_upload.zip';

export interface UploadSession {
  datasetName: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  fileId: string;
  ossPath: string;
  ossBucket: string;
  ossRegion: string;
  stsExpiration: string;
  accessKeyId: string;
  accessKeySecret: string;
  stsToken: string;
  checkpoint: {
    name: string;
    fileSize: number;
    partSize: number;
    uploadId: string;
    doneParts: Array<{ number: number; etag: string }>;
  };
}

export function saveUploadSession(session: UploadSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadUploadSession(): UploadSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (
      !data.checkpoint?.uploadId ||
      !data.ossPath ||
      !data.fileSize ||
      !data.fileHash
    ) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearUploadSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasPendingUpload(): boolean {
  const session = loadUploadSession();
  if (!session) return false;
  if (new Date(session.stsExpiration).getTime() <= Date.now()) {
    clearUploadSession();
    return false;
  }
  return true;
}

export async function saveZipToOPFS(file: File): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(OPFS_ZIP_NAME, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
  } catch (e) {
    console.warn('[OPFS] Failed to save zip file, resume across reloads will not be available:', e);
  }
}

export async function loadZipFromOPFS(): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(OPFS_ZIP_NAME);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function deleteZipFromOPFS(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_ZIP_NAME);
  } catch { /* file may not exist */ }
}

export async function cleanupResumable(): Promise<void> {
  clearUploadSession();
  await deleteZipFromOPFS();
}
