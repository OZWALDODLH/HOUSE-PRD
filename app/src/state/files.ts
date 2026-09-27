// Handing files to the person: a native save dialog in the desktop app, the
// viewer's own save flow when HOUSE runs inside claude.ai, a download link
// in a normal browser tab.
import { isTauri } from '../engine/bridge';
import { isEmbedded } from '../engine/modules';

export type SaveResult = 'saved' | 'declined' | 'unavailable';

interface ViewerDownloads {
  save: (req: { filename: string; data: Blob | string | ArrayBuffer }) => Promise<{ status: string }>;
}

// Formats the claude.ai viewer lets a page save (others go inside a .zip).
const VIEWER_OK = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'txt', 'json', 'md', 'csv', 'html', 'svg', 'pdf', 'zip']);

let viewer: Promise<ViewerDownloads | null> | null = null;

/** The viewer's downloads capability, or null outside claude.ai. */
export function viewerDownloads(): Promise<ViewerDownloads | null> {
  if (!viewer) {
    const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    viewer = claude?.use ? claude.use('downloads').then((d) => (d as ViewerDownloads | null) ?? null, () => null) : Promise.resolve(null);
  }
  return viewer;
}

/** Whether this view can give files to the person at all. */
export async function canSaveFiles(): Promise<boolean> {
  if (isTauri() || !isEmbedded()) return true;
  return (await viewerDownloads()) !== null;
}

export async function saveFile(blob: Blob, name: string): Promise<SaveResult> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ok = await invoke<boolean>('save_file', bytes, { headers: { 'file-name': encodeURIComponent(name) } });
    return ok ? 'saved' : 'declined';
  }
  const dl = await viewerDownloads();
  if (dl) {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const [filename, data] = VIEWER_OK.has(ext) ? [name, blob] : [name.replace(/\.[^.]+$/, '') + '.zip', await zipOne(name, blob)];
    try {
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable';
    }
  }
  if (isEmbedded()) return 'unavailable';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

// ------------------------------------------------------------------ zip --

let table: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A .zip with one file, stored without compression (WAV barely compresses). */
export async function zipOne(name: string, blob: Blob): Promise<Blob> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const fname = new TextEncoder().encode(name);
  const crc = crc32(data);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint16(6, 0x0800, true); // UTF-8 names
  local.setUint16(8, 0, true); // stored
  local.setUint32(14, crc, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, data.length, true);
  local.setUint16(26, fname.length, true);
  const central = new DataView(new ArrayBuffer(46));
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint16(8, 0x0800, true);
  central.setUint16(10, 0, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, data.length, true);
  central.setUint32(24, data.length, true);
  central.setUint16(28, fname.length, true);
  central.setUint32(42, 0, true); // local header at offset 0
  const centralSize = 46 + fname.length;
  const centralOffset = 30 + fname.length + data.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralOffset, true);
  return new Blob([local, fname, data, central, fname, end], { type: 'application/zip' });
}
