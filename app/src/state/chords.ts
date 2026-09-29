// Chords for people who never studied music: names in Spanish ("Lam",
// "Sol7"), the seven chords that fit the key with what each one feels like,
// and ready-made progressions.
import { NOTE_NAMES, SCALES, type Project } from './model';

interface Quality {
  suffix: string;
  name: string;
  iv: number[];
}

const QUALITIES: Quality[] = [
  { suffix: '', name: 'mayor', iv: [0, 4, 7] },
  { suffix: 'm', name: 'menor', iv: [0, 3, 7] },
  { suffix: '°', name: 'disminuido', iv: [0, 3, 6] },
  { suffix: '+', name: 'aumentado', iv: [0, 4, 8] },
  { suffix: 'sus2', name: 'suspendido 2', iv: [0, 2, 7] },
  { suffix: 'sus4', name: 'suspendido 4', iv: [0, 5, 7] },
  { suffix: '7', name: 'con séptima', iv: [0, 4, 7, 10] },
  { suffix: 'maj7', name: 'con séptima mayor', iv: [0, 4, 7, 11] },
  { suffix: 'm7', name: 'menor con séptima', iv: [0, 3, 7, 10] },
  { suffix: 'm7♭5', name: 'semidisminuido', iv: [0, 3, 6, 10] },
  { suffix: '°7', name: 'disminuido con séptima', iv: [0, 3, 6, 9] },
  { suffix: 'add9', name: 'con novena', iv: [0, 2, 4, 7] },
  { suffix: 'madd9', name: 'menor con novena', iv: [0, 2, 3, 7] },
  { suffix: '5', name: 'quinta (power)', iv: [0, 7] },
];

const pc = (n: number) => ((n % 12) + 12) % 12;

/** Root and quality of a set of notes, or null if it is not a chord we know. */
export function detectChord(notes: number[]): { root: number; q: Quality } | null {
  const pcs = [...new Set(notes.map(pc))];
  if (pcs.length < 2) return null;
  const bass = pc(Math.min(...notes));
  // Try the lowest note first, so "Do/Mi" reads as Do.
  const roots = [bass, ...pcs.filter((x) => x !== bass)];
  for (const r of roots) {
    const iv = pcs.map((x) => pc(x - r)).sort((a, b) => a - b);
    const q = QUALITIES.find((q) => q.iv.length === iv.length && q.iv.every((v, i) => v === iv[i]));
    if (q) return { root: r, q };
  }
  return null;
}

/** Short name: "Lam", "Fa", "Sol7". */
export function chordLabel(notes: number[]): string | null {
  const c = detectChord(notes);
  return c ? `${NOTE_NAMES[c.root]}${c.q.suffix}` : null;
}

/** Long name: "La menor". */
export function chordLongName(notes: number[]): string | null {
  const c = detectChord(notes);
  return c ? `${NOTE_NAMES[c.root]} ${c.q.name}` : null;
}

export type ChordType = 'triada' | 'septima' | 'sus2' | 'sus4' | 'power';

export interface ChordChoice {
  degree: number;
  /** Roman numeral: upper case = major, lower case = minor. */
  roman: string;
  label: string;
  notes: number[];
  /** What it feels like, in plain words. */
  feel: string;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const FEEL: Record<Project['key']['scale'], string[]> = {
  menor: ['La casa: el acorde principal, oscuro', 'Tenso, pide moverse', 'Luminoso, abre la canción', 'Melancólico', 'Suspenso suave', 'Épico y emotivo', 'Levanta y prepara el regreso'],
  mayor: ['La casa: el acorde principal, alegre', 'Suave, en movimiento', 'Nostálgico', 'Abierto, como un suspiro', 'Tensión que pide regresar a casa', 'Triste y bonito', 'Muy tenso'],
};

/** Notes of a chord built on a degree of the key, around middle C. */
export function buildChord(key: Project['key'], degree: number, type: ChordType = 'triada', inversion = 0, octave = 0): number[] {
  const sc = SCALES[key.scale];
  const at = (d: number) => {
    const oct = Math.floor(d / 7);
    return key.root + sc[d % 7] + oct * 12;
  };
  let root = at(degree);
  // Keep the root between Sol 3 and Fa# 4 so chords sit in the middle.
  root = 60 + pc(root - 60);
  if (root > 66) root -= 12;
  const shift = root - at(degree);
  const tone = (steps: number) => at(degree + steps) + shift;
  let notes: number[];
  if (type === 'power') notes = [root, tone(4)];
  else if (type === 'sus2') notes = [root, root + 2, tone(4)];
  else if (type === 'sus4') notes = [root, root + 5, tone(4)];
  else if (type === 'septima') notes = [root, tone(2), tone(4), tone(6)];
  else notes = [root, tone(2), tone(4)];
  for (let i = 0; i < inversion; i++) {
    const lo = notes.shift()!;
    notes.push(lo + 12);
  }
  return notes.map((n) => n + octave * 12);
}

/** The seven chords of the key, with their numeral and feeling. */
export function diatonicChords(key: Project['key'], type: ChordType = 'triada'): ChordChoice[] {
  return Array.from({ length: 7 }, (_, d) => {
    const notes = buildChord(key, d, type);
    const c = detectChord(buildChord(key, d, 'triada'));
    const minor = c?.q.suffix === 'm' || c?.q.suffix === '°';
    const roman = (minor ? ROMAN[d].toLowerCase() : ROMAN[d]) + (c?.q.suffix === '°' ? '°' : '');
    return { degree: d, roman, label: chordLabel(notes) ?? '?', notes, feel: FEEL[key.scale][d] };
  });
}

export interface Progression {
  name: string;
  degrees: number[];
  type?: ChordType;
  /** Where you hear it. */
  where: string;
}

export const PROGRESSIONS: Record<Project['key']['scale'], Progression[]> = {
  menor: [
    { name: 'La del reggaetón', degrees: [0, 5, 2, 6], where: 'Reggaetón, pop latino, dembow' },
    { name: 'Épica', degrees: [0, 6, 5, 6], where: 'EDM, trance, himnos de festival' },
    { name: 'Melancólica', degrees: [0, 3, 5, 4], where: 'Baladas, lo-fi, trap triste' },
    { name: 'Andaluza', degrees: [0, 6, 5, 4], where: 'Flamenco, rumba, música latina' },
    { name: 'Oscura', degrees: [0, 5, 3, 4], where: 'Trap, drill, phonk' },
    { name: 'Hipnótica', degrees: [0, 0, 5, 6], where: 'Techno, tech house, deep house' },
  ],
  mayor: [
    { name: 'La del pop', degrees: [0, 4, 5, 3], where: 'Cientos de éxitos pop' },
    { name: 'Alegre', degrees: [0, 3, 4, 3], where: 'Cumbia, rock, música de fiesta' },
    { name: 'Sentimental', degrees: [5, 3, 0, 4], where: 'Pop emocional, baladas' },
    { name: 'De los 50', degrees: [0, 5, 3, 4], where: 'Doo-wop, R&B clásico' },
    { name: 'Con séptimas', degrees: [1, 4, 0, 0], type: 'septima', where: 'Jazz, neo-soul, lo-fi' },
    { name: 'House clásico', degrees: [5, 3, 4, 0], type: 'septima', where: 'House, garage, disco' },
  ],
};

/** Moves a chord up or down one inversion, keeping it near where it was. */
export function invert(notes: number[], dir: 1 | -1): number[] {
  const n = [...notes].sort((a, b) => a - b);
  if (dir > 0) n.push(n.shift()! + 12);
  else n.unshift(n.pop()! - 12);
  return n;
}
