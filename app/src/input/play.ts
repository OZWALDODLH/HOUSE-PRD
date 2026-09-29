// Playing sounds by hand (pads on screen or keys), with optional live recording.
import { padOff, padOn, quantizedStep, startAudio } from '../engine/audio';
import { KIND, cmd } from '../engine/protocol';
import { KIND_CODE, PRESETS, defaultNote, soundById } from '../state/instruments';
import { isBassKind, isChordKind, isMelodic, type Track } from '../state/model';
import { getProject, recordHit, trackById } from '../state/store';
import { useUi } from '../state/ui';
import { degreeNote } from '../state/dice';
import { press, release } from './pressed';

/** How many times each kind of key was played (the tutorial watches these). */
export const played = { pads: 0, notes: 0, shots: 0 };

/** Track that the note keys play: the selected one if it has notes, else the first melodic one. */
export function noteTrack(): Track | undefined {
  const p = getProject();
  const t = trackById(p, useUi.getState().selected);
  if (t && (isMelodic(t) || t.kind === 'sampler')) return t;
  return p.tracks.find(isMelodic);
}

/** Records into the pattern if armed; says whether the sound must also play now. */
function capture(t: Track, vel: number, notes: number[] | null): boolean {
  if (!useUi.getState().recArmed) return true;
  const q = quantizedStep();
  if (!q) return true;
  recordHit(t.id, q.step % t.length, vel, notes);
  // If the step is still ahead, the sequencer plays it: avoid a double hit.
  return !q.ahead;
}

export function hitTrack(trackId: string, vel: number, source: string): void {
  const p = getProject();
  const t = trackById(p, trackId);
  if (!t) return;
  press(`pad:${trackId}`);
  played.pads++;
  const note = t.kind === 'sampler' ? 60 : defaultNote(t, p.key.root);
  const now = capture(t, vel, t.kind === 'drum' ? null : [note]);
  if (now) padOn(trackId, vel, source, note);
}

export function releaseTrack(trackId: string, source: string): void {
  release(`pad:${trackId}`);
  padOff(source);
}

export function hitNote(note: number, vel: number, source: string): void {
  const t = noteTrack();
  if (!t) return;
  press(`note:${note}`);
  played.notes++;
  const now = capture(t, vel, [note]);
  if (now) padOn(t.id, vel, source, note);
}

export function releaseNote(note: number, source: string): void {
  release(`note:${note}`);
  padOff(source);
}

/** Note for a scale degree, starting at the octave the person chose. */
export function scaleNote(degree: number): number {
  const p = getProject();
  const octave = useUi.getState().octave;
  const t = noteTrack();
  // Bass tracks sound two octaves lower than chords and leads.
  const shift = t && (t.kind === 'acid' || t.kind === 'bass808') ? -2 : 0;
  return degreeNote(p.key, degree, (octave + shift) * 12);
}

/** Plays a soundboard key: a one-shot on the master bus, whatever is playing. */
export function hitShot(code: string, vel: number): boolean {
  const p = getProject();
  const item = p.soundboard[code];
  if (!item) return false;
  press(`sb:${code}`);
  played.shots++;
  setTimeout(() => release(`sb:${code}`), 140);
  let c: number[] | null = null;
  if ('sound' in item) {
    const s = soundById(item.sound);
    if (s) {
      const note = isBassKind(s.kind) ? 36 + p.key.root : isChordKind(s.kind) ? 60 + p.key.root : 60;
      c = cmd.shot(KIND_CODE[s.kind], s.model, note, vel, 0, s.params);
    }
  } else {
    c = cmd.shot(KIND.SAMPLER, 0, 60, vel, item.slot, item.params ?? PRESETS.sampler[0].params);
  }
  if (c) void startAudio().then((b) => b?.send([c]));
  return true;
}
