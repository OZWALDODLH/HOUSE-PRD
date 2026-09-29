// Insert effects a track can use (two slots per track), with plain names.
import { FX } from '../engine/protocol';

export interface FxInfo {
  id: number;
  name: string;
  /** What it does, for someone who never used one. */
  desc: string;
  /** Names of its three knobs. */
  knobs: [string, string, string];
  /** Where the knobs start when the effect is added. */
  defaults: [number, number, number];
}

export const EFFECTS: FxInfo[] = [
  { id: FX.CHORUS, name: 'Coro', desc: 'Engrosa y abre el sonido, como varias voces a la vez.', knobs: ['Velocidad', 'Profundidad', 'Mezcla'], defaults: [0.3, 0.5, 0.5] },
  { id: FX.PHASER, name: 'Phaser', desc: 'Un barrido que gira y da vueltas, muy de house clásico.', knobs: ['Velocidad', 'Profundidad', 'Mezcla'], defaults: [0.3, 0.7, 0.5] },
  { id: FX.FLANGER, name: 'Flanger', desc: 'El efecto de avión: un zumbido metálico que sube y baja.', knobs: ['Velocidad', 'Retroalimentación', 'Mezcla'], defaults: [0.25, 0.6, 0.5] },
  { id: FX.AUTOPAN, name: 'Paneo automático', desc: 'Mueve el sonido de un lado al otro al ritmo de la canción.', knobs: ['Velocidad', 'Profundidad', 'Modo'], defaults: [0.5, 0.7, 0.2] },
  { id: FX.LOFI, name: 'Lo-fi', desc: 'Suena granulado y viejo, como una consola antigua.', knobs: ['Bits', 'Muestreo', 'Mezcla'], defaults: [0.55, 0.35, 0.8] },
  { id: FX.DISTORTION, name: 'Distorsión', desc: 'Más sucio y agresivo. Bueno para bajos y leads.', knobs: ['Cantidad', 'Tono', 'Mezcla'], defaults: [0.45, 0.6, 0.7] },
  { id: FX.COMPRESSOR, name: 'Compresor', desc: 'Empareja el volumen y le da pegada a lo que suena.', knobs: ['Cantidad', 'Rapidez', 'Ganancia'], defaults: [0.45, 0.5, 0.5] },
  { id: FX.SLAPBACK, name: 'Eco corto', desc: 'Un rebote rápido, como cantar en un cuarto chico.', knobs: ['Tiempo', 'Repeticiones', 'Mezcla'], defaults: [0.4, 0.25, 0.35] },
  { id: FX.WOBBLE, name: 'Wobble', desc: 'El filtro que hace “wub wub” al tempo, como en el dubstep.', knobs: ['Velocidad', 'Profundidad', 'Resonancia'], defaults: [0.5, 0.7, 0.5] },
  { id: FX.WIDTH, name: 'Ensanchar', desc: 'Abre el sonido hacia los lados para que se sienta grande.', knobs: ['Anchura', 'Brillo', 'Mezcla'], defaults: [0.6, 0.5, 0.8] },
  { id: FX.VINYL, name: 'Vinilo', desc: 'Crujidos y oscilación de disco viejo. Ideal para lo-fi.', knobs: ['Crujido', 'Oscilación', 'Mezcla'], defaults: [0.4, 0.4, 0.8] },
];

export const fxById = (id: number): FxInfo | undefined => EFFECTS.find((e) => e.id === id);

export interface FxSlot {
  kind: number;
  knobs: number[];
}

export const emptyFx = (): FxSlot[] => [
  { kind: FX.NONE, knobs: [0.5, 0.5, 0.5] },
  { kind: FX.NONE, knobs: [0.5, 0.5, 0.5] },
];

/** Knob text for an effect: speeds that follow the tempo read as note values. */
export function fxKnobText(kind: number, knob: number, v: number): string {
  const sync = ['4 tiempos', '2 tiempos', '1 tiempo', '1/4 tresillo', '1/8', '1/8 tresillo', '1/16'];
  if ((kind === FX.AUTOPAN || kind === FX.WOBBLE) && knob === 0) return sync[Math.round(v * 6)];
  if (kind === FX.AUTOPAN && knob === 2) return v < 0.5 ? 'Paneo' : 'Trémolo';
  if (kind === FX.SLAPBACK && knob === 0) return `${Math.round(35 + v * 130)} ms`;
  if (kind === FX.LOFI && knob === 0) return `${Math.round(3 + (1 - v) * 13)} bits`;
  return `${Math.round(v * 100)}%`;
}
