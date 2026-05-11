import { Zip, ZipDeflate } from 'fflate';

type WorkerMessage =
  | { type: 'start'; name: string }
  | { type: 'chunk'; data: ArrayBuffer }
  | { type: 'end_file' }
  | { type: 'finish' };

const zip = new Zip();
let loadedBytes = 0;

zip.ondata = (err, data, final) => {
  if (err) {
    self.postMessage({ type: 'error', message: err.message });
    return;
  }
  // Transfer the buffer to avoid copying
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  self.postMessage({ type: 'data', data: buf }, { transfer: [buf] });
  if (final) {
    self.postMessage({ type: 'done' });
  }
};

let currentDeflate: ZipDeflate | null = null;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'start': {
      currentDeflate = new ZipDeflate(msg.name, { level: 1 });
      (currentDeflate as any).mtime = new Date('2026-01-01');
      zip.add(currentDeflate);
      break;
    }

    case 'chunk': {
      if (!currentDeflate) return;
      currentDeflate.push(new Uint8Array(msg.data), false);
      loadedBytes += msg.data.byteLength;
      self.postMessage({ type: 'progress', loaded: loadedBytes });
      break;
    }

    case 'end_file': {
      if (!currentDeflate) return;
      currentDeflate.push(new Uint8Array(0), true);
      currentDeflate = null;
      break;
    }

    case 'finish': {
      zip.end();
      break;
    }
  }
};
