// One animation loop for everything that moves with the music (meters,
// playhead, speaker). Components update the DOM directly, without re-rendering.
import { useEffect, useRef } from 'react';
import { getStatus } from '../engine/live';

type Cb = (s: Float32Array, dt: number) => void;
const cbs = new Set<Cb>();
let raf = 0;
let last = 0;

function loop(t: number) {
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
  last = t;
  const s = getStatus();
  for (const f of cbs) f(s, dt);
  raf = cbs.size ? requestAnimationFrame(loop) : 0;
}

export function onFrame(cb: Cb): () => void {
  cbs.add(cb);
  if (!raf) {
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  return () => {
    cbs.delete(cb);
  };
}

/** Runs `cb` every frame while the component is mounted; `cb` may change freely. */
export function useFrame(cb: Cb): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => onFrame((s, dt) => ref.current(s, dt)), []);
}

export const toDb = (x: number): number => (x > 1e-6 ? 20 * Math.log10(x) : -120);
