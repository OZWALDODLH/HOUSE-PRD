// The audio editor: every recording, imported file or sampler track opens here
// so the person can pick the part they like (and cut it into pads).
// The cut is non-destructive when the audio is short enough to keep whole:
// the track plays its region (sampler knobs p4..p7) and the take stays intact.
import { create } from 'zustand';
import { MAX_TRACKS } from '../engine/protocol';
import { startAudio } from '../engine/audio';
import { addSamplerTrack, assignSoundboard, getProject, setTrack, trackById } from './store';
import { freeSlot, getSample, putSample } from './samples';
import { addToLibrary } from './library';
import { AUDIO_ACCEPT, pickFiles } from './actions';
import { toast, useUi } from './ui';
import type { Family, Track } from './model';

/** Longest audio the editor opens (a whole song, to pick a part of it). */
export const MAX_SOURCE_SECONDS = 600;
/** Longest audio kept whole inside a project; longer ones keep only the part you chose. */
export const MAX_SLOT_SECONDS = 60;

export interface AudioSource {
  data: Float32Array;
  sr: number;
  name: string;
  family: Family;
}

export type EditTarget = { kind: 'nuevo' } | { kind: 'pista'; trackId: string } | { kind: 'soundboard'; code: string };

interface EditState {
  source: AudioSource | null;
  target: EditTarget;
  /** Selection, as fractions of the source. */
  start: number;
  end: number;
  /** Fades at both ends (sampler p6). */
  smooth: number;
  reverse: boolean;
}

export const useAudioEdit = create<EditState>(() => ({
  source: null,
  target: { kind: 'nuevo' },
  start: 0,
  end: 1,
  smooth: 0,
  reverse: false,
}));

export const setEdit = (patch: Partial<EditState>): void => useAudioEdit.setState(patch);

// ------------------------------------------------------------------ audio --

/** Mono mix, peak at -1 dBFS, at most `maxSeconds`. */
export function toMono(channels: Float32Array[], sr: number, maxSeconds = MAX_SOURCE_SECONDS): Float32Array {
  const len = Math.min(channels[0]?.length ?? 0, Math.floor(sr * maxSeconds));
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i] += ch[i] / channels.length;
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(mono[i]));
  if (peak > 0.001) {
    const g = 0.89 / peak;
    for (let i = 0; i < len; i++) mono[i] *= g;
  }
  return mono;
}

export async function decodeAudio(file: Blob): Promise<{ data: Float32Array; sr: number; cut: boolean }> {
  const buf = await file.arrayBuffer();
  const audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(buf);
  const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  const data = toMono(chans, audio.sampleRate);
  return { data, sr: audio.sampleRate, cut: audio.length > data.length };
}

/** Where the sound is: from the first to the last moment above a quiet threshold. */
export function soundRegion(data: Float32Array, sr: number): [number, number] {
  const n = data.length;
  if (n < 2) return [0, 1];
  const th = 0.02;
  let a = 0;
  while (a < n && Math.abs(data[a]) < th) a++;
  let b = n - 1;
  while (b > a && Math.abs(data[b]) < th * 0.5) b--;
  if (a >= b) return [0, 1];
  a = Math.max(0, a - Math.floor(sr * 0.01));
  b = Math.min(n - 1, b + Math.floor(sr * 0.08));
  return [a / (n - 1), b / (n - 1)];
}

/**
 * Hits inside a range (sample indices), strongest first then in time order:
 * rises of loudness at least 60 ms apart. Used to cut a loop at its drums.
 */
export function detectHits(data: Float32Array, sr: number, from: number, to: number, max = 16): number[] {
  const hop = Math.max(64, Math.floor(sr * 0.005));
  const frames: number[] = [];
  for (let i = from; i + hop <= to; i += hop) {
    let e = 0;
    for (let k = i; k < i + hop; k++) e += data[k] * data[k];
    frames.push(Math.log10(1e-9 + e / hop));
  }
  const rise = frames.map((v, i) => (i ? Math.max(0, v - frames[i - 1]) : 0));
  const mean = rise.reduce((a, b) => a + b, 0) / Math.max(1, rise.length);
  const sd = Math.sqrt(rise.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rise.length));
  const gap = Math.ceil((sr * 0.06) / hop);
  const peaks: { i: number; v: number }[] = [];
  for (let i = 1; i < rise.length - 1; i++) {
    if (rise[i] > mean + sd * 1.2 && rise[i] >= rise[i - 1] && rise[i] >= rise[i + 1]) peaks.push({ i, v: rise[i] });
  }
  const chosen: number[] = [];
  for (const p of peaks.sort((a, b) => b.v - a.v)) {
    if (chosen.length >= max) break;
    if (chosen.every((c) => Math.abs(c - p.i) >= gap)) chosen.push(p.i);
  }
  // A hit right at the start of the range is always a cut point.
  const points = [0, ...chosen.filter((c) => c > gap).sort((a, b) => a - b)].slice(0, max);
  return points.map((i) => from + i * hop);
}

// --------------------------------------------------------------- preview --

let previewCtx: AudioContext | null = null;
let previewNode: AudioBufferSourceNode | null = null;

export function stopPreview(): void {
  try {
    previewNode?.stop();
  } catch {
    // Already stopped.
  }
  previewNode = null;
}

/** Plays part of an audio buffer on its own, outside the song. Returns when it started and how long it lasts. */
export function previewAudio(data: Float32Array, sr: number, from = 0, to = 1, reverse = false): { at: number; secs: number } | null {
  stopPreview();
  const a = Math.floor(from * (data.length - 1));
  const b = Math.max(a + 1, Math.floor(to * (data.length - 1)));
  const part = data.slice(a, b);
  if (reverse) part.reverse();
  try {
    previewCtx ??= new AudioContext();
    void previewCtx.resume();
    const buf = previewCtx.createBuffer(1, part.length, sr);
    buf.copyToChannel(part, 0);
    const node = previewCtx.createBufferSource();
    node.buffer = buf;
    node.connect(previewCtx.destination);
    node.start();
    previewNode = node;
    return { at: performance.now(), secs: part.length / sr };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ open --

export function openAudioEditor(source: AudioSource, target: EditTarget = { kind: 'nuevo' }, region?: Partial<Pick<EditState, 'start' | 'end' | 'smooth' | 'reverse'>>): void {
  const [start, end] = region?.start !== undefined && region.end !== undefined ? [region.start, region.end] : soundRegion(source.data, source.sr);
  useAudioEdit.setState({ source, target, start, end, smooth: region?.smooth ?? 0, reverse: region?.reverse ?? false });
}

export function closeAudioEditor(): void {
  stopPreview();
  useAudioEdit.setState({ source: null });
}

const baseName = (f: File) => f.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Sample';

/** Opens audio files (a picker when none are given) in the editor. */
export async function importAudio(files?: File[], target: EditTarget = { kind: 'nuevo' }): Promise<void> {
  const list = files ?? (await pickFiles(AUDIO_ACCEPT));
  const f = list[0];
  if (!f) return;
  try {
    const { data, sr, cut } = await decodeAudio(f);
    if (data.length < sr * 0.02) {
      toast('Ese audio está vacío o es demasiado corto.', 'error');
      return;
    }
    if (cut) toast('El audio dura más de 10 minutos: abrí solo el principio.', 'info', 4000);
    openAudioEditor({ data, sr, name: baseName(f), family: 'samples' }, target);
    if (list.length > 1) toast('Abrí el primer archivo. Suelta los demás uno por uno.', 'info', 4000);
  } catch {
    toast('No pude abrir ese archivo. Prueba con WAV, MP3, OGG, M4A o FLAC.', 'error');
  }
}

/** Opens the audio of a sampler track, with the part it plays selected. */
export function openAudioEditorForTrack(trackId: string): void {
  const t = trackById(getProject(), trackId);
  if (!t || t.kind !== 'sampler' || t.sampleSlot === undefined) return;
  const s = getSample(t.sampleSlot);
  if (!s) {
    toast('Esta pista todavía no tiene audio. Graba o importa uno.', 'info');
    return;
  }
  const p = t.params;
  openAudioEditor({ data: s.data, sr: s.sr, name: t.name, family: t.family }, { kind: 'pista', trackId }, { start: p[4] ?? 0, end: p[5] ?? 1, smooth: p[6] ?? 0, reverse: (p[7] ?? 0) > 0.5 });
}

// ----------------------------------------------------------------- apply --

/** The selected part as its own audio (reverse not applied: that is a knob). */
export function selectionAudio(): Float32Array | null {
  const { source, start, end } = useAudioEdit.getState();
  if (!source) return null;
  const n = source.data.length;
  const a = Math.floor(start * (n - 1));
  const b = Math.max(a + 1, Math.ceil(end * (n - 1)));
  return source.data.slice(a, b);
}

/**
 * What goes into the project: the whole source when it is short (so the cut
 * can change later), else just the selection (up to a minute). Returns the
 * audio and the region to play inside it.
 */
function forProject(): { data: Float32Array; start: number; end: number } | null {
  const { source, start, end } = useAudioEdit.getState();
  if (!source) return null;
  if (source.data.length <= source.sr * MAX_SLOT_SECONDS) return { data: source.data, start, end };
  const part = selectionAudio()!;
  const max = source.sr * MAX_SLOT_SECONDS;
  return { data: part.length > max ? part.slice(0, max) : part, start: 0, end: 1 };
}

const samplerParams = (t: Track | undefined, start: number, end: number, smooth: number, reverse: boolean): number[] => {
  const base = t?.params ?? [0.5, 0, 0.6, 1, 0, 1, 0, 0];
  return [...base.slice(0, 4), start, end, smooth, reverse ? 1 : 0];
};

/** Stores audio in a free slot of the open project. */
async function storeAudio(data: Float32Array, sr: number, name: string): Promise<number | null> {
  const p = getProject();
  const slot = freeSlot(p);
  if (slot < 0) {
    toast('Ya usas todos los espacios de audio del proyecto. Borra una pista de audio.', 'error');
    return null;
  }
  await startAudio();
  await putSample(p.id, slot, { data, sr, name });
  return slot;
}

/** "Usar esta parte": a new pad, the track being edited, or a soundboard key. */
export async function applySelection(): Promise<boolean> {
  const st = useAudioEdit.getState();
  const { source, target, smooth, reverse } = st;
  if (!source) return false;
  if (target.kind === 'pista') {
    const t = trackById(getProject(), target.trackId);
    if (!t) return false;
    const same = t.sampleSlot !== undefined && getSample(t.sampleSlot)?.data === source.data;
    if (same) {
      setTrack(t.id, { params: samplerParams(t, st.start, st.end, smooth, reverse) }, null);
    } else {
      const put = forProject();
      if (!put) return false;
      const slot = await storeAudio(put.data, source.sr, source.name);
      if (slot === null) return false;
      setTrack(t.id, { sampleSlot: slot, params: samplerParams(t, put.start, put.end, smooth, reverse) }, null);
    }
    closeAudioEditor();
    toast(`Listo: “${t.name}” toca la parte que elegiste.`, 'bien');
    return true;
  }
  const put = forProject();
  if (!put) return false;
  if (target.kind === 'nuevo' && getProject().tracks.length >= MAX_TRACKS) {
    toast('Ya tienes 32 pistas. Borra una para agregar tu audio.', 'error');
    return false;
  }
  const slot = await storeAudio(put.data, source.sr, source.name);
  if (slot === null) return false;
  const params = samplerParams(undefined, put.start, put.end, smooth, reverse);
  if (target.kind === 'soundboard') {
    assignSoundboard(target.code, { slot, name: source.name, family: source.family, params });
    closeAudioEditor();
    toast(`“${source.name}” quedó en la tecla del Soundboard.`, 'bien');
    return true;
  }
  const id = addSamplerTrack(source.name, slot, source.family);
  if (!id) return false;
  setTrack(id, { params }, null);
  useUi.getState().set({ selected: id });
  closeAudioEditor();
  toast(`Listo: “${source.name}” está en un pad. Prende sus pasos o tócalo con tu teclado.`, 'bien', 4000);
  return true;
}

/**
 * "Cortar en pads": one pad per part of the selection, all sharing the same
 * audio. `how` is a number of equal parts, or "golpes" to cut at the hits.
 */
export async function chopSelection(how: number | 'golpes'): Promise<number> {
  const { source, smooth, reverse } = useAudioEdit.getState();
  const put = forProject();
  if (!source || !put) return 0;
  const room = MAX_TRACKS - getProject().tracks.length;
  if (room <= 0) {
    toast('Ya tienes 32 pistas. Borra algunas para cortar en pads.', 'error');
    return 0;
  }
  const n = put.data.length;
  const a = Math.floor(put.start * (n - 1));
  const b = Math.max(a + 2, Math.floor(put.end * (n - 1)));
  let cuts: number[];
  if (how === 'golpes') {
    cuts = detectHits(put.data, source.sr, a, b, Math.min(16, room));
    if (cuts.length < 2) {
      toast('No encontré golpes claros. Prueba con partes iguales.', 'info');
      return 0;
    }
  } else {
    const parts = Math.min(how, room);
    cuts = Array.from({ length: parts }, (_, i) => a + Math.round(((b - a) * i) / parts));
  }
  const bounds = [...cuts, b];
  const slot = await storeAudio(put.data, source.sr, source.name);
  if (slot === null) return 0;
  let made = 0;
  let first: string | null = null;
  for (let i = 0; i < bounds.length - 1 && made < room; i++) {
    const id = addSamplerTrack(`${source.name.slice(0, 18)} ${i + 1}`, slot, source.family);
    if (!id) break;
    setTrack(id, { params: samplerParams(undefined, bounds[i] / (n - 1), bounds[i + 1] / (n - 1), smooth, reverse) }, null);
    first ??= id;
    made++;
  }
  if (first) useUi.getState().set({ selected: first, kbMode: 'pads' });
  closeAudioEditor();
  if (made < bounds.length - 1) toast(`Hice ${made} pads: no caben más pistas.`, 'info', 4000);
  else toast(`Listo: ${made} pads con partes de “${source.name}”. Tócalos con tu teclado.`, 'bien', 4000);
  return made;
}

/** Saves the selection in "Mis samples", for any project. */
export async function saveSelectionToLibrary(name?: string): Promise<boolean> {
  const { source } = useAudioEdit.getState();
  const part = selectionAudio();
  if (!source || !part) return false;
  const item = await addToLibrary(name ?? source.name, source.family, part, source.sr);
  if (item) toast(`Guardé “${item.name}” en Mis samples.`, 'bien');
  else toast('No pude guardar en Mis samples: este navegador no deja usar el almacenamiento.', 'error');
  return !!item;
}
