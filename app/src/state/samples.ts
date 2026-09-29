// Audio the person recorded or imported. Lives in memory for the open project,
// in IndexedDB between sessions, and in the engine's sample slots.
import { bridgeIfReady, type EngineBridge } from '../engine/bridge';
import type { Project } from './model';

export interface SampleData {
  data: Float32Array;
  sr: number;
  name: string;
}

const SLOTS = 64;
const mem = new Map<number, SampleData>();
let memProject: string | null = null;

const DB_NAME = 'house-audio';
const STORE = 'samples';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sin IndexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const keyOf = (projectId: string, slot: number) => `${projectId}/${slot}`;

export const getSample = (slot: number): SampleData | undefined => mem.get(slot);

export const allSamples = (): Map<number, SampleData> => mem;

/** Slots the project points to: its sampler tracks and its soundboard keys. */
function usedSlots(p: Project): Set<number> {
  const used = new Set<number>();
  for (const t of p.tracks) if (t.sampleSlot !== undefined) used.add(t.sampleSlot);
  for (const item of Object.values(p.soundboard)) if ('slot' in item) used.add(item.slot);
  return used;
}

/** First slot nothing in the project uses. */
export function freeSlot(p: Project): number {
  const used = usedSlots(p);
  for (let i = 0; i < SLOTS; i++) if (!used.has(i)) return i;
  return -1;
}

export async function putSample(projectId: string, slot: number, s: SampleData): Promise<void> {
  if (memProject !== projectId) {
    mem.clear();
    memProject = projectId;
  }
  mem.set(slot, s);
  bridgeIfReady()?.loadSample(slot, s.data, s.sr);
  try {
    await tx('readwrite', (st) => st.put({ data: s.data, sr: s.sr, name: s.name }, keyOf(projectId, slot)));
  } catch {
    // Without storage the sample still works until the app closes.
  }
}

/** Loads the samples of a project into memory and into the engine. */
export async function loadSamplesFor(p: Project): Promise<void> {
  mem.clear();
  memProject = p.id;
  for (const slot of usedSlots(p)) {
    try {
      const v = (await tx('readonly', (st) => st.get(keyOf(p.id, slot)))) as SampleData | undefined;
      if (v && memProject === p.id) {
        mem.set(slot, v);
        bridgeIfReady()?.loadSample(slot, v.data, v.sr);
      }
    } catch {
      // Missing audio: the track stays silent and can be recorded again.
    }
  }
}

export function sendAllSamples(b: EngineBridge): void {
  for (const [slot, s] of mem) b.loadSample(slot, s.data, s.sr);
}

export async function deleteSamplesOf(projectId: string): Promise<void> {
  try {
    const keys = (await tx('readonly', (st) => st.getAllKeys())) as string[];
    for (const k of keys) if (String(k).startsWith(`${projectId}/`)) await tx('readwrite', (st) => st.delete(k));
  } catch {
    // Nothing to clean.
  }
}

/** Mono, trimmed and normalized copy of decoded audio (max 20 s). */
export function prepareAudio(channels: Float32Array[], sr: number, maxSeconds = 20): Float32Array {
  const len = Math.min(channels[0]?.length ?? 0, Math.floor(sr * maxSeconds));
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i] += ch[i] / channels.length;
  // Trim silence at the start (keeps 5 ms before the first sound) and the end.
  const th = 0.01;
  let a = 0;
  while (a < len && Math.abs(mono[a]) < th) a++;
  let b = len - 1;
  while (b > a && Math.abs(mono[b]) < th * 0.5) b--;
  a = Math.max(0, a - Math.floor(sr * 0.005));
  const out = mono.slice(a, Math.min(len, b + Math.floor(sr * 0.05)));
  let peak = 0;
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  if (peak > 0.001) {
    const g = 0.89 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  // Short fades so the cut never clicks.
  const f = Math.min(out.length >> 1, Math.floor(sr * 0.003));
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[out.length - 1 - i] *= i / f;
  }
  return out;
}

export async function decodeFile(file: Blob, ctx?: BaseAudioContext): Promise<{ data: Float32Array; sr: number }> {
  const buf = await file.arrayBuffer();
  const c = ctx ?? new OfflineAudioContext(1, 1, 48000);
  const audio = await c.decodeAudioData(buf);
  const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  return { data: prepareAudio(chans, audio.sampleRate), sr: audio.sampleRate };
}
