// Visual settings (chosen in the main window, applied in the visuals window)
// and the autopilot that follows the song sections.
import { create } from 'zustand';
import { SECTION_KIND_BY_CODE, ST } from '../engine/protocol';
import type { SceneId, VisualSettings } from './link';

const KEY = 'house.v1.visuales';

const defaults: VisualSettings = { scene: 'auto', mood: 0.55, brightness: 1, blackout: false };

function load(): VisualSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<VisualSettings>), blackout: false } : defaults;
  } catch {
    return defaults;
  }
}

export const useVisuals = create<VisualSettings & { set: (p: Partial<VisualSettings>) => void }>((set) => ({
  ...load(),
  set: (p) => set(p),
}));

useVisuals.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ scene: s.scene, mood: s.mood, brightness: s.brightness }));
  } catch {
    // ignore
  }
});

export const settingsOf = (s: VisualSettings): VisualSettings => ({ scene: s.scene, mood: s.mood, brightness: s.brightness, blackout: s.blackout });

const RELAX: SceneId[] = ['aurora', 'oceano', 'luciernagas'];
const PSYCH: SceneId[] = ['caleidoscopio', 'plasma', 'tunel'];
const PARTY: SceneId[] = ['ecualizador', 'reticula'];

/** Scene for a section, from its kind and the mood slider. */
export function sceneFor(kind: string, mood: number, n: number): SceneId {
  const pick = (xs: SceneId[]) => xs[((n % xs.length) + xs.length) % xs.length];
  switch (kind) {
    case 'subida':
    case 'precoro':
      return mood < 0.3 ? 'aurora' : 'tunel';
    case 'drop':
    case 'coro':
      return mood < 0.35 ? pick(PARTY) : mood > 0.7 ? pick(PSYCH) : pick([...PSYCH, ...PARTY]);
    case 'verso':
      return mood < 0.5 ? pick(RELAX) : pick(['plasma', 'reticula']);
    default:
      return mood > 0.75 ? pick(['plasma', 'caleidoscopio']) : pick(RELAX);
  }
}

/** Turns the engine status into what the scenes use; keeps its own smoothing. */
export class Autopilot {
  beats = 0;
  private lastSection = -2;
  private lastBlock = -1;
  private count = 0;
  private dropEnv = 0;
  private sm = { kick: 0, snare: 0, hat: 0, low: 0, mid: 0, high: 0, energy: 0 };
  scene: SceneId = 'aurora';
  changed = false;

  update(s: Float32Array, dt: number, mood: number) {
    const playing = s[ST.PLAYING] > 0.5;
    const bpm = s[ST.BPM] || 120;
    if (playing) this.beats += (dt * bpm) / 60;
    const bands = Array.from(s.subarray(ST.BANDS, ST.BANDS + 16));
    const avg = (a: number, b: number) => bands.slice(a, b).reduce((x, y) => x + y, 0) / (b - a);
    const k = 1 - Math.exp(-dt / 0.06);
    const follow = (key: keyof typeof this.sm, v: number) => (this.sm[key] += (v - this.sm[key]) * k);
    follow('kick', s[ST.KICK]);
    follow('snare', s[ST.SNARE]);
    follow('hat', s[ST.HAT]);
    follow('low', avg(0, 4));
    follow('mid', avg(4, 10));
    follow('high', avg(10, 16));
    follow('energy', Math.min(1, s[ST.RMS] * 3));

    const song = s[ST.MODE] > 0.5 && playing;
    const kind = song ? SECTION_KIND_BY_CODE[s[ST.CUR_KIND]] ?? 'none' : 'none';
    this.changed = false;
    if (song) {
      const sec = s[ST.SECTION];
      if (sec !== this.lastSection) {
        this.lastSection = sec;
        this.count++;
        this.scene = sceneFor(kind, mood, this.count);
        this.changed = true;
        if (kind === 'drop' || kind === 'coro') this.dropEnv = 1;
      }
    } else {
      // In loop mode, a new scene every 16 bars while it plays.
      const block = playing ? Math.floor(s[ST.BAR] / 16) : -1;
      if (block !== this.lastBlock || this.lastSection !== -1) {
        this.lastBlock = block;
        this.lastSection = -1;
        this.count++;
        this.scene = sceneFor(playing ? 'verso' : 'none', mood, this.count);
        this.changed = true;
      }
    }
    this.dropEnv = Math.max(0, this.dropEnv - dt / 2.5);
    const build = song && (kind === 'subida' || kind === 'precoro') ? s[ST.SECTION_PROGRESS] : 0;
    const speed = (0.35 + 0.65 * mood) * (0.75 + 0.5 * this.sm.energy + 0.6 * build + 0.3 * this.dropEnv) * (playing ? 1 : 0.5);
    return {
      dt,
      speed,
      beats: this.beats,
      kick: this.sm.kick,
      snare: this.sm.snare,
      hat: this.sm.hat,
      low: this.sm.low,
      mid: this.sm.mid,
      high: this.sm.high,
      energy: this.sm.energy,
      mood,
      build,
      drop: this.dropEnv,
      bands,
    };
  }
}
