// "Exportar canción": renders the project offline (faster than real time)
// with the same engine and writes a WAV file.
import workerSource from './render-worker.js?raw';
import wasmUrl from './house_engine.wasm?url';
import { MASTER, SECTION_KIND, cmd, type Cmd } from './protocol';
import { projectCmds, sectionCmds } from './sync';
import { makeWorker } from './modules';
import { allSamples } from '../state/samples';
import { barsToSeconds, patternBars, songBars } from '../state/store';
import type { Project } from '../state/model';

export interface RenderOptions {
  what: 'cancion' | 'loop';
  /** Loop length in bars (only for `loop`). */
  loopBars?: number;
  sampleRate?: number;
  onProgress?: (v: number) => void;
}

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

let fetched: Promise<ArrayBuffer> | null = null;

function engineBytes(): Promise<ArrayBuffer> {
  if (!fetched) {
    fetched = fetch(wasmUrl).then((r) => r.arrayBuffer());
    fetched.catch(() => (fetched = null));
  }
  return fetched;
}

const TAIL_BARS = 2;

/** Bars that will be rendered (without the tail). */
export function renderBars(p: Project, o: RenderOptions): number {
  return o.what === 'cancion' ? songBars(p) : (o.loopBars ?? Math.max(4, patternBars(p)));
}

/** Commands for the offline engine: song mode, a silent section for tails. */
export function renderCmds(p: Project, o: RenderOptions): Cmd[] {
  const out = projectCmds({ ...p, mode: 'cancion', metronome: false });
  const silent = { bars: TAIL_BARS, mask: 0, kind: SECTION_KIND.none };
  if (o.what === 'loop') {
    // Risers and impacts wait for a section change, which a loop never has.
    const mask = p.tracks.reduce((m, t, i) => (t.once ? m : m | (1 << i)), 0);
    out.push(cmd.sectionCount(2), cmd.section(0, renderBars(p, o), mask, SECTION_KIND.none), cmd.section(1, silent.bars, 0, silent.kind));
  } else {
    out.push(...sectionCmds(p, [silent]));
  }
  out.push(cmd.master(MASTER.CUE_TO_MASTER, 0), cmd.seek(0), cmd.play());
  return out;
}

export async function renderProject(p: Project, o: RenderOptions): Promise<Rendered> {
  const sampleRate = o.sampleRate ?? 44100;
  const bars = renderBars(p, o);
  const frames = Math.ceil((barsToSeconds(bars + TAIL_BARS, p.bpm) * sampleRate) / 128) * 128;
  const bytes = await engineBytes();
  const worker = makeWorker(workerSource);
  const samples = [...allSamples()].map(([slot, s]) => ({ slot, sr: s.sr, data: s.data }));
  const cmds = renderCmds(p, o);
  try {
    const result = await new Promise<Rendered>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === 'progress') o.onProgress?.(m.value);
        else if (m.type === 'done') resolve({ left: m.left, right: m.right, sampleRate });
        else if (m.type === 'error') reject(new Error(m.message));
      };
      worker.onerror = (e) => reject(new Error(e.message));
      worker.postMessage({ bytes, sampleRate, frames, cmds, samples });
    });
    return trimTail(result, barsToSeconds(bars, p.bpm));
  } finally {
    worker.terminate();
  }
}

/** Keeps the musical length plus the natural tail of reverbs and delays. */
function trimTail(r: Rendered, musicSeconds: number): Rendered {
  const start = Math.floor(musicSeconds * r.sampleRate);
  let end = r.left.length;
  const th = 10 ** (-72 / 20);
  while (end > start && Math.abs(r.left[end - 1]) < th && Math.abs(r.right[end - 1]) < th) end--;
  end = Math.min(r.left.length, end + Math.floor(r.sampleRate * 0.05));
  const left = r.left.slice(0, end);
  const right = r.right.slice(0, end);
  // Gentle fade on the last 30 ms so the file never ends with a click.
  const f = Math.min(end, Math.floor(r.sampleRate * 0.03));
  for (let i = 0; i < f; i++) {
    const g = i / f;
    left[end - 1 - i] *= g;
    right[end - 1 - i] *= g;
  }
  return { left, right, sampleRate: r.sampleRate };
}

/** 16-bit (with dither) or 24-bit PCM WAV. */
export function encodeWav(r: Rendered, bits: 16 | 24 = 16): Blob {
  const n = r.left.length;
  const bytesPer = bits / 8;
  const dataLen = n * 2 * bytesPer;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, r.sampleRate, true);
  v.setUint32(28, r.sampleRate * 2 * bytesPer, true);
  v.setUint16(32, 2 * bytesPer, true);
  v.setUint16(34, bits, true);
  str(36, 'data');
  v.setUint32(40, dataLen, true);
  let o = 44;
  const max = bits === 16 ? 32767 : 8388607;
  for (let i = 0; i < n; i++) {
    for (const ch of [r.left, r.right]) {
      const dither = bits === 16 ? (Math.random() - Math.random()) / max : 0;
      const x = Math.max(-1, Math.min(1, ch[i] + dither));
      const q = Math.round(x * max);
      if (bits === 16) {
        v.setInt16(o, q, true);
        o += 2;
      } else {
        v.setUint8(o, q & 0xff);
        v.setUint8(o + 1, (q >> 8) & 0xff);
        v.setUint8(o + 2, (q >> 16) & 0xff);
        o += 3;
      }
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Peak and a rough loudness (RMS in dBFS) for the export summary. */
export function measure(r: Rendered): { peakDb: number; rmsDb: number } {
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < r.left.length; i++) {
    const l = r.left[i];
    const rr = r.right[i];
    peak = Math.max(peak, Math.abs(l), Math.abs(rr));
    sum += (l * l + rr * rr) / 2;
  }
  const rms = Math.sqrt(sum / Math.max(1, r.left.length));
  return { peakDb: 20 * Math.log10(peak || 1e-9), rmsDb: 20 * Math.log10(rms || 1e-9) };
}
