// Latest engine status, shared by everything that moves with the music.
import { useSyncExternalStore } from 'react';
import { MAX_TRACKS, ST, STATUS_LEN } from './protocol';

let latest: Float32Array = new Float32Array(STATUS_LEN);
const listeners = new Set<() => void>();
const rawListeners = new Set<(s: Float32Array) => void>();

const folds = new Set<StatusFold>();

export function pushStatus(s: Float32Array): void {
  latest = s;
  for (const f of folds) f.push(s);
  for (const f of rawListeners) f(s);
  for (const f of listeners) f();
}

export function getStatus(): Float32Array {
  return latest;
}

/** For meters and canvases that update the DOM directly (no React render). */
export function onLiveStatus(cb: (s: Float32Array) => void): () => void {
  rawListeners.add(cb);
  return () => rawListeners.delete(cb);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Re-renders only when the selected (primitive) value changes. */
export function useLive<T extends number | boolean | string>(select: (s: Float32Array) => T): T {
  return useSyncExternalStore(subscribe, () => select(latest), () => select(latest));
}

// Positions that keep their highest value between reads: master peaks, RMS,
// kick, snare, hats and the level of each track.
const HIGHEST = new Uint8Array(STATUS_LEN);
for (let i = ST.PEAK_L; i <= ST.HAT; i++) HIGHEST[i] = 1;
for (let i = 0; i < MAX_TRACKS; i++) HIGHEST[ST.TRACK_PEAKS + i] = 1;

/**
 * The engine writes about 75 snapshots a second and screens draw about 60.
 * A fold keeps what its reader hasn't seen yet: the newest position, the
 * highest peaks and every trigger since the last read, so no hit is lost.
 */
export class StatusFold {
  private acc = new Float32Array(STATUS_LEN);
  private fresh = false;

  push(s: ArrayLike<number>): void {
    const a = this.acc;
    if (!this.fresh) {
      a.set(s);
      this.fresh = true;
      return;
    }
    for (let i = 0; i < STATUS_LEN; i++) {
      if (i === ST.TRIGGERS) a[i] = a[i] | s[i];
      else if (HIGHEST[i]) a[i] = Math.max(a[i], s[i]);
      else a[i] = s[i];
    }
  }

  /** Everything since the last read. Triggers are reported only once. */
  read(): Float32Array {
    if (!this.fresh) this.acc[ST.TRIGGERS] = 0;
    this.fresh = false;
    return this.acc;
  }

  /** Forgets what piled up while nobody was reading. */
  reset(): void {
    this.fresh = false;
    this.acc[ST.TRIGGERS] = 0;
    for (let i = 0; i < STATUS_LEN; i++) if (HIGHEST[i]) this.acc[i] = 0;
  }
}

/** A fold fed by every snapshot the engine sends to this window. */
export function liveFold(): StatusFold {
  const f = new StatusFold();
  folds.add(f);
  return f;
}
