import { Zip, ZipDeflate } from 'fflate';
import { createMD5 } from 'hash-wasm';

type WorkerMessage = {
  type: 'start';
  imzml: File;
  ibd: File;
  chunkSize: number;
};

function readChunk(file: File, offset: number, size: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file.slice(offset, offset + size));
  });
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { imzml, ibd, chunkSize } = e.data;
  let aborted = false;

  try {
    // ── 1. Create MD5 hasher ──
    const hasher = await createMD5();

    // ── 2. Create ZIP ──
    const zip = new Zip();
    const compressedChunks: Uint8Array[] = [];
    zip.ondata = (err, data, _final) => {
      if (err) throw err;
      compressedChunks.push(new Uint8Array(data));
    };

    // ── 3. Open OPFS writable ──
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle('pending_upload.zip', { create: true });
    const writable = await fileHandle.createWritable();

    // ── 4. Process files: imzml → ibd ──
    const files = [imzml, ibd];
    const totalBytes = imzml.size + ibd.size;
    let loadedBytes = 0;

    for (const file of files) {
      const deflate = new ZipDeflate(file.name, { level: 1 });
      (deflate as any).mtime = new Date('2026-01-01');
      zip.add(deflate);

      let offset = 0;
      while (offset < file.size) {
        if (aborted) return;
        const size = Math.min(chunkSize, file.size - offset);
        const buf = await readChunk(file, offset, size);
        const chunk = new Uint8Array(buf);

        hasher.update(chunk);
        deflate.push(chunk, false);

        offset += size;
        loadedBytes += size;
        self.postMessage({ type: 'progress', loaded: loadedBytes, total: totalBytes });
      }

      deflate.push(new Uint8Array(0), true);
    }

    // ── 5. Finalize ZIP ──
    zip.end();

    // ── 6. Finalize hash ──
    const hash = hasher.digest();

    // ── 7. Write compressed data to OPFS ──
    for (const chunk of compressedChunks) {
      await writable.write(new Uint8Array(chunk));
    }
    await writable.close();

    // ── 8. Done ──
    const totalCompressed = compressedChunks.reduce((sum, c) => sum + c.length, 0);
    self.postMessage({ type: 'done', hash, totalBytes: totalCompressed });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
