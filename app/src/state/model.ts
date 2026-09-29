import type { SectionKind } from '../engine/protocol';
import type { FxSlot } from './effects';

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
  | 'sample'
  | 'tom'
  | 'chasquido'
  | 'clave'
  | 'pandero'
  | 'bongo'
  | 'bajada'
  | 'laser'
  | 'corneta'
  | 'guitarra'
  | 'sierra';
export type GenreId =
  | 'libre'
  | 'techhouse'
  | 'techno'
  | 'house'
  | 'reggaeton'
  | 'lofi'
  | 'trap'
  | 'drill'
  | 'hiphop'
  | 'dembow'
  | 'cumbia'
  | 'moombahton'
  | 'afrobeats'
  | 'amapiano'
  | 'pop'
  | 'edm'
  | 'trance'
  | 'dubstep'
  | 'dnb'
  | 'garage'
  | 'synthwave'
  | 'phonk';
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
  /** Two insert effects (kind 0 = empty slot). */
  fx: FxSlot[];
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

/** A point of an automation curve: song position in steps, value 0..1, bend of the next segment (-1..1). */
export interface AutoPoint {
  pos: number;
  value: number;
  tension: number;
}

/**
 * A curve that moves a knob over the song (Arreglo view). `param` follows
 * automation.rs: master 0 Filtro, 1 Volumen, 2 Espacio, 3 Eco; tracks 0 Volumen,
 * 1 Filtro, 2 Paneo, 3 Envío a espacio, 4 Envío a eco, 8..15 knobs of the
 * instrument, 16..21 knobs of the effects.
 */
export interface AutoLane {
  id: string;
  target: 'master' | 'track';
  trackId?: string;
  param: number;
  points: AutoPoint[];
}

/** What a soundboard key plays: a catalog sound or audio you recorded (with its cut). */
export type SoundboardItem = { sound: string } | { slot: number; name: string; family: Family; params?: number[] };

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
  /** Automation curves (at most 16). */
  lanes: AutoLane[];
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
