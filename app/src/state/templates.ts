// Genre templates: a groove that already sounds, plus a song structure.
// Numbers follow docs/02-investigacion.md (BPM, dembow, K-B-B-B, etc.).
import { FX, type SectionKind } from '../engine/protocol';
import { soundById, trackFromSound } from './instruments';
import { uid, type GenreId, type Master, type Project, type Section, type Step, type Track } from './model';
import { buildChord, type ChordType } from './chords';
import { fxById } from './effects';

export type GenreGroup = 'electronica' | 'urbano' | 'latino' | 'tranquilo';
export const GROUP_NAME: Record<GenreGroup, string> = {
  electronica: 'Electrónica',
  urbano: 'Urbano',
  latino: 'Latino y afro',
  tranquilo: 'Tranquilo y pop',
};

export interface Genre {
  id: GenreId;
  name: string;
  group: GenreGroup;
  /** Not offered as a template (the blank project). */
  hidden?: boolean;
  bpm: number;
  blurb: string;
  includes: string[];
  /** Kick, snare/clap and hats for the little rhythm drawing in Inicio. */
  rhythm: [number[], number[], number[]];
}

export const GENRES: Genre[] = [
  {
    id: 'libre',
    name: 'Libre',
    group: 'electronica',
    hidden: true,
    bpm: 120,
    blurb: 'Un proyecto en blanco.',
    includes: [],
    rhythm: [[], [], []],
  },
  {
    id: 'techhouse',
    name: 'Tech house',
    group: 'electronica',
    bpm: 126,
    blurb: 'Bombo en cada tiempo, bajo rodante y percusión con swing.',
    includes: ['Kit Madrugada con shaker y conga', 'Bajo ácido rodante con bombeo', 'Stab de órgano en La menor', '72 compases con intro y salida para DJ'],
    rhythm: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14]],
  },
  {
    id: 'techno',
    name: 'Techno',
    group: 'electronica',
    bpm: 132,
    blurb: 'Hipnótico y recto: bombo con rumble y una línea ácida.',
    includes: ['Bombo con rumble y hats rectos', 'Línea ácida hipnótica', 'Stab oscuro en Fa menor', '80 compases pensados para mezclar'],
    rhythm: [[0, 4, 8, 12], [], Array.from({ length: 16 }, (_, i) => i)],
  },
  {
    id: 'house',
    name: 'House',
    group: 'electronica',
    bpm: 124,
    blurb: 'Palmas, hats abiertos y acordes de órgano.',
    includes: ['Batería clásica con palmas', 'Bajo cálido', 'Órgano en Re menor', '64 compases con pausa larga'],
    rhythm: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14]],
  },
  {
    id: 'reggaeton',
    name: 'Reggaetón',
    group: 'urbano',
    bpm: 95,
    blurb: 'Dembow, 808 que sigue los acordes y plucks.',
    includes: ['Dembow con caja seca', '808 que sigue los acordes', 'Plucks y pad en Do menor', 'Verso, coro y puente listos para tu voz'],
    rhythm: [[0, 4, 8, 12], [3, 6, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'lofi',
    name: 'Lo-fi',
    group: 'tranquilo',
    bpm: 82,
    blurb: 'Tranquilo, con mucho swing y acordes suaves.',
    includes: ['Batería suave con swing', 'Bajo redondo', 'Piano eléctrico con acordes de séptima', 'Bucle tranquilo para estudiar'],
    rhythm: [[0, 7, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14, 15]],
  },
  {
    id: 'trap',
    name: 'Trap',
    group: 'urbano',
    bpm: 140,
    blurb: 'Caja a medio tiempo, hats con redobles y un 808 largo.',
    includes: ['Bombo trap, caja y hats con redoble', '808 largo que sigue los acordes', 'Campanas y pad en Mi menor', 'Verso y coro listos para rapear'],
    rhythm: [[0, 7, 10], [8], [0, 2, 4, 6, 8, 10, 12, 13, 14, 15]],
  },
  {
    id: 'drill',
    name: 'Drill',
    group: 'urbano',
    bpm: 142,
    blurb: 'Oscuro, con hats que brincan y 808 que se desliza.',
    includes: ['Hats en grupos de tres', '808 con deslizamientos', 'Piano oscuro en Fa menor', 'Verso y coro'],
    rhythm: [[0, 10], [8, 14], [0, 3, 6, 8, 11, 14]],
  },
  {
    id: 'hiphop',
    name: 'Hip hop',
    group: 'urbano',
    bpm: 90,
    blurb: 'Boom bap con swing: caja fuerte y piano con crujido de vinilo.',
    includes: ['Batería boom bap con swing', 'Bajo FM redondo', 'Piano eléctrico con vinilo', 'Acordes de séptima en Re menor'],
    rhythm: [[0, 7, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14, 15]],
  },
  {
    id: 'phonk',
    name: 'Phonk',
    group: 'urbano',
    bpm: 130,
    blurb: 'Bombo distorsionado, campanas sucias y 808 al frente.',
    includes: ['Bombo distorsionado', 'Campanas con distorsión', '808 sucio', 'Hecho para manejar de noche'],
    rhythm: [[0, 6, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'dembow',
    name: 'Dembow',
    group: 'latino',
    bpm: 124,
    blurb: 'El dembow dominicano: rápido, con timbales y láser.',
    includes: ['Dembow rápido con timbal y conga', '808 que salta', 'Pluck en Sol menor', 'Láser en el coro'],
    rhythm: [[0, 4, 8, 12], [3, 6, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'cumbia',
    name: 'Cumbia',
    group: 'latino',
    bpm: 98,
    blurb: 'Guacharaca, congas, bajo que va y viene y órgano de sonidero.',
    includes: ['Guacharaca y congas', 'Bajo de tónica y quinta', 'Órgano a contratiempo', 'Requinto en Sol mayor'],
    rhythm: [[0, 8], [4, 12], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
  },
  {
    id: 'moombahton',
    name: 'Moombahton',
    group: 'latino',
    bpm: 108,
    blurb: 'Dembow lento con bajos y leads de festival.',
    includes: ['Dembow con palmas grandes', 'Bajo Reese', 'Lead de festival en Fa menor', 'Láser en los drops'],
    rhythm: [[0, 4, 8, 12], [3, 6, 11, 14], [2, 6, 10, 14]],
  },
  {
    id: 'afrobeats',
    name: 'Afrobeats',
    group: 'latino',
    bpm: 104,
    blurb: 'Clave, shaker y guitarras que bailan solas.',
    includes: ['Clave, shaker y bongos', 'Bajo pulsado', 'Guitarra de nylon en Sol mayor', 'Verso y coro'],
    rhythm: [[0, 6, 8], [4, 12], [0, 3, 6, 10, 12]],
  },
  {
    id: 'amapiano',
    name: 'Amapiano',
    group: 'latino',
    bpm: 113,
    blurb: 'El log drum de Sudáfrica, shakers y piano de séptimas.',
    includes: ['Shaker y rim con swing', 'Log drum (bajo FM) sincopado', 'Piano de séptimas en La menor', 'Para bailar largo'],
    rhythm: [[0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'pop',
    name: 'Pop',
    group: 'tranquilo',
    bpm: 110,
    blurb: 'La progresión de cientos de éxitos, lista para cantar encima.',
    includes: ['Batería pop con palmas', 'Bajo en corcheas', 'Piano y guitarra en Do mayor', 'Verso, pre-coro, coro y puente'],
    rhythm: [[0, 8, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    group: 'tranquilo',
    bpm: 100,
    blurb: 'Los ochenta: caja con eco enorme, arpegios y pads con coro.',
    includes: ['Caja grande con espacio', 'Bajo en octavas', 'Arpegio y pad con coro', 'La menor, como película de noche'],
    rhythm: [[0, 8], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'edm',
    name: 'EDM',
    group: 'electronica',
    bpm: 128,
    blurb: 'Drop de festival: lead enorme, subida y caída de sub.',
    includes: ['Bombo y palmas de festival', 'Lead de festival ancho', 'Subida, impacto y caída de sub', 'La menor épica'],
    rhythm: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14]],
  },
  {
    id: 'trance',
    name: 'Trance',
    group: 'electronica',
    bpm: 138,
    blurb: 'Bajo rodante, arpegio de supersaw y un pad gigante.',
    includes: ['Bajo rodante en semicorcheas', 'Arpegio de supersaw', 'Pad gigante en Fa menor', 'Pausa larga antes del drop'],
    rhythm: [[0, 4, 8, 12], [4, 12], [2, 6, 10, 14]],
  },
  {
    id: 'dubstep',
    name: 'Dubstep',
    group: 'electronica',
    bpm: 140,
    blurb: 'Medio tiempo y un bajo que hace wub wub.',
    includes: ['Caja a medio tiempo', 'Bajo Reese con wobble', 'Caída de sub en el drop', 'Fa menor'],
    rhythm: [[0, 10], [8], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'dnb',
    name: 'Drum & bass',
    group: 'electronica',
    bpm: 174,
    blurb: 'Rápido y rodante: dos golpes de bombo y un Reese profundo.',
    includes: ['Break de dos golpes', 'Bajo Reese largo', 'Pad en Re menor', 'Estructura para DJ'],
    rhythm: [[0, 10], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  {
    id: 'garage',
    name: 'UK garage',
    group: 'electronica',
    bpm: 132,
    blurb: 'Dos pasos con mucho swing y órgano de séptimas.',
    includes: ['Batería de dos pasos con swing', 'Bajo FM que salta', 'Órgano con séptimas', 'Sol menor'],
    rhythm: [[0, 10], [4, 12], [2, 6, 10, 14]],
  },
];

export const genreById = (id: GenreId): Genre => GENRES.find((g) => g.id === id) ?? GENRES[0];
/** The genres offered as templates. */
export const TEMPLATE_GENRES = GENRES.filter((g) => !g.hidden);

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

/** A soundboard that already plays: transitions and percussion for jams and DJ sets. */
export function defaultSoundboard(): Project['soundboard'] {
  const map: [string, string][] = [
    ['Digit1', 'impacto'],
    ['Digit2', 'subida'],
    ['Digit3', 'platillo'],
    ['Digit4', 'cencerro'],
    ['KeyQ', 'palmas-grandes'],
    ['KeyW', 'timbal'],
    ['KeyE', 'conga-baja'],
    ['KeyR', 'rim'],
    ['KeyA', 'bombo-rumble'],
    ['KeyS', 'caja-dembow'],
    ['KeyD', 'hat-abierto'],
    ['KeyF', 'shaker'],
    ['KeyZ', '808-sucio'],
    ['KeyX', 'acido-clasico'],
    ['KeyC', 'stab-organo'],
    ['KeyV', 'lead'],
  ];
  return Object.fromEntries(map.map(([code, sound]) => [code, { sound }]));
}

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
    soundboard: defaultSoundboard(),
    lanes: [],
    createdAt: now,
    updatedAt: now,
  };
}


// ----------------------------------------------------- compact helpers --

/**
 * A drum pattern written as text, one character per 16th:
 * X strong, x normal, o soft, . rest. Spaces are ignored.
 */
function beat(soundId: string, pattern: string, o: TrackOpts = {}): Track {
  const chars = [...pattern.replace(/\s/g, '')].slice(0, 64);
  const t = base(soundId, { ...o, length: o.length ?? Math.max(16, Math.ceil(chars.length / 16) * 16) });
  chars.forEach((c, i) => {
    if (c === '.') return;
    const vel = c === 'X' ? 1 : c === 'o' ? 0.5 : 0.85;
    t.steps[i] = { on: true, vel, len: 1, accent: false, slide: false, notes: [] };
  });
  return t;
}

type Key = Project['key'];

/** Chords of a progression (degrees of the key), one per bar. */
const prog = (key: Key, degrees: number[], type: ChordType = 'triada', octave = 0): number[][] => degrees.map((d) => buildChord(key, d, type, 0, octave));

/** The root of a chord moved into the octave that starts at `from`. */
const rootIn = (chord: number[], from: number): number => from + ((((chord[0] - from) % 12) + 12) % 12);

/** A bass line: the same rhythm each bar on the root of that bar's chord. */
function bassLine(chords: number[][], rhythm: [step: number, len: number, up?: number][], from = 36, flags?: (bar: number, i: number) => NoteSpec[3]): NoteSpec[] {
  const out: NoteSpec[] = [];
  chords.forEach((ch, bar) => rhythm.forEach(([s, len, up], i) => out.push([bar * 16 + s, rootIn(ch, from) + (up ?? 0), len, flags?.(bar, i)])));
  return out;
}

/** An arpeggio: chord tones in turn (going up an octave after the last one). */
function arp(chords: number[][], steps: number[], len: number, octaves = 2): NoteSpec[] {
  const out: NoteSpec[] = [];
  chords.forEach((ch, bar) => {
    const tones = Array.from({ length: ch.length * octaves }, (_, i) => ch[i % ch.length] + 12 * Math.floor(i / ch.length));
    steps.forEach((s, i) => out.push([bar * 16 + s, tones[i % tones.length], len]));
  });
  return out;
}

/** Chords moved down (or up) whole octaves. */
const shift = (chords: number[][], semis: number): number[][] => chords.map((c) => c.map((n) => n + semis));

/** Puts an effect in the first free slot of a track, with its default knobs. */
function withFx(t: Track, kind: number, knobs?: number[]): Track {
  const info = fxById(kind);
  const slot = t.fx.findIndex((f) => !f.kind);
  if (!info || slot < 0) return t;
  t.fx = t.fx.map((f, i) => (i === slot ? { kind, knobs: [...(knobs ?? info.defaults)] } : f));
  return t;
}

type Part = [name: string, kind: SectionKind, bars: number, who: string[] | 'todos'];

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


// ---------------------------------------------------------- more genres --

function trap(): Project {
  const key: Key = { root: 4, scale: 'menor' };
  const ch = prog(key, [0, 5, 3, 4]);
  const t = [
    beat('bombo-trap', 'x......x..x.....', { name: 'Bombo', vol: -1 }),
    beat('caja-trap', '........x.......', { name: 'Caja', vol: -3, sendRev: 0.15 }),
    beat('palmas-secas', '........x.......', { name: 'Palmas', vol: -9, sendRev: 0.2 }),
    beat('hat-trap', 'xoxoxoxoxoxoxxxx', { name: 'Hat', vol: -13, pan: 0.1 }),
    beat('hat-abierto', '......x.........', { name: 'Hat abierto', vol: -15, pan: -0.15 }),
    notes('808-largo', bassLine(ch, [[0, 7], [7, 3], [10, 6]], 28), { name: '808', vol: -3, length: 64 }),
    notes('campanas', arp(ch, [0, 3, 6, 8, 11, 14], 2), { name: 'Campanas', vol: -13, length: 64, sendRev: 0.3, sendDel: 0.2 }),
    notes('pad-gigante', chordBars([[0, 16]], shift(ch, -12)), { name: 'Pad', vol: -19, length: 64, sendRev: 0.35 }),
    beat('impacto', 'x', { name: 'Impacto', vol: -10, sendRev: 0.4 }),
  ];
  const beatAll = ['Bombo', 'Caja', 'Palmas', 'Hat', 'Hat abierto', '808'];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Campanas', 'Pad']],
    ['Verso', 'verso', 16, [...beatAll, 'Campanas']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 16, beatAll],
    ['Coro', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Campanas', 'Pad']],
  ]);
  return project('trap', 'Luces de la ciudad', 140, 0.5, key, t, secs, master({ glue: 0.3, delaySteps: 3 }));
}

function drill(): Project {
  const key: Key = { root: 5, scale: 'menor' };
  const ch = prog(key, [0, 3, 5, 4]);
  const t = [
    beat('bombo-trap', 'x.........x.....', { name: 'Bombo', vol: -1 }),
    beat('caja-trap', '........x.....o.', { name: 'Caja', vol: -3, sendRev: 0.12 }),
    beat('hat-trap', 'x..x..x.x..x..x.', { name: 'Hat', vol: -12 }),
    beat('rim', '...x.......x....', { name: 'Rim', vol: -15, pan: 0.25, sendDel: 0.3 }),
    notes('808-sucio', bassLine(ch, [[0, 5], [6, 3, 12], [10, 5]], 28, (_, i) => (i > 0 ? { slide: true } : undefined)), { name: '808', vol: -3, length: 64 }),
    notes('piano-fm', chordBars([[0, 16]], ch), { name: 'Piano', vol: -12, length: 64, sendRev: 0.3 }),
    notes('cristal', arp(ch, [2, 6, 10, 13], 2), { name: 'Melodía', vol: -16, length: 64, sendRev: 0.35, sendDel: 0.25 }),
  ];
  const drums = ['Bombo', 'Caja', 'Hat', 'Rim', '808'];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Piano', 'Melodía']],
    ['Verso', 'verso', 16, [...drums, 'Piano']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 16, drums],
    ['Coro', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Piano', 'Melodía']],
  ]);
  return project('drill', 'Calle fría', 142, 0.5, key, t, secs, master({ glue: 0.32 }));
}

function hiphop(): Project {
  const key: Key = { root: 2, scale: 'menor' };
  const ch = prog(key, [0, 3, 5, 4], 'septima');
  const t = [
    beat('bombo-seco', 'x......x..x.....', { name: 'Bombo', vol: -1 }),
    beat('caja-suave', '....x.......x...', { name: 'Caja', vol: -3, sendRev: 0.15 }),
    beat('hat-cobre', 'x.o.x.o.x.o.x.ox', { name: 'Hat', vol: -14, params: [0.45, 0.3, 0.4, 0.1] }),
    notes('bajo-fm', bassLine(ch, [[0, 3], [7, 2], [10, 4]], 36), { name: 'Bajo', vol: -5, length: 64 }),
    withFx(notes('rhodes-fm', chordBars([[0, 6], [8, 6]], ch), { name: 'Piano', vol: -9, length: 64, sendRev: 0.25 }), FX.VINYL),
  ];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Piano']],
    ['Verso', 'verso', 16, 'todos'],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 16, 'todos'],
    ['Coro', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Piano', 'Bajo']],
  ]);
  return project('hiphop', 'Vieja escuela', 90, 0.6, key, t, secs, master({ glue: 0.3, reverbSize: 0.5 }));
}

function phonk(): Project {
  const key: Key = { root: 1, scale: 'menor' };
  const ch = prog(key, [0, 0, 5, 4]);
  const t = [
    beat('bombo-distorsion', 'x.....x...x.....', { name: 'Bombo', vol: -2 }),
    beat('palmas-secas', '....x.......x...', { name: 'Palmas', vol: -5 }),
    beat('hat-trap', 'x.x.x.x.x.x.x.xx', { name: 'Hat', vol: -14 }),
    withFx(notes('campanas', arp(ch, [0, 3, 6, 8, 10, 12, 14], 1), { name: 'Cencerro', vol: -12, length: 64, sendDel: 0.15 }), FX.DISTORTION, [0.55, 0.55, 0.6]),
    withFx(notes('808-sucio', bassLine(ch, [[0, 6], [6, 4], [10, 6]], 28), { name: '808', vol: -4, length: 64 }), FX.DISTORTION, [0.35, 0.4, 0.5]),
  ];
  const secs = clubSections(t, {
    intro: ['Cencerro', 'Hat'],
    subida: ['Cencerro', 'Hat', 'Palmas'],
    pausa: ['Cencerro', '808'],
    salida: ['Cencerro', 'Bombo'],
  });
  return project('phonk', 'Derrape', 130, 0.5, key, t, secs, master({ glue: 0.45, target: 'club' }));
}

function dembow(): Project {
  const key: Key = { root: 7, scale: 'menor' };
  const ch = prog(key, [0, 5, 2, 6]);
  const t = [
    beat('bombo-seco', 'x...x...x...x...', { name: 'Bombo', vol: -1 }),
    beat('caja-dembow', '...x..x....x..x.', { name: 'Caja', vol: -3 }),
    beat('hat-cobre', 'x.x.x.x.x.x.x.x.', { name: 'Hat', vol: -14 }),
    beat('timbal', '..x.....x.x.....', { name: 'Timbal', vol: -10, pan: -0.2 }),
    beat('conga-alta', '..x...x...x...x.', { name: 'Conga', vol: -12, pan: 0.25 }),
    notes('808-perreo', bassLine(ch, [[0, 4], [6, 2], [8, 4], [14, 2]], 28), { name: '808', vol: -3, length: 64 }),
    notes('pluck', chordBars([[0, 2], [3, 2], [6, 2], [10, 3]], ch), { name: 'Pluck', vol: -10, length: 64, sendRev: 0.2, sendDel: 0.15 }),
    beat('laser', '............x...', { name: 'Láser', vol: -14, sendDel: 0.3 }),
  ];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Pluck', 'Timbal']],
    ['Verso', 'verso', 8, ['Bombo', 'Caja', 'Hat', '808']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 8, ['Bombo', 'Caja', 'Hat', '808', 'Conga']],
    ['Coro', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Pluck', 'Timbal', 'Conga']],
  ]);
  return project('dembow', 'Dale pa’l frente', 124, 0.5, key, t, secs, master({ glue: 0.35, target: 'club' }));
}

function cumbia(): Project {
  const key: Key = { root: 7, scale: 'mayor' };
  const ch = prog(key, [0, 4, 4, 0]);
  const t = [
    beat('bombo-suave', 'x.......x.......', { name: 'Bombo', vol: -2 }),
    beat('shaker', 'XoxoXoxoXoxoXoxo', { name: 'Guacharaca', vol: -12, pan: 0.3 }),
    beat('timbal', '....x.......x...', { name: 'Timbal', vol: -8 }),
    beat('conga-baja', '..x...xx..x...x.', { name: 'Conga', vol: -10, pan: -0.25 }),
    notes('bajo-pulsado', bassLine(ch, [[0, 3], [4, 2, 7], [8, 3], [12, 2, 7]], 36), { name: 'Bajo', vol: -4, length: 64 }),
    notes('organo', chordBars([[2, 2], [6, 2], [10, 2], [14, 2]], ch), { name: 'Órgano', vol: -12, length: 64, sendRev: 0.2 }),
    notes('requinto', arp(ch, [0, 3, 6, 8, 12], 2), { name: 'Requinto', vol: -12, length: 64, sendRev: 0.25, sendDel: 0.1 }),
  ];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Guacharaca', 'Requinto']],
    ['Verso', 'verso', 8, ['Bombo', 'Guacharaca', 'Timbal', 'Conga', 'Bajo', 'Órgano']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 8, ['Bombo', 'Guacharaca', 'Timbal', 'Conga', 'Bajo', 'Órgano']],
    ['Coro', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Guacharaca', 'Requinto', 'Conga']],
  ]);
  return project('cumbia', 'Sonidero de barrio', 98, 0.54, key, t, secs, master({ glue: 0.3 }));
}

function moombahton(): Project {
  const key: Key = { root: 5, scale: 'menor' };
  const ch = prog(key, [0, 5, 2, 6]);
  const t = [
    beat('bombo-cuerpo', 'x...x...x...x...', { name: 'Bombo', vol: 0 }),
    beat('caja-dembow', '...x..x....x..x.', { name: 'Caja', vol: -4 }),
    beat('palmas-grandes', '....x.......x...', { name: 'Palmas', vol: -7, sendRev: 0.25 }),
    beat('hat-abierto', '..x...x...x...x.', { name: 'Hat abierto', vol: -12 }),
    notes('bajo-reese', bassLine(ch, [[0, 6], [6, 4], [10, 6]], 36), { name: 'Bajo', vol: -6, length: 64, duck: 0.5 }),
    withFx(notes('lead-festival', chordBars([[0, 2], [3, 2], [6, 2], [8, 2], [11, 2], [14, 2]], ch), { name: 'Lead', vol: -11, length: 64, sendRev: 0.25, duck: 0.4 }), FX.WIDTH),
    beat('laser', '............x...', { name: 'Láser', vol: -14, sendDel: 0.3 }),
    beat('subida', 'x', { name: 'Subida', vol: -9, sendRev: 0.4 }),
    beat('impacto', 'x', { name: 'Impacto', vol: -8, sendRev: 0.45 }),
  ];
  const secs = clubSections(t, {
    intro: ['Bombo', 'Caja', 'Hat abierto'],
    subida: ['Bombo', 'Caja', 'Palmas', 'Lead', 'Subida'],
    pausa: ['Lead', 'Hat abierto', 'Subida'],
    salida: ['Bombo', 'Caja', 'Hat abierto'],
  });
  return project('moombahton', 'Tarde de verano', 108, 0.5, key, t, secs, master({ glue: 0.38, target: 'club' }));
}

function afrobeats(): Project {
  const key: Key = { root: 7, scale: 'mayor' };
  const ch = prog(key, [0, 5, 3, 4]);
  const t = [
    beat('bombo-suave', 'x.....x.x.......', { name: 'Bombo', vol: -1 }),
    beat('clave', 'x..x..x...x.x...', { name: 'Clave', vol: -12, pan: 0.2 }),
    beat('chasquido', '....x.......x...', { name: 'Chasquido', vol: -7, sendRev: 0.2 }),
    beat('shaker', 'xoxxxoxxxoxxxoxx', { name: 'Shaker', vol: -15, pan: -0.3 }),
    beat('bongo-alto', '..x..x....x..x..', { name: 'Bongo', vol: -12, pan: 0.3 }),
    notes('bajo-pulsado', bassLine(ch, [[0, 3], [6, 2], [10, 3]], 36), { name: 'Bajo', vol: -4, length: 64 }),
    notes('guitarra-nylon', arp(ch, [0, 2, 3, 5, 8, 10, 11, 13], 2), { name: 'Guitarra', vol: -11, length: 64, sendRev: 0.2, sendDel: 0.12 }),
    notes('rhodes-fm', chordBars([[0, 16]], ch), { name: 'Piano', vol: -17, length: 64, sendRev: 0.3 }),
  ];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Guitarra', 'Shaker']],
    ['Verso', 'verso', 16, ['Bombo', 'Clave', 'Chasquido', 'Shaker', 'Bajo', 'Guitarra']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 16, ['Bombo', 'Clave', 'Chasquido', 'Shaker', 'Bongo', 'Bajo', 'Guitarra']],
    ['Coro', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Guitarra', 'Shaker', 'Piano']],
  ]);
  return project('afrobeats', 'Lagos al atardecer', 104, 0.56, key, t, secs, master({ glue: 0.3 }));
}

function amapiano(): Project {
  const key: Key = { root: 9, scale: 'menor' };
  const ch = prog(key, [0, 5, 3, 4], 'septima');
  const t = [
    beat('bombo-suave', 'x...x...x...x...', { name: 'Bombo', vol: -2 }),
    beat('shaker', 'XoxoXoxoXoxoXoxo', { name: 'Shaker', vol: -14, pan: 0.3 }),
    beat('rim', '..x..x....x..x..', { name: 'Rim', vol: -12, pan: -0.2, sendDel: 0.2 }),
    beat('palmas-secas', '....x.......x...', { name: 'Palmas', vol: -8, sendRev: 0.25 }),
    notes('bajo-fm', bassLine(ch, [[3, 2], [6, 1], [7, 2], [11, 2], [14, 2]], 36), { name: 'Log drum', vol: -4, length: 64 }),
    notes('rhodes-fm', chordBars([[0, 3], [6, 3], [10, 4]], ch), { name: 'Piano', vol: -9, length: 64, sendRev: 0.3 }),
    notes('pad-madrugada', chordBars([[0, 16]], shift(ch, -12)), { name: 'Pad', vol: -18, length: 64, sendRev: 0.4 }),
  ];
  const secs = clubSections(t, {
    intro: ['Bombo', 'Shaker', 'Rim'],
    subida: ['Bombo', 'Shaker', 'Rim', 'Palmas', 'Piano'],
    pausa: ['Piano', 'Pad', 'Shaker'],
    salida: ['Bombo', 'Shaker', 'Rim'],
  });
  return project('amapiano', 'Johannesburgo', 113, 0.58, key, t, secs, master({ glue: 0.3 }));
}

function pop(): Project {
  const key: Key = { root: 0, scale: 'mayor' };
  const ch = prog(key, [0, 4, 5, 3]);
  const t = [
    beat('bombo-seco', 'x.......x.x.....', { name: 'Bombo', vol: -1 }),
    beat('palmas-grandes', '....x.......x...', { name: 'Palmas', vol: -5, sendRev: 0.2 }),
    beat('hat-cobre', 'x.o.x.o.x.o.x.o.', { name: 'Hat', vol: -14 }),
    notes('bajo-fm', bassLine(ch, [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]], 36), { name: 'Bajo', vol: -6, length: 64 }),
    notes('piano-fm', chordBars([[0, 4], [4, 4], [8, 4], [12, 4]], ch), { name: 'Piano', vol: -10, length: 64, sendRev: 0.25 }),
    notes('guitarra-acustica', arp(ch, [0, 3, 6, 8, 10, 12, 14], 2), { name: 'Guitarra', vol: -14, length: 64, pan: 0.3, sendRev: 0.2 }),
  ];
  const secs = songSections(t, [
    ['Intro', 'intro', 4, ['Piano']],
    ['Verso', 'verso', 8, ['Bombo', 'Hat', 'Bajo', 'Piano']],
    ['Pre-coro', 'precoro', 4, ['Palmas', 'Bajo', 'Piano', 'Guitarra']],
    ['Coro', 'coro', 8, 'todos'],
    ['Verso 2', 'verso', 8, ['Bombo', 'Hat', 'Bajo', 'Piano', 'Guitarra']],
    ['Pre-coro', 'precoro', 4, ['Palmas', 'Bajo', 'Piano', 'Guitarra']],
    ['Coro', 'coro', 8, 'todos'],
    ['Puente', 'puente', 8, ['Piano', 'Guitarra']],
    ['Coro final', 'coro', 8, 'todos'],
    ['Salida', 'salida', 4, ['Piano']],
  ]);
  return project('pop', 'Canción de verano', 110, 0.5, key, t, secs, master({ glue: 0.3 }));
}

function synthwave(): Project {
  const key: Key = { root: 9, scale: 'menor' };
  const ch = prog(key, [0, 5, 2, 6]);
  const t = [
    beat('bombo-seco', 'x.......x.......', { name: 'Bombo', vol: -1 }),
    beat('caja-grande', '....x.......x...', { name: 'Caja', vol: -3, sendRev: 0.45 }),
    beat('hat-cobre', 'x.o.x.o.x.o.x.o.', { name: 'Hat', vol: -15 }),
    notes('bajo-suave', bassLine(ch, [[0, 1], [2, 1, 12], [4, 1], [6, 1, 12], [8, 1], [10, 1, 12], [12, 1], [14, 1, 12]], 36), { name: 'Bajo', vol: -6, length: 64 }),
    notes('pluck', arp(ch, [0, 2, 4, 6, 8, 10, 12, 14], 2), { name: 'Arpegio', vol: -12, length: 64, sendDel: 0.3, sendRev: 0.2 }),
    withFx(notes('pad-madrugada', chordBars([[0, 16]], ch), { name: 'Pad', vol: -14, length: 64, sendRev: 0.4 }), FX.CHORUS),
  ];
  const secs = songSections(t, [
    ['Intro', 'intro', 8, ['Pad', 'Arpegio']],
    ['Verso', 'verso', 16, ['Bombo', 'Caja', 'Hat', 'Bajo', 'Pad']],
    ['Coro', 'coro', 16, 'todos'],
    ['Puente', 'puente', 8, ['Pad', 'Arpegio', 'Bajo']],
    ['Coro', 'coro', 16, 'todos'],
    ['Salida', 'salida', 8, ['Pad', 'Arpegio']],
  ]);
  return project('synthwave', 'Autopista 1986', 100, 0.5, key, t, secs, master({ glue: 0.3, reverbSize: 0.8, delaySteps: 3 }));
}

function edm(): Project {
  const key: Key = { root: 9, scale: 'menor' };
  const ch = prog(key, [0, 6, 5, 6]);
  const t = [
    beat('bombo-cuerpo', 'x...x...x...x...', { name: 'Bombo', vol: 0 }),
    beat('palmas-grandes', '....x.......x...', { name: 'Palmas', vol: -5, sendRev: 0.25 }),
    beat('hat-abierto', '..x...x...x...x.', { name: 'Hat abierto', vol: -11 }),
    notes('bajo-suave', bassLine(ch, [[2, 2], [6, 2], [10, 2], [14, 2]], 36), { name: 'Bajo', vol: -5, length: 64, duck: 0.7 }),
    withFx(notes('lead-festival', chordBars([[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]], ch), { name: 'Lead', vol: -10, length: 64, sendRev: 0.3, duck: 0.5 }), FX.WIDTH),
    notes('pad-gigante', chordBars([[0, 16]], shift(ch, -12)), { name: 'Pad', vol: -16, length: 64, sendRev: 0.4, duck: 0.5 }),
    beat('subida', 'x', { name: 'Subida', vol: -9, sendRev: 0.4 }),
    beat('impacto', 'x', { name: 'Impacto', vol: -8, sendRev: 0.45 }),
    beat('caida-sub', 'x', { name: 'Caída de sub', vol: -6 }),
  ];
  const secs = clubSections(t, {
    intro: ['Bombo', 'Hat abierto', 'Pad'],
    subida: ['Bombo', 'Palmas', 'Pad', 'Lead', 'Subida'],
    pausa: ['Pad', 'Lead', 'Subida'],
    salida: ['Bombo', 'Hat abierto', 'Pad'],
  });
  return project('edm', 'Escenario principal', 128, 0.5, key, t, secs, master({ glue: 0.4, target: 'club' }));
}

function trance(): Project {
  const key: Key = { root: 5, scale: 'menor' };
  const ch = prog(key, [0, 6, 5, 6]);
  const rolling: [number, number][] = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((s) => [s, 1]);
  const t = [
    beat('bombo-cuerpo', 'x...x...x...x...', { name: 'Bombo', vol: 0 }),
    beat('palmas-secas', '....x.......x...', { name: 'Palmas', vol: -7, sendRev: 0.3 }),
    beat('hat-abierto', '..x...x...x...x.', { name: 'Hat abierto', vol: -11 }),
    beat('ride', 'x.x.x.x.x.x.x.x.', { name: 'Ride', vol: -18, pan: 0.2 }),
    notes('bajo-suave', bassLine(ch, rolling, 36), { name: 'Bajo', vol: -6, length: 64, duck: 0.7 }),
    withFx(notes('supersaw', arp(ch, Array.from({ length: 16 }, (_, i) => i), 1), { name: 'Arpegio', vol: -13, length: 64, sendDel: 0.25, duck: 0.4 }), FX.WIDTH),
    notes('pad-gigante', chordBars([[0, 16]], ch), { name: 'Pad', vol: -14, length: 64, sendRev: 0.45, duck: 0.4 }),
    beat('subida', 'x', { name: 'Subida', vol: -9, sendRev: 0.4 }),
    beat('impacto', 'x', { name: 'Impacto', vol: -8, sendRev: 0.45 }),
  ];
  const secs = clubSections(t, {
    intro: ['Bombo', 'Hat abierto', 'Ride', 'Bajo'],
    subida: ['Bombo', 'Palmas', 'Bajo', 'Arpegio', 'Subida'],
    pausa: ['Pad', 'Arpegio', 'Subida'],
    salida: ['Bombo', 'Hat abierto', 'Ride'],
  });
  return project('trance', 'Amanecer en la playa', 138, 0.5, key, t, secs, master({ glue: 0.38, reverbSize: 0.75 }));
}

function dubstep(): Project {
  const key: Key = { root: 5, scale: 'menor' };
  const ch = prog(key, [0, 0, 5, 4]);
  const t = [
    beat('bombo-trap', 'x.........x.....', { name: 'Bombo', vol: 0 }),
    beat('caja-trap', '........x.......', { name: 'Caja', vol: -2, sendRev: 0.2 }),
    beat('hat-cobre', 'x.o.x.o.x.o.x.o.', { name: 'Hat', vol: -15 }),
    withFx(notes('bajo-reese', bassLine(ch, [[0, 6], [8, 4], [12, 4, 3]], 36), { name: 'Wobble', vol: -6, length: 64 }), FX.WOBBLE, [0.55, 0.8, 0.6]),
    notes('pad-madrugada', chordBars([[0, 16]], ch), { name: 'Pad', vol: -15, length: 64, sendRev: 0.45 }),
    beat('subida', 'x', { name: 'Subida', vol: -9, sendRev: 0.4 }),
    beat('caida-sub', 'x', { name: 'Caída de sub', vol: -5 }),
  ];
  const secs = clubSections(t, {
    intro: ['Pad', 'Hat'],
    subida: ['Pad', 'Caja', 'Hat', 'Subida'],
    pausa: ['Pad', 'Subida'],
    salida: ['Pad', 'Hat'],
  });
  return project('dubstep', 'Terremoto', 140, 0.5, key, t, secs, master({ glue: 0.42, target: 'club' }));
}

function dnb(): Project {
  const key: Key = { root: 2, scale: 'menor' };
  const ch = prog(key, [0, 5, 3, 4]);
  const t = [
    beat('bombo-seco', 'x.........x.....', { name: 'Bombo', vol: 0 }),
    beat('caja-trap', '....x.......x...', { name: 'Caja', vol: -2, sendRev: 0.15 }),
    beat('hat-cobre', 'x.o.x.o.x.o.x.oo', { name: 'Hat', vol: -14 }),
    beat('ride', '..x...x...x...x.', { name: 'Ride', vol: -18, pan: 0.25 }),
    notes('bajo-reese', bassLine(ch, [[0, 8], [10, 6]], 36), { name: 'Reese', vol: -5, length: 64, duck: 0.4 }),
    notes('pad-gigante', chordBars([[0, 16]], ch), { name: 'Pad', vol: -16, length: 64, sendRev: 0.4 }),
    beat('subida', 'x', { name: 'Subida', vol: -9, sendRev: 0.4 }),
    beat('impacto', 'x', { name: 'Impacto', vol: -8, sendRev: 0.45 }),
  ];
  const secs = clubSections(t, {
    intro: ['Hat', 'Ride', 'Pad'],
    subida: ['Hat', 'Ride', 'Caja', 'Pad', 'Subida'],
    pausa: ['Pad', 'Reese', 'Subida'],
    salida: ['Bombo', 'Hat', 'Ride'],
  });
  return project('dnb', 'Túnel de luz', 174, 0.5, key, t, secs, master({ glue: 0.38, target: 'club' }));
}

function garage(): Project {
  const key: Key = { root: 7, scale: 'menor' };
  const ch = prog(key, [0, 3, 5, 4], 'septima');
  const t = [
    beat('bombo-seco', 'x.........x.....', { name: 'Bombo', vol: 0 }),
    beat('palmas-secas', '....x.......x...', { name: 'Palmas', vol: -4, sendRev: 0.2 }),
    beat('hat-cobre', '..x...x...x...xo', { name: 'Hat', vol: -12 }),
    beat('shaker', 'xoxoxoxoxoxoxoxo', { name: 'Shaker', vol: -17, pan: 0.3 }),
    notes('bajo-fm', bassLine(ch, [[0, 2], [3, 1], [6, 2], [10, 2], [13, 2]], 36), { name: 'Bajo', vol: -5, length: 64, duck: 0.5 }),
    notes('organo', chordBars([[0, 2], [3, 2], [7, 2], [10, 3]], ch), { name: 'Órgano', vol: -11, length: 64, sendRev: 0.25, duck: 0.4 }),
  ];
  const secs = clubSections(t, {
    intro: ['Bombo', 'Hat', 'Shaker'],
    subida: ['Bombo', 'Hat', 'Shaker', 'Palmas', 'Órgano'],
    pausa: ['Órgano', 'Shaker'],
    salida: ['Bombo', 'Hat', 'Shaker'],
  });
  return project('garage', 'Domingo en Londres', 132, 0.64, key, t, secs, master({ glue: 0.32 }));
}

/** Club structure: intro and outro for DJs, a build-up, two drops and a break. */
function clubSections(t: Track[], who: { intro: string[]; subida: string[]; pausa: string[]; salida: string[] }): Section[] {
  return songSections(t, [
    ['Intro', 'intro', 16, who.intro],
    ['Subida', 'subida', 8, who.subida],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Pausa', 'pausa', 8, who.pausa],
    ['¡Drop!', 'drop', 16, 'todos'],
    ['Salida', 'salida', 8, who.salida],
  ]);
}

/** Sections from names; "todos" = every track except the build-up sounds. */
function songSections(t: Track[], parts: Part[]): Section[] {
  return sections(t, parts);
}

/** Nothing in it: no tracks, one part of 16 bars, 120 BPM in C minor. */
export function blankProject(): Project {
  const part: Section = { id: uid('sec'), name: 'Parte 1', kind: 'none', bars: 16, tracks: [] };
  const p = project('libre', 'Proyecto en blanco', 120, 0.5, { root: 0, scale: 'menor' }, [], [part], master());
  p.soundboard = {};
  return p;
}

const BUILDERS: Record<GenreId, () => Project> = {
  libre: blankProject,
  techhouse,
  techno,
  house,
  reggaeton,
  lofi,
  trap,
  drill,
  hiphop,
  phonk,
  dembow,
  cumbia,
  moombahton,
  afrobeats,
  amapiano,
  pop,
  synthwave,
  edm,
  trance,
  dubstep,
  dnb,
  garage,
};

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
