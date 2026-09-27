// Latest engine status, shared by everything that moves with the music.
import { useSyncExternalStore } from 'react';
import { STATUS_LEN } from './protocol';

let latest: Float32Array = new Float32Array(STATUS_LEN);
const listeners = new Set<() => void>();
const rawListeners = new Set<(s: Float32Array) => void>();

export function pushStatus(s: Float32Array): void {
  latest = s;
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
