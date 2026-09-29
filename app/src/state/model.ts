import type { SectionKind } from '../engine/protocol';

export type Family = 'bateria' | 'bajo' | 'sintes' | 'voz' | 'samples' | 'efectos';
export type InstKind = 'drum' | 'acid' | 'bass808' | 'poly' | 'sampler' | 'fm' | 'super' | 'pluck';
export type Pict =
  | 'bombo'
  | 'caja'
  | 'palmas'
  | 'hat'
  | 'hatab'
  | 'rim'
  | 'conga'
  | 'shaker'
  | 'cencerro'
  | 'platillo'
  | 'timbal'
  | 'subida'
  | 'impacto'
  | 'bajo'
  | 'acordes'
  | 'sinte'
  | 'voz'
  | 'sample';
export type GenreId = 'techhouse' | 'techno' | 'house' | 'reggaeton' | 'lofi';
export type ScaleId = 'menor' | 'mayor';

export interface Step {
  on: boolean;
  vel: number;
  len: number;
  accent: boolean;
  slide: boolean;
  notes: number[];
  /** Length of each note in steps when they differ (piano roll); else `len`. */
  lens?: number[];
}

export interface Track {
  id: string;
  name: string;
  desc: string;
  family: Family;
  pict: Pict;
  kind: InstKind;
  model: number;
  preset: string;
  params: number[];
  steps: Step[];
  length: number;
  vol: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  sendRev: number;
  sendDel: number;
  duck: number;
  once: boolean;
  /** One-knob DJ filter: 0.5 = open, lower = low-pass, higher = high-pass. */
  filter: number;
  /** EQ in dB: graves, medios, agudos. */
  eq: [number, number, number];
  /** Saturation 0..1. */
  drive: number;
  sampleSlot?: number;
}

export interface Section {
  id: string;
  name: string;
  kind: SectionKind;
  bars: number;
  tracks: string[];
}

export interface Master {
  vol: number;
  glue: number;
  ceiling: number;
  reverbSize: number;
  delaySteps: number;
  delayFeedback: number;
  autoBuild: boolean;
  target: 'streaming' | 'club' | 'maximo';
}

/** What a soundboard key plays: a catalog sound or audio you recorded. */
export type SoundboardItem = { sound: string } | { slot: number; name: string; family: Family };

/** Version of the saved document; older files are upgraded when opened. */
export const PROJECT_VERSION = 2;

export interface Project {
  /** Missing in files saved before version 2. */
  version?: number;
  id: string;
  name: string;
  genre: GenreId;
  bpm: number;
  swing: number;
  key: { root: number; scale: ScaleId };
  tracks: Track[];
  sections: Section[];
  mode: 'patron' | 'cancion';
  master: Master;
  metronome: boolean;
  sidechainTrack: string | null;
  /** Key code (KeyboardEvent.code) → sound, for the Soundboard mode. */
  soundboard: Record<string, SoundboardItem>;
  createdAt: number;
  updatedAt: number;
}

export const NOTE_NAMES = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

export const SCALES: Record<ScaleId, number[]> = {
  menor: [0, 2, 3, 5, 7, 8, 10],
  mayor: [0, 2, 4, 5, 7, 9, 11],
};

export const keyName = (k: Project['key']): string => `${NOTE_NAMES[k.root]} ${k.scale}`;

export const noteName = (midi: number): string => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/** MIDI notes of the scale between two notes, low to high. */
export function scaleNotes(key: Project['key'], from: number, to: number): number[] {
  const out: number[] = [];
  const deg = SCALES[key.scale];
  for (let n = from; n <= to; n++) {
    if (deg.includes((((n - key.root) % 12) + 12) % 12)) out.push(n);
  }
  return out;
}

export const emptyStep = (): Step => ({ on: false, vel: 0.85, len: 1, accent: false, slide: false, notes: [] });

let counter = 0;
export const uid = (prefix = 'id'): string => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Instruments that play one note at a time, low (the basslines). */
export const isBassKind = (k: InstKind): boolean => k === 'acid' || k === 'bass808';
/** Instruments that play chords: every note of a step at once. */
export const isChordKind = (k: InstKind): boolean => k === 'poly' || k === 'fm' || k === 'super' || k === 'pluck';
export const isMelodic = (t: Track): boolean => isBassKind(t.kind) || isChordKind(t.kind);
