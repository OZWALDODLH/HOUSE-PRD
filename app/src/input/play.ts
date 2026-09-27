// Playing sounds by hand (pads on screen or keys), with optional live recording.
import { padOff, padOn, quantizedStep } from '../engine/audio';
import { defaultNote } from '../state/instruments';
import { isMelodic, type Track } from '../state/model';
import { getProject, recordHit, trackById } from '../state/store';
import { useUi } from '../state/ui';
import { degreeNote } from '../state/dice';
import { press, release } from './pressed';

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
