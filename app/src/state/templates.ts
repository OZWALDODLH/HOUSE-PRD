// Genre templates: a groove that already sounds, plus a song structure.
// Numbers follow docs/02-investigacion.md (BPM, dembow, K-B-B-B, etc.).
import type { SectionKind } from '../engine/protocol';
import { soundById, trackFromSound } from './instruments';
import { uid, type GenreId, type Master, type Project, type Section, type Step, type Track } from './model';

export interface Genre {
  id: GenreId;
  name: string;
  bpm: number;
  blurb: string;
  includes: string[];
  /** Kick, snare/clap and hats for the little rhythm drawing in Inicio. */
  rhythm: [number[], number[], number[]];
}

export const GENRES: Genre[] = [
  {
    id: 'techhouse',
    name: 'Tech house',
    bpm: 126,
    blurb: 'Bombo en cada tiempo, bajo rodante y percusión con swing.',
    includes: ['Kit Madrugada con shaker y conga', 'Bajo ácido rodante con bombeo', 'Stab de órgano en La menor', '72 compases con intro y salida para DJ'],
    rhythm: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14]],
  },
  {
    id: 'techno',
    name: 'Techno',
    bpm: 132,
    blurb: 'Hipnótico y recto: bombo con rumble y una línea ácida.',
    includes: ['Bombo con rumble y hats rectos', 'Línea ácida hipnótica', 'Stab oscuro en Fa menor', '80 compases pensados para mezclar'],
    rhythm: [[0, 4, 8, 12], [], Array.from({ length: 16 }, (_, i) => i)],
  },
  {
    id: 'house',
    name: 'House',
    bpm: 124,
    blurb: 'Palmas, hats abiertos y acordes de órgano.',
    includes: ['Batería clásica con palmas', 'Bajo cálido', 'Órgano en Re menor', '64 compases con pausa larga'],
    rhythm: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14]],
  },
  {
    id: 'reggaeton',
    name: 'Reggaetón',
    bpm: 95,
    blurb: 'Dembow, 808 que sigue los acordes y plucks.',
    includes: ['Dembow con caja seca', '808 que sigue los acordes', 'Plucks y pad en Do menor', 'Verso, coro y puente listos para tu voz'],
    rhythm: [[0, 4, 8, 12], [3, 6, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'lofi',
    name: 'Lo-fi',
    bpm: 82,
    blurb: 'Tranquilo, con mucho swing y acordes suaves.',
    includes: ['Batería suave con swing', 'Bajo redondo', 'Piano eléctrico con acordes de séptima', 'Bucle tranquilo para estudiar'],
    rhythm: [[0, 7, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14, 15]],
  },
];

export const genreById = (id: GenreId): Genre => GENRES.find((g) => g.id === id) ?? GENRES[0];

// ---------------------------------------------------------------- helpers --

interface TrackOpts {
  name?: string;
  vol?: number;
  pan?: number;
  sendRev?: number;
  sendDel?: number;
  duck?: number;
  length?: number;
  params?: number[];
}

function base(soundId: string, o: TrackOpts): Track {
  const s = soundById(soundId);
  if (!s) throw new Error(`Sonido desconocido: ${soundId}`);
  const t = trackFromSound(s, o.name ?? s.name, o.length ?? 16);
  t.desc = s.name === t.name ? s.desc : s.name;
  if (o.params) t.params = [...o.params, ...t.params.slice(o.params.length)];
  if (o.vol !== undefined) t.vol = o.vol;
  if (o.pan !== undefined) t.pan = o.pan;
  if (o.sendRev !== undefined) t.sendRev = o.sendRev;
  if (o.sendDel !== undefined) t.sendDel = o.sendDel;
  if (o.duck !== undefined) t.duck = o.duck;
  return t;
}

/** Drum track: `steps` are 16th positions; `vel` repeats if shorter. */
function drums(soundId: string, steps: number[], o: TrackOpts & { vel?: number[] } = {}): Track {
  const t = base(soundId, o);
  steps.forEach((s, i) => {
    const vel = o.vel ? o.vel[i % o.vel.length] : 0.85;
    t.steps[s] = { on: true, vel, len: 1, accent: false, slide: false, notes: [] };
  });
  return t;
}

type NoteSpec = [step: number, notes: number | number[], len?: number, flags?: { slide?: boolean; accent?: boolean; vel?: number }];

function notes(soundId: string, spec: NoteSpec[], o: TrackOpts = {}): Track {
  const t = base(soundId, o);
  for (const [s, n, len, f] of spec) {
    const step: Step = {
      on: true,
      vel: f?.vel ?? 0.85,
      len: len ?? 1,
      accent: !!f?.accent,
      slide: !!f?.slide,
      notes: Array.isArray(n) ? n : [n],
    };
    t.steps[s] = step;
  }
  return t;
}

/** Repeats a one-bar rhythm over several bars with a chord per bar. */
function chordBars(steps: [number, number][], chords: number[][]): NoteSpec[] {
  const out: NoteSpec[] = [];
  chords.forEach((ch, bar) => {
    for (const [s, len] of steps) out.push([bar * 16 + s, ch, len]);
  });
  return out;
}

function sections(tracks: Track[], list: [string, SectionKind, number, string[] | 'todos' | ((t: Track) => boolean)][]): Section[] {
  return list.map(([name, kind, bars, who]) => ({
    id: uid('sec'),
    name,
    kind,
    bars,
    tracks:
      who === 'todos'
        ? tracks.filter((t) => t.name !== 'Subida').map((t) => t.id)
        : typeof who === 'function'
          ? tracks.filter(who).map((t) => t.id)
          : tracks.filter((t) => who.includes(t.name)).map((t) => t.id),
  }));
}

const master = (m: Partial<Master> = {}): Master => ({
  vol: -1,
  glue: 0.35,
  ceiling: -1,
  reverbSize: 0.55,
  delaySteps: 3,
  delayFeedback: 0.38,
  autoBuild: true,
  target: 'streaming',
  ...m,
});

function project(genre: GenreId, name: string, bpm: number, swing: number, key: Project['key'], tracks: Track[], secs: Section[], m: Master): Project {
  const kick = tracks.find((t) => t.pict === 'bombo');
  const now = Date.now();
  return {
    id: uid('proyecto'),
    name,
    genre,
    bpm,
    swing,
    key,
    tracks,
    sections: secs,
    mode: 'patron',
    master: m,
    metronome: false,
    sidechainTrack: kick?.id ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

// -------------------------------------------------------------- templates --

function techhouse(): Project {
  const A1 = 33, C2 = 36, G1 = 31, E2 = 40;
  const t = [
    drums('bombo-cuerpo', [0, 4, 8, 12], { name: 'Bombo', vol: 0 }),
    drums('palmas-secas', [4, 12], { name: 'Palmas', vol: -4, sendRev: 0.22 }),
    drums('hat-cobre', [1, 3, 5, 7, 9, 11, 13, 14, 15], { name: 'Hat cerrado', vol: -12, pan: 0.15, vel: [0.75, 0.55, 0.7, 0.5, 0.75, 0.55, 0.7, 0.45, 0.6] }),
    drums('hat-abierto', [2, 6, 10, 14], { name: 'Hat abierto', vol: -9, duck: 0.25 }),
    drums('shaker', Array.from({ length: 16 }, (_, i) => i), { name: 'Shaker', vol: -16, pan: 0.35, vel: [1, 0.45, 0.75, 0.45] }),
    drums('conga-alta', [3, 6, 9, 14], { name: 'Conga', vol: -10, pan: -0.3, vel: [0.8, 0.6, 0.9, 0.7] }),
    notes('acido-rodante', [[2, A1], [3, A1, 1, { slide: true }], [6, C2], [7, A1], [10, G1], [11, A1, 1, { accent: true }], [14, E2]], { name: 'Bajo', vol: -5, duck: 0.7 }),
    notes('stab-organo', [[3, [57, 60, 64, 67]], [10, [57, 60, 64, 67]]], { name: 'Acordes', vol: -11, sendRev: 0.3, sendDel: 0.2, duck: 0.5 }),
    drums('subida', [0], { name: 'Subida', vol: -9, sendRev: 0.4 }),
    drums('impacto', [0], { name: 'Impacto', vol: -8, sendRev: 0.45 }),
  ];
  const secs = sections(t, [
    ['Intro', 'intro', 16, ['Bombo', 'Hat cerrado', 'Shaker', 'Conga']],
    ['Subida', 'subida', 8, ['Bombo', 'Hat cerrado', 'Shaker', 'Conga', 'Palmas', 'Bajo', 'Subida']],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Pausa', 'pausa', 8, ['Acordes', 'Shaker', 'Hat abierto', 'Palmas', 'Subida']],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Salida', 'salida', 8, ['Bombo', 'Hat cerrado', 'Shaker', 'Conga']],
  ]);
  return project('techhouse', 'Madrugada en la azotea', 126, 0.56, { root: 9, scale: 'menor' }, t, secs, master({ glue: 0.35 }));
}

function techno(): Project {
  const F1 = 29;
  const t = [
    drums('bombo-rumble', [0, 4, 8, 12], { name: 'Bombo', vol: 0, sendRev: 0.12 }),
    drums('hat-cobre', Array.from({ length: 16 }, (_, i) => i), { name: 'Hat cerrado', vol: -14, vel: [0.8, 0.5, 0.65, 0.5] }),
    drums('hat-abierto', [2, 6, 10, 14], { name: 'Hat abierto', vol: -12 }),
    drums('palmas-grandes', [4, 12], { name: 'Palmas', vol: -8, sendRev: 0.3 }),
    drums('rim', [3, 7, 11, 13], { name: 'Rim', vol: -13, pan: 0.2, sendDel: 0.35 }),
    notes(
      'acido-clasico',
      [
        [0, F1], [1, F1, 1, { accent: true }], [2, F1 + 12, 1, { slide: true }], [3, F1],
        [5, F1 + 3], [6, F1, 1, { accent: true }], [7, F1 + 7, 1, { slide: true }],
        [8, F1], [10, F1 + 12], [11, F1],
        [12, F1 + 3, 1, { accent: true }], [13, F1], [14, F1 + 5, 1, { slide: true }], [15, F1],
      ],
      { name: 'Ácido', vol: -7, duck: 0.6, sendDel: 0.1 },
    ),
    notes('stab-organo', [[6, [53, 56, 60]], [14, [53, 56, 60]]], { name: 'Stab', vol: -13, sendRev: 0.3, sendDel: 0.4, duck: 0.4, params: [0.45] }),
    drums('subida', [0], { name: 'Subida', vol: -9, sendRev: 0.4 }),
    drums('impacto', [0], { name: 'Impacto', vol: -8, sendRev: 0.45 }),
  ];
  const secs = sections(t, [
    ['Intro', 'intro', 16, ['Bombo', 'Hat cerrado']],
    ['Subida', 'subida', 8, ['Bombo', 'Hat cerrado', 'Rim', 'Ácido', 'Subida']],
    ['¡Drop!', 'drop', 24, 'todos'],
    ['Pausa', 'pausa', 8, ['Stab', 'Ácido', 'Hat abierto', 'Subida']],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Salida', 'salida', 8, ['Bombo', 'Hat cerrado', 'Rim']],
  ]);
  return project('techno', 'Túnel 03', 132, 0.5, { root: 5, scale: 'menor' }, t, secs, master({ glue: 0.42, reverbSize: 0.7 }));
}

function house(): Project {
  const D2 = 38;
  const t = [
    drums('bombo-cuerpo', [0, 4, 8, 12], { name: 'Bombo', vol: 0 }),
    drums('palmas-secas', [4, 12], { name: 'Palmas', vol: -5, sendRev: 0.25 }),
    drums('hat-abierto', [2, 6, 10, 14], { name: 'Hat abierto', vol: -9 }),
    drums('shaker', Array.from({ length: 16 }, (_, i) => i), { name: 'Shaker', vol: -15, pan: -0.25, vel: [1, 0.5, 0.8, 0.5] }),
    notes('bajo-suave', [[0, D2, 2], [3, D2], [6, D2 + 12], [8, D2, 2], [11, D2 + 3], [14, D2 + 7]], { name: 'Bajo', vol: -5, duck: 0.6 }),
    notes('stab-organo', [[2, [50, 53, 57, 60]], [5, [50, 53, 57, 60]], [10, [50, 53, 57, 60], 2]], { name: 'Órgano', vol: -10, sendRev: 0.25, duck: 0.4 }),
    drums('subida', [0], { name: 'Subida', vol: -9, sendRev: 0.4 }),
    drums('impacto', [0], { name: 'Impacto', vol: -8, sendRev: 0.45 }),
  ];
  const secs = sections(t, [
    ['Intro', 'intro', 16, ['Bombo', 'Hat abierto', 'Shaker']],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Pausa', 'pausa', 8, ['Órgano', 'Palmas', 'Shaker', 'Subida']],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Salida', 'salida', 8, ['Bombo', 'Hat abierto', 'Shaker']],
  ]);
  return project('house', 'Noche en Chicago', 124, 0.58, { root: 2, scale: 'menor' }, t, secs, master({ glue: 0.3 }));
}

function reggaeton(): Project {
  // i - VI - III - VII en Do menor: Cm, Ab, Eb, Bb.
  const roots = [36, 32, 39, 34];
  const plucks = [
    [60, 63, 67],
    [56, 60, 63],
    [55, 58, 63],
    [58, 62, 65],
  ];
  const pads = [
    [48, 55, 63],
    [44, 51, 60],
    [43, 51, 58],
    [46, 53, 62],
  ];
  const bass: NoteSpec[] = [];
  roots.forEach((r, bar) => {
    bass.push([bar * 16, r, 6], [bar * 16 + 8, r, 5], [bar * 16 + 14, r, 2]);
  });
  const t = [
    drums('bombo-cuerpo', [0, 4, 8, 12], { name: 'Bombo', vol: -1, params: [0.36, 0.5, 0.45, 0.3] }),
    drums('caja-dembow', [3, 6, 11, 14], { name: 'Caja', vol: -3, sendRev: 0.15 }),
    drums('hat-cobre', [0, 2, 4, 6, 8, 10, 12, 14], { name: 'Hat', vol: -14, vel: [0.8, 0.55] }),
    notes('808-perreo', bass, { name: '808', vol: -3, length: 64, duck: 0.15 }),
    notes('pluck', chordBars([[0, 2], [3, 2], [6, 2], [10, 3]], plucks), { name: 'Pluck', vol: -10, length: 64, sendRev: 0.25, sendDel: 0.15 }),
    notes('pad-madrugada', chordBars([[0, 16]], pads), { name: 'Pad', vol: -16, length: 64, sendRev: 0.35 }),
    drums('impacto', [0], { name: 'Impacto', vol: -10, sendRev: 0.4 }),
  ];
  const secs = sections(t, [
    ['Intro', 'intro', 4, ['Pluck', 'Pad']],
    ['Verso', 'verso', 16, ['Bombo', 'Caja', 'Hat', '808']],
    ['Pre-coro', 'precoro', 8, ['Pluck', 'Hat', '808', 'Caja']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 16, ['Bombo', 'Caja', 'Hat', '808', 'Pluck']],
    ['Coro', 'coro', 8, 'todos'],
    ['Puente', 'puente', 8, ['Pad', 'Pluck', 'Hat']],
    ['Coro final', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Pluck', 'Pad']],
  ]);
  return project('reggaeton', 'Perreo en la lluvia', 95, 0.52, { root: 0, scale: 'menor' }, t, secs, master({ glue: 0.35, delaySteps: 3 }));
}

function lofi(): Project {
  const chords = [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ];
  const roots = [41, 40, 38, 36];
  const bass: NoteSpec[] = [];
  roots.forEach((r, bar) => bass.push([bar * 16, r, 5], [bar * 16 + 10, r, 4]));
  const t = [
    drums('bombo-suave', [0, 7, 10], { name: 'Bombo', vol: -2 }),
    drums('caja-suave', [4, 12], { name: 'Caja', vol: -5, sendRev: 0.22 }),
    drums('hat-cobre', [0, 2, 4, 6, 8, 10, 12, 14, 15], { name: 'Hat', vol: -16, vel: [0.6, 0.4, 0.55, 0.35, 0.6, 0.4, 0.55, 0.35, 0.3], params: [0.45, 0.3, 0.35, 0.1] }),
    notes('acordes-lofi', chordBars([[0, 6], [9, 5]], chords), { name: 'Piano', vol: -8, length: 64, sendRev: 0.35, sendDel: 0.1 }),
    notes('808-largo', bass, { name: 'Bajo', vol: -7, length: 64 }),
  ];
  const secs = sections(t, [
    ['Intro', 'intro', 4, ['Piano']],
    ['A', 'verso', 8, 'todos'],
    ['B', 'coro', 8, 'todos'],
    ['A', 'verso', 8, 'todos'],
    ['Cierre', 'salida', 4, ['Piano', 'Bajo']],
  ]);
  return project('lofi', 'Para estudiar', 82, 0.62, { root: 0, scale: 'mayor' }, t, secs, master({ glue: 0.2, reverbSize: 0.75 }));
}

const BUILDERS: Record<GenreId, () => Project> = { techhouse, techno, house, reggaeton, lofi };

export function newProjectFromGenre(g: GenreId): Project {
  return BUILDERS[g]();
}

/** An empty project that keeps the genre's tempo and kit, but no notes. */
export function emptyProject(g: GenreId): Project {
  const p = BUILDERS[g]();
  p.name = 'Proyecto nuevo';
  for (const t of p.tracks) t.steps = t.steps.map(() => ({ on: false, vel: 0.85, len: 1, accent: false, slide: false, notes: [] }));
  return p;
}
