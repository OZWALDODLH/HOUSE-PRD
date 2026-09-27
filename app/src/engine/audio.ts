// Glue between the interface and the engine host: start, transport, live notes.
import { getBridge, bridgeIfReady, type EngineBridge } from './bridge';
import { MASTER, ST, cmd, type Cmd } from './protocol';
import { diffCmds, projectCmds } from './sync';
import { getStatus, pushStatus } from './live';
import { useStudio, getProject } from '../state/store';
import { useUi } from '../state/ui';
import { sendAllSamples } from '../state/samples';
import { KIND_CODE, defaultNote, type Sound } from '../state/instruments';
import type { Project } from '../state/model';

let lastSent: Project | null = null;
let auditioning = false;
let statusAt = 0;
let unsubscribe: (() => void) | null = null;
let starting: Promise<EngineBridge | null> | null = null;

/** Starts audio (needs a click or key press first in browsers). Safe to call often. */
export function startAudio(): Promise<EngineBridge | null> {
  const ready = bridgeIfReady();
  if (ready) {
    ready.resume().catch(() => undefined);
    return Promise.resolve(ready);
  }
  if (starting) return starting;
  useUi.getState().set({ audio: 'starting', audioError: null });
  starting = (async () => {
    try {
      const b = await getBridge();
      b.onStatus((s) => {
        statusAt = performance.now();
        pushStatus(s);
      });
      // The desktop app remembers the chosen devices (bocina and audífonos).
      const outputs = useUi.getState().outputs;
      let cueApart = false;
      if (b.kind === 'native' && (outputs.master || outputs.cue)) {
        const e = await b.setRouting(outputs);
        cueApart = !e && !!outputs.cue;
      }
      const p = getProject();
      lastSent = p;
      b.send([cmd.stop(), cmd.master(MASTER.CUE_TO_MASTER, cueApart ? 0 : 1), ...projectCmds(p)]);
      sendAllSamples(b);
      unsubscribe?.();
      unsubscribe = useStudio.subscribe((s) => {
        if (s.project === lastSent || auditioning) return;
        const prev = lastSent;
        lastSent = s.project;
        b.send(prev ? diffCmds(prev, s.project) : projectCmds(s.project));
      });
      useUi.getState().set({ audio: 'on' });
      return b;
    } catch (e) {
      console.error(e);
      useUi.getState().set({
        audio: 'error',
        audioError: 'No pude arrancar el audio. Revisa que tu salida de sonido esté conectada y vuelve a intentar.',
      });
      starting = null;
      return null;
    }
  })();
  return starting;
}

/**
 * Plays another project (a genre template in Inicio) without touching the
 * open one. `endAudition` gives the engine back to the open project.
 */
export async function audition(p: Project): Promise<void> {
  const b = await startAudio();
  if (!b) return;
  auditioning = true;
  b.send([cmd.stop(), ...projectCmds({ ...p, mode: 'patron', metronome: false }), cmd.play()]);
}

export function endAudition(): void {
  if (!auditioning) return;
  auditioning = false;
  const b = bridgeIfReady();
  if (!b) return;
  const p = getProject();
  lastSent = p;
  b.send([cmd.stop(), ...projectCmds(p)]);
}

export const isAuditioning = (): boolean => auditioning;

/**
 * Sends the whole project again (the desktop engine restarts when the
 * outputs change). `cueApart`: the pre-listen bus has its own device.
 */
export function resync(cueApart: boolean): void {
  const b = bridgeIfReady();
  if (!b) return;
  const p = getProject();
  lastSent = p;
  b.send([cmd.stop(), cmd.master(MASTER.CUE_TO_MASTER, cueApart ? 0 : 1), ...projectCmds(p)]);
  sendAllSamples(b);
}

export function send(cmds: Cmd[]): void {
  bridgeIfReady()?.send(cmds);
}

export const isPlaying = (): boolean => getStatus()[ST.PLAYING] > 0.5;

export async function play(): Promise<void> {
  const b = await startAudio();
  b?.send([cmd.play()]);
}

export function stop(): void {
  send([cmd.stop()]);
}

export async function togglePlay(): Promise<void> {
  if (isPlaying()) stop();
  else await play();
}

/** Jumps to a bar (song mode) and keeps playing if it was. */
export function seek(bar: number): void {
  send([cmd.seek(bar)]);
}

// ------------------------------------------------------------ live notes --

const held = new Map<string, { track: number; note: number }>();

export function trackIndex(id: string): number {
  return getProject().tracks.findIndex((t) => t.id === id);
}

/** Plays a track like a pad. `key` identifies the finger/key for the release. */
export function padOn(trackId: string, vel: number, key: string, note?: number): void {
  const p = getProject();
  const i = p.tracks.findIndex((t) => t.id === trackId);
  if (i < 0) return;
  const t = p.tracks[i];
  const n = note ?? (t.kind === 'sampler' ? 60 : defaultNote(t, p.key.root));
  const prev = held.get(key);
  if (prev) send([cmd.noteOff(prev.track, prev.note)]);
  held.set(key, { track: i, note: n });
  void startAudio().then((b) => b?.send([cmd.noteOn(i, n, vel)]));
}

export function padOff(key: string): void {
  const h = held.get(key);
  if (!h) return;
  held.delete(key);
  send([cmd.noteOff(h.track, h.note)]);
}

export function releaseAll(): void {
  for (const k of [...held.keys()]) padOff(k);
}

/** Auditions a catalog sound on the pre-listen bus (does not touch the project). */
export function previewSound(s: Sound, note?: number): void {
  const n = note ?? (s.kind === 'acid' || s.kind === 'bass808' ? 33 + getProject().key.root : s.kind === 'poly' ? 60 + getProject().key.root : 60);
  void startAudio().then((b) => b?.send([cmd.preview(KIND_CODE[s.kind], s.model, n, 0.9, s.params)]));
}

// ------------------------------------------------------------- recording --

/**
 * Pattern step the person meant when they pressed a key now: the engine's
 * position, moved back by the output latency (what they were hearing).
 * Returns the global step (rounded) and whether that step is still ahead.
 */
export function quantizedStep(): { step: number; ahead: boolean } | null {
  const s = getStatus();
  if (s[ST.PLAYING] < 0.5) return null;
  const bpm = s[ST.BPM] || getProject().bpm;
  const stepMs = 60000 / bpm / 4;
  const latency = bridgeIfReady()?.latencyMs() ?? 0;
  const engineNow = s[ST.STEP] + s[ST.STEP_FRACTION] + (performance.now() - statusAt) / stepMs;
  const step = Math.max(0, Math.round(engineNow - latency / stepMs));
  // A step fires when the engine reaches it: later steps are still ahead.
  return { step, ahead: step > Math.floor(engineNow) };
}
