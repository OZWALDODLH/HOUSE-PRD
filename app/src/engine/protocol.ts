// Mirror of crates/house-engine/src/command.rs and engine.rs.
// Every command is a flat array of numbers: [opcode, ...args].

export const OP = {
  PLAY: 1,
  STOP: 2,
  SET_BPM: 3,
  SET_SWING: 4,
  SET_STEP: 5,
  SET_TRACK_KIND: 6,
  SET_PARAM: 7,
  SET_MIX: 8,
  NOTE_ON: 9,
  NOTE_OFF: 10,
  SET_LENGTH: 11,
  SET_MODE: 12,
  SET_SECTION_COUNT: 13,
  SET_SECTION: 14,
  SET_MASTER: 15,
  SET_SIDECHAIN: 16,
  SEEK: 17,
  ALL_NOTES_OFF: 18,
  PREVIEW: 19,
  SET_SAMPLE_SLOT: 20,
  CLEAR_STEPS: 21,
  SHOT: 22,
} as const;

export const KIND = { NONE: 0, DRUM: 1, ACID: 2, BASS808: 3, POLY: 4, SAMPLER: 5 } as const;

export const MIX = {
  VOLUME_DB: 0,
  PAN: 1,
  MUTE: 2,
  SOLO: 3,
  SEND_REVERB: 4,
  SEND_DELAY: 5,
  DUCK: 6,
  ACTIVE: 7,
  ONCE_PER_SECTION: 8,
  FILTER: 9,
  EQ_LOW: 10,
  EQ_MID: 11,
  EQ_HIGH: 12,
  DRIVE: 13,
} as const;

export const MASTER = {
  VOLUME_DB: 0,
  GLUE: 1,
  CEILING_DB: 2,
  REVERB_SIZE: 3,
  DELAY_STEPS: 4,
  DELAY_FEEDBACK: 5,
  METRONOME: 6,
  AUTO_BUILD: 7,
  REVERB_DAMP: 8,
  CUE_TO_MASTER: 9,
} as const;

export const SECTION_KIND = {
  none: 0,
  intro: 1,
  subida: 2,
  drop: 3,
  pausa: 4,
  salida: 5,
  verso: 6,
  coro: 7,
  puente: 8,
  precoro: 9,
} as const;

export type SectionKind = keyof typeof SECTION_KIND;

export const SECTION_KIND_BY_CODE: SectionKind[] = ['none', 'intro', 'subida', 'drop', 'pausa', 'salida', 'verso', 'coro', 'puente', 'precoro'];

// Positions inside the status array (engine.rs `st`).
export const ST = {
  PLAYING: 0,
  STEP: 1,
  BAR: 2,
  STEP_IN_BAR: 3,
  SECTION: 4,
  SECTION_PROGRESS: 5,
  BEAT_PHASE: 6,
  TRIGGERS: 7,
  PEAK_L: 8,
  PEAK_R: 9,
  RMS: 10,
  KICK: 11,
  SNARE: 12,
  HAT: 13,
  LIMITER_GR: 14,
  BARS_TO_NEXT: 15,
  TRACK_PEAKS: 16,
  BANDS: 32,
  NEXT_KIND: 48,
  CUR_KIND: 49,
  STEP_FRACTION: 50,
  BPM: 51,
  SONG_BARS: 52,
  MODE: 53,
  BAR_IN_SECTION: 54,
} as const;

export const STATUS_LEN = 64;
export const MAX_TRACKS = 16;
export const MAX_STEPS = 64;
export const BANDS = 16;

export type Cmd = number[];

export const cmd = {
  play: (): Cmd => [OP.PLAY],
  stop: (): Cmd => [OP.STOP],
  bpm: (v: number): Cmd => [OP.SET_BPM, v],
  swing: (v: number): Cmd => [OP.SET_SWING, v],
  step: (track: number, step: number, on: boolean, vel: number, len: number, accent: boolean, slide: boolean, notes: number[]): Cmd => [
    OP.SET_STEP,
    track,
    step,
    on ? 1 : 0,
    vel,
    Math.max(1, len),
    accent ? 1 : 0,
    slide ? 1 : 0,
    notes[0] ?? -1,
    notes[1] ?? -1,
    notes[2] ?? -1,
    notes[3] ?? -1,
  ],
  kind: (track: number, kind: number, model: number): Cmd => [OP.SET_TRACK_KIND, track, kind, model],
  param: (track: number, idx: number, value: number): Cmd => [OP.SET_PARAM, track, idx, value],
  mix: (track: number, param: number, value: number): Cmd => [OP.SET_MIX, track, param, value],
  noteOn: (track: number, note: number, vel: number): Cmd => [OP.NOTE_ON, track, note, vel],
  noteOff: (track: number, note: number): Cmd => [OP.NOTE_OFF, track, note],
  length: (track: number, steps: number): Cmd => [OP.SET_LENGTH, track, steps],
  mode: (m: 0 | 1): Cmd => [OP.SET_MODE, m],
  sectionCount: (n: number): Cmd => [OP.SET_SECTION_COUNT, n],
  section: (i: number, bars: number, mask: number, kind: number): Cmd => [OP.SET_SECTION, i, bars, mask, kind],
  master: (param: number, value: number): Cmd => [OP.SET_MASTER, param, value],
  sidechain: (track: number): Cmd => [OP.SET_SIDECHAIN, track],
  seek: (bar: number): Cmd => [OP.SEEK, bar],
  allNotesOff: (): Cmd => [OP.ALL_NOTES_OFF],
  preview: (kind: number, model: number, note: number, vel: number, params: number[]): Cmd => [OP.PREVIEW, kind, model, note, vel, ...params.slice(0, 8)],
  sampleSlot: (track: number, slot: number): Cmd => [OP.SET_SAMPLE_SLOT, track, slot],
  clearSteps: (track: number): Cmd => [OP.CLEAR_STEPS, track],
  /** Soundboard one-shot on the master bus. */
  shot: (kind: number, model: number, note: number, vel: number, slot: number, params: number[]): Cmd => [OP.SHOT, kind, model, note, vel, slot, ...params.slice(0, 8)],
};
