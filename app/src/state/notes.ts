// Notes as the piano roll sees them. The pattern stores up to four notes per
// step (a chord) with an optional length for each; these helpers read and
// write that shape so the editor can think in single notes.
import { edit, getProject, mapTrack, trackById } from './store';
import { emptyStep, isChordKind, type Step, type Track } from './model';

export interface RollNote {
  step: number;
  pitch: number;
  len: number;
  vel: number;
}

export const MAX_NOTES_PER_STEP = 4;

/** Length of the note `k` of a step. */
export const noteLen = (s: Step, k: number): number => s.lens?.[k] ?? s.len;

export function notesOf(t: Track): RollNote[] {
  const out: RollNote[] = [];
  t.steps.slice(0, t.length).forEach((s, step) => {
    if (!s.on) return;
    s.notes.forEach((pitch, k) => out.push({ step, pitch, len: noteLen(s, k), vel: s.vel }));
  });
  return out;
}

/** Rebuilds a step from notes and lengths, dropping `lens` when they all match. */
function stepWith(s: Step, notes: { pitch: number; len: number }[]): Step {
  if (!notes.length) return { ...s, on: false, notes: [], lens: undefined };
  const len = Math.max(...notes.map((n) => n.len));
  const same = notes.every((n) => n.len === len);
  return { ...s, on: true, notes: notes.map((n) => n.pitch), len, lens: same ? undefined : notes.map((n) => n.len) };
}

const entries = (s: Step) => (s.on ? s.notes.map((pitch, k) => ({ pitch, len: noteLen(s, k) })) : []);

function withStep(t: Track, i: number, fn: (s: Step) => Step): Track {
  if (i < 0 || i >= t.steps.length) return t;
  const steps = t.steps.slice();
  const next = fn(steps[i]);
  if (next === steps[i]) return t;
  steps[i] = next;
  return { ...t, steps };
}

/** Adds a note. Bass instruments keep one note per step (the new one wins). */
export function addNote(trackId: string, step: number, pitch: number, len: number, key: string | null = null): 'ok' | 'lleno' {
  const t = trackById(getProject(), trackId);
  if (!t) return 'ok';
  const cur = entries(t.steps[step] ?? emptyStep());
  if (isChordKind(t.kind) && cur.length >= MAX_NOTES_PER_STEP && !cur.some((n) => n.pitch === pitch)) return 'lleno';
  edit(key, (p) =>
    mapTrack(p, trackId, (t) =>
      withStep(t, step, (s) => {
        const list = isChordKind(t.kind) ? entries(s).filter((n) => n.pitch !== pitch) : [];
        return stepWith({ ...s, vel: s.on ? s.vel : 0.85 }, [...list, { pitch, len }]);
      }),
    ),
  );
  return 'ok';
}

export function removeNote(trackId: string, step: number, pitch: number, key: string | null = null): void {
  edit(key, (p) => mapTrack(p, trackId, (t) => withStep(t, step, (s) => stepWith(s, entries(s).filter((n) => n.pitch !== pitch)))));
}

export function resizeNote(trackId: string, step: number, pitch: number, len: number, key: string | null = null): void {
  const l = Math.max(1, Math.min(64, Math.round(len)));
  edit(key, (p) =>
    mapTrack(p, trackId, (t) =>
      withStep(t, step, (s) => {
        const list = entries(s);
        if (!list.some((n) => n.pitch === pitch && n.len !== l)) return s;
        return stepWith(
          s,
          list.map((n) => (n.pitch === pitch ? { ...n, len: l } : n)),
        );
      }),
    ),
  );
}

/** Moves one note to another step and pitch (keeps its length). */
export function moveNote(trackId: string, from: { step: number; pitch: number }, to: { step: number; pitch: number }, key: string | null = null): boolean {
  if (from.step === to.step && from.pitch === to.pitch) return true;
  const t = trackById(getProject(), trackId);
  if (!t) return false;
  const src = entries(t.steps[from.step]).find((n) => n.pitch === from.pitch);
  if (!src) return false;
  const dest = to.step === from.step ? entries(t.steps[from.step]).filter((n) => n.pitch !== from.pitch) : entries(t.steps[to.step]);
  if (isChordKind(t.kind) && dest.length >= MAX_NOTES_PER_STEP && !dest.some((n) => n.pitch === to.pitch)) return false;
  edit(key, (p) =>
    mapTrack(p, trackId, (t) => {
      let n = withStep(t, from.step, (s) => stepWith(s, entries(s).filter((x) => x.pitch !== from.pitch)));
      n = withStep(n, to.step, (s) => {
        const list = isChordKind(n.kind) ? entries(s).filter((x) => x.pitch !== to.pitch) : [];
        return stepWith({ ...s, vel: s.on ? s.vel : t.steps[from.step].vel }, [...list, { pitch: to.pitch, len: src.len }]);
      });
      return n;
    }),
  );
  return true;
}

/** Sets the velocity (fuerza) of a whole step. */
export function setStepVel(trackId: string, step: number, vel: number, key: string | null = null): void {
  const v = Math.round(Math.min(1, Math.max(0.05, vel)) * 100) / 100;
  edit(key, (p) => mapTrack(p, trackId, (t) => withStep(t, step, (s) => (s.vel === v ? s : { ...s, vel: v }))));
}

// ---------------------------------------------------------------- chords --

/** Puts a chord on a step, replacing what was there. */
export function setChord(trackId: string, step: number, notes: number[], len: number, key: string | null = null): void {
  edit(key, (p) =>
    mapTrack(p, trackId, (t) =>
      withStep(t, step, (s) =>
        stepWith(
          { ...s, vel: s.on ? s.vel : 0.8 },
          notes.slice(0, MAX_NOTES_PER_STEP).map((pitch) => ({ pitch, len })),
        ),
      ),
    ),
  );
}

/** Moves everything on a step (a chord) to another step. */
export function moveStep(trackId: string, from: number, to: number, key: string | null = null): void {
  if (from === to) return;
  edit(key, (p) =>
    mapTrack(p, trackId, (t) => {
      if (to < 0 || to >= t.length) return t;
      const steps = t.steps.slice();
      steps[to] = { ...steps[from] };
      steps[from] = emptyStep();
      return { ...t, steps };
    }),
  );
}

/** Changes the length of every note of a step (a chord block). */
export function resizeStep(trackId: string, step: number, len: number, key: string | null = null): void {
  const l = Math.max(1, Math.min(64, Math.round(len)));
  edit(key, (p) => mapTrack(p, trackId, (t) => withStep(t, step, (s) => (s.len === l && !s.lens ? s : { ...s, len: l, lens: undefined }))));
}

export function clearStepAt(trackId: string, step: number): void {
  edit(null, (p) => mapTrack(p, trackId, (t) => withStep(t, step, () => emptyStep())));
}

/**
 * Writes a progression: one chord per bar (so four chords fill 4 bars).
 * The pattern grows to fit it.
 */
export function writeProgression(trackId: string, chords: number[][]): void {
  edit(null, (p) =>
    mapTrack(p, trackId, (t) => {
      const length = Math.min(64, Math.max(t.length, chords.length * 16));
      const steps = t.steps.map(() => emptyStep());
      chords.forEach((notes, i) => {
        steps[i * 16] = { ...emptyStep(), on: true, vel: 0.8, len: 16, notes: notes.slice(0, MAX_NOTES_PER_STEP) };
      });
      return { ...t, length, steps };
    }),
  );
}
