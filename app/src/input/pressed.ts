// Which pads are held right now (mouse, touch or keys), for the lights.
import { useSyncExternalStore } from 'react';

const held = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version++;
  for (const f of listeners) f();
};

export function press(id: string): void {
  held.set(id, (held.get(id) ?? 0) + 1);
  emit();
}

export function release(id: string): void {
  const n = (held.get(id) ?? 0) - 1;
  if (n <= 0) held.delete(id);
  else held.set(id, n);
  emit();
}

export function releaseEverything(): void {
  held.clear();
  emit();
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

export function useHeld(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => held.has(id),
    () => false,
  );
}

export const heldVersion = (): number => version;
