// The project document (what gets saved) plus undo history.
// Every change goes through `edit`, which keeps objects immutable so the
// engine sync can diff by reference.
import { create } from 'zustand';
import { MAX_TRACKS, type SectionKind } from '../engine/protocol';
import { PRESETS, samplerTrack, trackFromSound, defaultNote, type Sound } from './instruments';
import { SCALES, emptyStep, isMelodic, uid, type Family, type GenreId, type Master, type Project, type Section, type Step, type Track } from './model';
import { newProjectFromGenre } from './templates';

const HISTORY = 120;
const COALESCE_MS = 900;

export interface StudioState {
  project: Project;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastAt: number;
}

export const useStudio = create<StudioState>(() => ({
  project: newProjectFromGenre('techhouse'),
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
}));

export const getProject = (): Project => useStudio.getState().project;

/**
 * Applies a change. Changes with the same `key` that arrive close together
 * (dragging a knob, painting steps) become a single undo step.
 */
export function edit(key: string | null, fn: (p: Project) => Project): void {
  const s = useStudio.getState();
  const next = fn(s.project);
  if (next === s.project) return;
  const now = performance.now();
  const merge = key !== null && key === s.lastKey && now - s.lastAt < COALESCE_MS;
  useStudio.setState({
    project: { ...next, updatedAt: Date.now() },
    past: merge ? s.past : [...s.past, s.project].slice(-HISTORY),
    future: [],
    lastKey: key,
    lastAt: now,
  });
}

export function undo(): boolean {
  const s = useStudio.getState();
  const prev = s.past[s.past.length - 1];
  if (!prev) return false;
  useStudio.setState({ project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future].slice(0, HISTORY), lastKey: null });
  return true;
}

export function redo(): boolean {
  const s = useStudio.getState();
  const next = s.future[0];
  if (!next) return false;
  useStudio.setState({ project: next, past: [...s.past, s.project].slice(-HISTORY), future: s.future.slice(1), lastKey: null });
  return true;
}

/** Replaces the whole document (open, new). Clears the history. */
export function openProject(p: Project): void {
  useStudio.setState({ project: normalizeProject(p), past: [], future: [], lastKey: null });
}

export function newProject(g: GenreId): Project {
  const p = newProjectFromGenre(g);
  openProject(p);
  return p;
}

// ---------------------------------------------------------------- helpers --

export function mapTrack(p: Project, id: string, fn: (t: Track) => Track): Project {
  let changed = false;
  const tracks = p.tracks.map((t) => {
    if (t.id !== id) return t;
    const n = fn(t);
    if (n !== t) changed = true;
    return n;
  });
  return changed ? { ...p, tracks } : p;
}

const setStepAt = (t: Track, i: number, step: Step): Track => {
  const steps = t.steps.slice();
  steps[i] = step;
  return { ...t, steps };
};

export const trackById = (p: Project, id: string | null): Track | undefined => (id ? p.tracks.find((t) => t.id === id) : undefined);

/** Fills fields added after a project was saved, so old files keep opening. */
export function normalizeProject(p: Project): Project {
  const tracks = p.tracks.slice(0, MAX_TRACKS).map((t) => ({
    ...t,
    filter: t.filter ?? 0.5,
    eq: t.eq ?? [0, 0, 0],
    drive: t.drive ?? 0,
    once: t.once ?? false,
    params: [...t.params, ...Array(8).fill(0.5)].slice(0, 8),
    steps: [...t.steps, ...Array.from({ length: 64 }, emptyStep)].slice(0, 64).map((s) => ({ ...emptyStep(), ...s })),
  }));
  return { ...p, tracks };
}

// ---------------------------------------------------------------- project --

export const rename = (name: string): void => edit('name', (p) => ({ ...p, name: name.trim() || p.name }));

export const setBpm = (bpm: number): void =>
  edit('bpm', (p) => {
    const v = Math.round(Math.min(200, Math.max(60, bpm)) * 10) / 10;
    return v === p.bpm ? p : { ...p, bpm: v };
  });

export const setSwing = (swing: number): void =>
  edit('swing', (p) => {
    const v = Math.round(Math.min(0.75, Math.max(0.5, swing)) * 100) / 100;
    return v === p.swing ? p : { ...p, swing: v };
  });

export const setMetronome = (on: boolean): void => edit(null, (p) => ({ ...p, metronome: on }));

export const setMode = (mode: Project['mode']): void => edit(null, (p) => (p.mode === mode ? p : { ...p, mode }));

/** Moves a note into another key, keeping its place in the scale. */
function moveNote(n: number, from: Project['key'], to: Project['key'], shift: number): number {
  const fromDeg = SCALES[from.scale];
  const toDeg = SCALES[to.scale];
  const rel = (((n - from.root) % 12) + 12) % 12;
  const octave = Math.floor((n - from.root) / 12);
  const d = fromDeg.indexOf(rel);
  const base = from.root + shift + octave * 12;
  if (d >= 0) return base + toDeg[d];
  return base + rel;
}

/** Changes the key and moves every note so the song keeps sounding right. */
export function setKey(root: number, scale: Project['key']['scale']): void {
  edit(null, (p) => {
    if (p.key.root === root && p.key.scale === scale) return p;
    let shift = root - p.key.root;
    if (shift > 6) shift -= 12;
    if (shift < -5) shift += 12;
    const to = { root, scale };
    const tracks = p.tracks.map((t) =>
      isMelodic(t)
        ? { ...t, steps: t.steps.map((s) => (s.notes.length ? { ...s, notes: s.notes.map((n) => moveNote(n, p.key, to, shift)) } : s)) }
        : t,
    );
    return { ...p, key: to, tracks };
  });
}

export const setMaster = (m: Partial<Master>, key: string | null = 'master'): void =>
  edit(key, (p) => ({ ...p, master: { ...p.master, ...m } }));

/** Volume targets: a ceiling and a bit more glue for louder masters. */
export function setTarget(target: Master['target']): void {
  const presets: Record<Master['target'], Partial<Master>> = {
    streaming: { target, ceiling: -1, vol: -1 },
    club: { target, ceiling: -0.3, vol: 0 },
    maximo: { target, ceiling: -0.1, vol: 2 },
  };
  setMaster(presets[target], null);
}

export const setSidechain = (trackId: string | null): void => edit(null, (p) => ({ ...p, sidechainTrack: trackId }));

// ----------------------------------------------------------------- tracks --

export const setTrack = (id: string, patch: Partial<Track>, key: string | null = `track:${id}:${Object.keys(patch).join(',')}`): void =>
  edit(key, (p) => mapTrack(p, id, (t) => ({ ...t, ...patch })));

export const setParam = (id: string, idx: number, value: number): void =>
  edit(`param:${id}:${idx}`, (p) =>
    mapTrack(p, id, (t) => {
      const v = Math.min(1, Math.max(0, value));
      if (t.params[idx] === v) return t;
      const params = t.params.slice();
      params[idx] = v;
      return { ...t, params };
    }),
  );

export function applyPreset(id: string, name: string): void {
  edit(null, (p) =>
    mapTrack(p, id, (t) => {
      if (t.kind === 'drum') return t;
      const preset = PRESETS[t.kind].find((x) => x.name === name);
      return preset ? { ...t, preset: preset.name, params: [...preset.params] } : t;
    }),
  );
}

export function setStepOn(id: string, i: number, on: boolean, key: string | null = null): void {
  const p = getProject();
  const t = trackById(p, id);
  if (!t) return;
  edit(key, (p) =>
    mapTrack(p, id, (t) => {
      const s = t.steps[i];
      if (s.on === on) return t;
      if (on && isMelodic(t) && !s.notes.length) {
        return setStepAt(t, i, { ...s, on, notes: guessNotes(t, i, p.key) });
      }
      return setStepAt(t, i, { ...s, on });
    }),
  );
}

export const toggleStep = (id: string, i: number): void => {
  const t = trackById(getProject(), id);
  if (t) setStepOn(id, i, !t.steps[i].on);
};

export const setStep = (id: string, i: number, patch: Partial<Step>, key: string | null = `step:${id}:${i}`): void =>
  edit(key, (p) => mapTrack(p, id, (t) => setStepAt(t, i, { ...t.steps[i], ...patch })));

/** Notes for a new melodic step: copies the closest note before it, or the root. */
function guessNotes(t: Track, i: number, key: Project['key']): number[] {
  for (let k = 1; k <= t.length; k++) {
    const s = t.steps[(i - k + t.length) % t.length];
    if (s.on && s.notes.length) return [...s.notes];
  }
  const root = defaultNote(t, key.root);
  if (t.kind !== 'poly') return [root];
  const scale = SCALES[key.scale];
  const third = key.root + scale[2];
  const fifth = key.root + scale[4];
  const up = (n: number) => {
    let x = n;
    while (x < root) x += 12;
    return x;
  };
  return [root, up(third), up(fifth)];
}

/** Moves a step's notes up or down by scale degrees (never out of key). */
export function shiftStepNotes(id: string, i: number, degrees: number): void {
  const p = getProject();
  edit(`notes:${id}:${i}`, (p2) =>
    mapTrack(p2, id, (t) => {
      const s = t.steps[i];
      if (!s.notes.length) return t;
      const notes = s.notes.map((n) => scaleStep(n, degrees, p.key));
      if (notes.some((n) => n < 12 || n > 108)) return t;
      return setStepAt(t, i, { ...s, notes });
    }),
  );
}

/** The note `degrees` scale steps away from `n` (snaps to the scale first). */
export function scaleStep(n: number, degrees: number, key: Project['key']): number {
  const deg = SCALES[key.scale];
  const inScale = (x: number) => deg.includes((((x - key.root) % 12) + 12) % 12);
  let x = n;
  if (!inScale(x)) {
    x -= 1;
    if (!inScale(x)) x += 2;
  }
  const dir = Math.sign(degrees);
  for (let k = 0; k < Math.abs(degrees); k++) {
    x += dir;
    while (!inScale(x)) x += dir;
  }
  return x;
}

/** Changes the loop length; when it grows, the new bars repeat the pattern. */
export function setLength(id: string, length: number): void {
  edit(null, (p) =>
    mapTrack(p, id, (t) => {
      const n = Math.min(64, Math.max(1, Math.round(length)));
      if (n === t.length) return t;
      const steps = t.steps.slice();
      if (n > t.length && steps.slice(t.length, n).every((s) => !s.on)) {
        for (let i = t.length; i < n; i++) steps[i] = { ...t.steps[i % t.length], notes: [...t.steps[i % t.length].notes] };
      }
      return { ...t, length: n, steps };
    }),
  );
}

export const setAllLengths = (length: number): void => {
  for (const t of getProject().tracks) setLength(t.id, length);
};

export function clearTrack(id: string): void {
  edit(null, (p) => mapTrack(p, id, (t) => ({ ...t, steps: t.steps.map((s) => ({ ...s, on: false })) })));
}

/** Adds a track; returns its id, or null when the 16 tracks are taken. */
export function addTrack(sound: Sound, name?: string): string | null {
  const p = getProject();
  if (p.tracks.length >= MAX_TRACKS) return null;
  const longest = Math.max(16, ...p.tracks.map((t) => t.length));
  const t = trackFromSound(sound, name ?? uniqueName(p, sound.name), sound.kind === 'drum' ? 16 : Math.min(longest, 64));
  insertTrack(t);
  return t.id;
}

export function addSamplerTrack(name: string, slot: number, family: Family): string | null {
  const p = getProject();
  if (p.tracks.length >= MAX_TRACKS) return null;
  const t = samplerTrack(uniqueName(p, name), slot, family);
  insertTrack(t);
  return t.id;
}

function insertTrack(t: Track): void {
  edit(null, (p) => ({
    ...p,
    tracks: [...p.tracks, t],
    // A new sound plays in every section except the calm ones.
    sections: p.sections.map((s) => (t.once || s.kind === 'intro' || s.kind === 'salida' ? s : { ...s, tracks: [...s.tracks, t.id] })),
  }));
}

function uniqueName(p: Project, base: string): string {
  const names = new Set(p.tracks.map((t) => t.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

export function removeTrack(id: string): void {
  edit(null, (p) => ({
    ...p,
    tracks: p.tracks.filter((t) => t.id !== id),
    sections: p.sections.map((s) => ({ ...s, tracks: s.tracks.filter((x) => x !== id) })),
    sidechainTrack: p.sidechainTrack === id ? null : p.sidechainTrack,
  }));
}

export function duplicateTrack(id: string): string | null {
  const p = getProject();
  const t = trackById(p, id);
  if (!t || p.tracks.length >= MAX_TRACKS) return null;
  const copy: Track = { ...t, id: uid('pista'), name: uniqueName(p, t.name), steps: t.steps.map((s) => ({ ...s, notes: [...s.notes] })), solo: false };
  edit(null, (p) => {
    const i = p.tracks.findIndex((x) => x.id === id);
    const tracks = p.tracks.slice();
    tracks.splice(i + 1, 0, copy);
    return { ...p, tracks, sections: p.sections.map((s) => (s.tracks.includes(id) ? { ...s, tracks: [...s.tracks, copy.id] } : s)) };
  });
  return copy.id;
}

export function moveTrack(id: string, dir: -1 | 1): void {
  edit(null, (p) => {
    const i = p.tracks.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.tracks.length) return p;
    const tracks = p.tracks.slice();
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    return { ...p, tracks };
  });
}

/** "Bombeo en un clic": the track ducks when the kick hits. */
export function togglePump(id: string): void {
  const p = getProject();
  const t = trackById(p, id);
  if (!t) return;
  const kick = p.sidechainTrack ?? p.tracks.find((x) => x.pict === 'bombo')?.id ?? null;
  edit(null, (p) => {
    const q = mapTrack(p, id, (t) => ({ ...t, duck: t.duck > 0 ? 0 : t.family === 'bajo' ? 0.65 : 0.45 }));
    return q.sidechainTrack ? q : { ...q, sidechainTrack: kick };
  });
}

/** Writes a hit played live into the pattern (quantized by the caller). */
export function recordHit(id: string, i: number, vel: number, notes: number[] | null): void {
  edit(`rec:${id}`, (p) =>
    mapTrack(p, id, (t) => {
      const s = t.steps[i];
      if (!notes) return s.on && Math.abs(s.vel - vel) < 0.05 ? t : setStepAt(t, i, { ...s, on: true, vel });
      let merged = notes;
      if (t.kind === 'poly' && s.on && s.notes.length) merged = [...new Set([...s.notes, ...notes])].slice(-4);
      return setStepAt(t, i, { ...s, on: true, vel, notes: merged });
    }),
  );
}

// --------------------------------------------------------------- sections --

export const setSection = (id: string, patch: Partial<Section>, key: string | null = null): void =>
  edit(key, (p) => ({ ...p, sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

export function toggleSectionTrack(secId: string, trackId: string): void {
  edit(null, (p) => ({
    ...p,
    sections: p.sections.map((s) =>
      s.id !== secId ? s : { ...s, tracks: s.tracks.includes(trackId) ? s.tracks.filter((x) => x !== trackId) : [...s.tracks, trackId] },
    ),
  }));
}

export const SECTION_NAMES: Record<SectionKind, string> = {
  none: 'Parte',
  intro: 'Intro',
  subida: 'Subida',
  drop: '¡Drop!',
  pausa: 'Pausa',
  salida: 'Salida',
  verso: 'Verso',
  coro: 'Coro',
  puente: 'Puente',
  precoro: 'Pre-coro',
};

export function addSection(kind: SectionKind, after?: string): string {
  const p = getProject();
  const bars = kind === 'subida' || kind === 'pausa' || kind === 'salida' || kind === 'precoro' ? 8 : 16;
  const everyone = p.tracks.filter((t) => !t.once || kind === 'subida' || kind === 'drop').map((t) => t.id);
  const s: Section = { id: uid('sec'), name: SECTION_NAMES[kind], kind, bars, tracks: everyone };
  edit(null, (p) => {
    const sections = p.sections.slice();
    const i = after ? sections.findIndex((x) => x.id === after) : -1;
    sections.splice(i >= 0 ? i + 1 : sections.length, 0, s);
    return { ...p, sections };
  });
  return s.id;
}

export function duplicateSection(id: string): void {
  edit(null, (p) => {
    const i = p.sections.findIndex((s) => s.id === id);
    if (i < 0 || p.sections.length >= 32) return p;
    const sections = p.sections.slice();
    sections.splice(i + 1, 0, { ...p.sections[i], id: uid('sec'), tracks: [...p.sections[i].tracks] });
    return { ...p, sections };
  });
}

export function removeSection(id: string): void {
  edit(null, (p) => (p.sections.length <= 1 ? p : { ...p, sections: p.sections.filter((s) => s.id !== id) }));
}

export function moveSection(id: string, dir: -1 | 1): void {
  edit(null, (p) => {
    const i = p.sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.sections.length) return p;
    const sections = p.sections.slice();
    [sections[i], sections[j]] = [sections[j], sections[i]];
    return { ...p, sections };
  });
}

export const songBars = (p: Project): number => p.sections.reduce((a, s) => a + s.bars, 0);

/** Bar where a section starts. */
export const sectionStart = (p: Project, id: string): number => {
  let bar = 0;
  for (const s of p.sections) {
    if (s.id === id) return bar;
    bar += s.bars;
  }
  return 0;
};

/** Longest pattern in bars (at least 1). */
export const patternBars = (p: Project): number => Math.max(1, ...p.tracks.map((t) => Math.ceil(t.length / 16)));

export const formatDuration = (seconds: number): string => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const barsToSeconds = (bars: number, bpm: number): number => (bars * 4 * 60) / bpm;
