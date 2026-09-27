// Main window side: sends the engine status and the settings to the visuals window.
import { onLiveStatus } from '../engine/live';
import { listen, post } from './link';
import { settingsOf, useVisuals } from './settings';

let started = false;

export function startPublisher(): void {
  if (started) return;
  started = true;
  let last = 0;
  let connected = false;
  onLiveStatus((s) => {
    if (!connected) return;
    const now = performance.now();
    if (now - last < 15) return;
    last = now;
    post({ t: 'live', s: Array.from(s) });
  });
  listen((m) => {
    if (m.t === 'hello') {
      connected = true;
      post({ t: 'settings', settings: settingsOf(useVisuals.getState()) });
    } else if (m.t === 'bye') {
      connected = false;
    } else if (m.t === 'settings') {
      useVisuals.getState().set({ blackout: m.settings.blackout });
    }
  });
  useVisuals.subscribe((s, prev) => {
    if (s.scene !== prev.scene || s.mood !== prev.mood || s.brightness !== prev.brightness || s.blackout !== prev.blackout) {
      post({ t: 'settings', settings: settingsOf(s) });
    }
  });
}
