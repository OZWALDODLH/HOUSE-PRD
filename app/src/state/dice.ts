// "Dados": a new pattern for one track, inside the song's style and key.
import { edit, mapTrack } from './store';
import { SCALES, emptyStep, isChordKind, type GenreId, type Project, type Step, type Track } from './model';

type Rand = () => number;

const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const chance = (r: Rand, p: number): boolean => r() < p;

function mulberry(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hit = (vel = 0.85, extra: Partial<Step> = {}): Step => ({ ...emptyStep(), on: true, vel, ...extra });

/** Scale note by degree (can be negative or above 7), starting at `base`. */
export function degreeNote(key: Project['key'], degree: number, base: number): number {
  const sc = SCALES[key.scale];
  const oct = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return base + key.root + sc[d] + oct * 12;
}

/** Diatonic chord on a degree, voiced near `center`. */
export function chord(key: Project['key'], degree: number, size: 3 | 4, center = 60): number[] {
  const notes = Array.from({ length: size }, (_, k) => degreeNote(key, degree + k * 2, 0));
  const mean = notes.reduce((a, b) => a + b, 0) / notes.length;
  const shift = Math.round((center - mean) / 12) * 12;
  return notes.map((n) => n + shift).sort((a, b) => a - b);
}

const PROGRESSIONS: Record<'menor' | 'mayor', number[][]> = {
  menor: [
    [0, 5, 2, 6],
    [0, 3, 4, 0],
    [0, 6, 5, 6],
    [0, 3, 6, 2],
    [0, 0, 5, 4],
  ],
  mayor: [
    [0, 4, 5, 3],
    [1, 4, 0, 0],
    [3, 2, 1, 0],
    [0, 5, 3, 4],
  ],
};

function drumSteps(t: Track, genre: GenreId, r: Rand): Step[] {
  const s = Array.from({ length: 16 }, emptyStep);
  const set = (idx: number[], vel: number | number[] = 0.85) => idx.forEach((i, k) => (s[i] = hit(Array.isArray(vel) ? vel[k % vel.length] : vel)));
  const four = genre !== 'lofi';
  switch (t.pict) {
    case 'bombo':
      if (four) {
        set([0, 4, 8, 12], 0.95);
        if (chance(r, 0.25)) s[pick(r, [14, 15, 7])] = hit(0.55);
      } else set(pick(r, [[0, 7, 10], [0, 6, 10], [0, 3, 8, 10], [0, 8, 11]]), 0.9);
      break;
    case 'caja':
    case 'palmas':
      if (genre === 'reggaeton') set(pick(r, [[3, 6, 11, 14], [3, 7, 11, 14], [3, 6, 10, 14]]), 0.9);
      else set([4, 12], 0.9);
      if (chance(r, 0.35)) s[pick(r, [15, 14, 7])] = hit(0.45);
      break;
    case 'hat':
      if (genre === 'techno') set(Array.from({ length: 16 }, (_, i) => i), [0.8, 0.45, 0.65, 0.45]);
      else if (genre === 'reggaeton' || genre === 'lofi') set([0, 2, 4, 6, 8, 10, 12, 14], [0.75, 0.5]);
      else {
        set([2, 6, 10, 14], 0.8);
        for (const i of [1, 3, 5, 7, 9, 11, 13, 15]) if (chance(r, 0.45)) s[i] = hit(0.4 + r() * 0.25);
      }
      break;
    case 'hatab':
      set([2, 6, 10, 14], 0.8);
      break;
    case 'shaker':
      set(Array.from({ length: 16 }, (_, i) => i), [1, 0.45, 0.75, 0.45]);
      break;
    case 'platillo':
    case 'subida':
    case 'impacto':
      set([0], 0.9);
      break;
    default: {
      // Percussion: syncopated, avoiding the kick.
      const slots = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15];
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) s[pick(r, slots)] = hit(0.55 + r() * 0.4);
    }
  }
  return s;
}

function bassSteps(t: Track, p: Project, r: Rand): Step[] {
  const s = Array.from({ length: 64 }, emptyStep);
  // Root between E1 and D#2: deep, but still audible on small speakers.
  const low = p.key.root >= 4 ? 24 : 36;
  if (p.genre === 'reggaeton' || p.genre === 'lofi' || t.length > 16) {
    // Follows a chord progression, one chord per bar.
    const prog = pick(r, PROGRESSIONS[p.key.scale]);
    const bars = Math.max(1, Math.round(t.length / 16));
    const rhythm = p.genre === 'reggaeton' ? pick(r, [[0, 8, 14], [0, 3, 8, 14], [0, 6, 8]]) : pick(r, [[0, 10], [0, 7, 10], [0, 8]]);
    for (let b = 0; b < bars; b++) {
      const root = degreeNote(p.key, prog[b % prog.length], low);
      rhythm.forEach((st, k) => {
        const len = (rhythm[k + 1] ?? 16) - st;
        s[b * 16 + st] = hit(k === 0 ? 0.95 : 0.8, { notes: [root], len: Math.max(1, len - (t.kind === 'bass808' ? 0 : 1)), slide: k > 0 && chance(r, 0.15) });
      });
    }
    return s;
  }
  // Rolling 16th-note line (tech house, techno, house).
  const offbeat = [2, 3, 6, 7, 10, 11, 14, 15];
  const density = p.genre === 'techno' ? 0.75 : 0.55;
  const degs = [0, 0, 0, 7, 2, 4, 6, -1];
  for (let i = 0; i < 16; i++) {
    const want = offbeat.includes(i) ? chance(r, density) : chance(r, 0.12);
    if (!want) continue;
    const d = pick(r, degs);
    s[i] = hit(0.8, { notes: [degreeNote(p.key, d, low)], accent: chance(r, 0.22), slide: chance(r, 0.18) });
  }
  if (!s.some((x) => x.on)) s[2] = hit(0.8, { notes: [degreeNote(p.key, 0, low)] });
  return s;
}

function chordSteps(t: Track, p: Project, r: Rand): Step[] {
  const s = Array.from({ length: 64 }, emptyStep);
  const prog = pick(r, PROGRESSIONS[p.key.scale]);
  const bars = Math.max(1, Math.round(t.length / 16));
  const pad = t.preset.includes('Pad') || t.preset.includes('lo-fi');
  const seventh = p.genre === 'lofi' || p.genre === 'house';
  const rhythm: [number, number][] = pad
    ? [[0, 16]]
    : p.genre === 'reggaeton'
      ? pick(r, [[[0, 2], [3, 2], [6, 2], [10, 3]], [[0, 3], [3, 3], [8, 2], [11, 3]]] as [number, number][][])
      : pick(r, [[[3, 1], [10, 1]], [[2, 1], [5, 1], [10, 2]], [[3, 1], [6, 1], [11, 1], [14, 1]]] as [number, number][][]);
  for (let b = 0; b < bars; b++) {
    const deg = bars === 1 ? prog[0] : prog[b % prog.length];
    const notes = chord(p.key, deg, seventh ? 4 : 3, pad ? 55 : 62);
    for (const [st, len] of rhythm) s[b * 16 + st] = hit(0.8, { notes, len });
  }
  return s;
}

/** Rolls new steps for a track; keeps its sound, length and mix. */
export function rollDice(id: string, seed = Date.now()): void {
  const r = mulberry(seed);
  edit(null, (p) =>
    mapTrack(p, id, (t) => {
      let steps: Step[];
      if (t.kind === 'drum' || t.kind === 'sampler') {
        const bar = drumSteps(t, p.genre, r);
        steps = Array.from({ length: 64 }, (_, i) => ({ ...bar[i % 16] }));
        if (t.kind === 'sampler') steps = steps.map((s) => (s.on ? { ...s, notes: [60] } : s));
      } else if (isChordKind(t.kind)) steps = chordSteps(t, p, r);
      else steps = bassSteps(t, p, r);
      return { ...t, steps };
    }),
  );
}
