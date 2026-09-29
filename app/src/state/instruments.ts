// Catalog of sounds, macro names (cara fácil / cara pro) and presets.
import { KIND } from '../engine/protocol';
import { emptyStep, uid, type Family, type InstKind, type Pict, type Track } from './model';

export interface Macro {
  name: string;
  pro: string;
  /** Which of the 8 instrument knobs it moves (defaults to its position). */
  idx?: number;
}

export const MACROS: Record<InstKind, Macro[]> = {
  drum: [
    { name: 'Afinación', pro: 'tune' },
    { name: 'Cola', pro: 'decay' },
    { name: 'Brillo', pro: 'tone' },
    { name: 'Pegada', pro: 'drive' },
  ],
  acid: [
    { name: 'Brillo', pro: 'cutoff' },
    { name: 'Resonancia', pro: 'resonance' },
    { name: 'Ácido', pro: 'env mod' },
    { name: 'Pegada', pro: 'accent' },
    { name: 'Forma', pro: 'saw / square' },
    { name: 'Caída', pro: 'filter decay' },
  ],
  bass808: [
    { name: 'Grave', pro: 'decay' },
    { name: 'Golpe', pro: 'pitch punch' },
    { name: 'Glide', pro: 'glide time' },
    { name: 'Saturación', pro: 'drive' },
  ],
  poly: [
    { name: 'Brillo', pro: 'cutoff' },
    { name: 'Ataque', pro: 'attack' },
    { name: 'Cola', pro: 'release' },
    { name: 'Grosor', pro: 'detune' },
    { name: 'Forma', pro: 'saw / square / tri' },
    { name: 'Envolvente', pro: 'filter env' },
    { name: 'Resonancia', pro: 'resonance' },
    { name: 'Sostenido', pro: 'sustain' },
  ],
  sampler: [
    { name: 'Tono', pro: 'pitch' },
    { name: 'Inicio', pro: 'start' },
    { name: 'Cola', pro: 'release' },
    { name: 'Filtro', pro: 'cutoff' },
  ],
  fm: [
    { name: 'Brillo', pro: 'FM index' },
    { name: 'Ataque', pro: 'attack' },
    { name: 'Cola', pro: 'release' },
    { name: 'Relación', pro: 'ratio' },
    { name: 'Campana', pro: 'index decay' },
    { name: 'Vibrato', pro: 'vibrato' },
    { name: 'Sostenido', pro: 'sustain' },
    { name: 'Retroalimentación', pro: 'feedback' },
  ],
  super: [
    { name: 'Brillo', pro: 'cutoff' },
    { name: 'Ataque', pro: 'attack' },
    { name: 'Cola', pro: 'release' },
    { name: 'Grosor', pro: 'detune' },
    { name: 'Octava abajo', pro: 'sub osc' },
    { name: 'Envolvente', pro: 'filter env' },
    { name: 'Resonancia', pro: 'resonance' },
    { name: 'Sostenido', pro: 'sustain' },
  ],
  pluck: [
    { name: 'Brillo', pro: 'damping' },
    { name: 'Púa', pro: 'pick' },
    { name: 'Cola', pro: 'decay' },
    { name: 'Cuerpo', pro: 'body' },
    { name: 'Forma', pro: 'excitation' },
    { name: 'Afinación', pro: 'fine tune' },
    { name: 'Sostenido', pro: 'release', idx: 7 },
  ],
};

/** How many macros the "cara fácil" shows. */
export const EASY_COUNT: Record<InstKind, number> = { drum: 4, acid: 4, bass808: 4, poly: 4, sampler: 4, fm: 4, super: 4, pluck: 4 };

export const KIND_CODE: Record<InstKind, number> = {
  drum: KIND.DRUM,
  acid: KIND.ACID,
  bass808: KIND.BASS808,
  poly: KIND.POLY,
  sampler: KIND.SAMPLER,
  fm: KIND.FM,
  super: KIND.SUPER,
  pluck: KIND.PLUCK,
};

export const INSTRUMENT_NAME: Record<InstKind, string> = {
  drum: 'Máquina',
  acid: 'Ácido',
  bass808: '808',
  poly: 'Analógico',
  sampler: 'Sampler',
  fm: 'Teclas FM',
  super: 'Supersaw',
  pluck: 'Cuerdas',
};

export const DM = { kick: 0, snare: 1, clap: 2, hatc: 3, hato: 4, rim: 5, conga: 6, shaker: 7, cowbell: 8, cymbal: 9, timbal: 10, riser: 11, impact: 12 };

export interface Preset {
  name: string;
  params: number[];
}

const pad8 = (p: number[]): number[] => [...p, ...Array(8).fill(0.5)].slice(0, 8);

export const PRESETS: Record<Exclude<InstKind, 'drum'>, Preset[]> = {
  acid: [
    { name: 'Rodante de madrugada', params: pad8([0.36, 0.72, 0.62, 0.38, 0, 0.45]) },
    { name: 'Ácido clásico', params: pad8([0.24, 0.86, 0.82, 0.62, 0, 0.32]) },
    { name: 'Cuadrado oscuro', params: pad8([0.3, 0.62, 0.5, 0.3, 1, 0.5]) },
    { name: 'Suave', params: pad8([0.46, 0.35, 0.28, 0.2, 0, 0.62]) },
  ],
  bass808: [
    { name: 'Perreo', params: pad8([0.55, 0.42, 0.35, 0.35]) },
    { name: 'Largo', params: pad8([0.82, 0.28, 0.45, 0.15]) },
    { name: 'Sucio', params: pad8([0.5, 0.6, 0.3, 0.85]) },
    { name: 'Corto', params: pad8([0.22, 0.5, 0.2, 0.4]) },
  ],
  poly: [
    { name: 'Stab de órgano', params: [0.62, 0.0, 0.22, 0.12, 0.5, 0.28, 0.15, 0.0] },
    { name: 'Pad de madrugada', params: [0.42, 0.62, 0.82, 0.55, 0.05, 0.18, 0.1, 0.85] },
    { name: 'Pluck', params: [0.38, 0.0, 0.32, 0.22, 0.0, 0.72, 0.35, 0.0] },
    { name: 'Piano eléctrico', params: [0.55, 0.0, 0.55, 0.08, 0.96, 0.22, 0.05, 0.25] },
    { name: 'Lead', params: [0.62, 0.02, 0.38, 0.4, 0.0, 0.42, 0.5, 0.65] },
    { name: 'Acordes lo-fi', params: [0.34, 0.06, 0.62, 0.2, 0.9, 0.12, 0.0, 0.45] },
  ],
  // Only the first four knobs: the cut, smoothing and reverse belong to the audio.
  sampler: [
    { name: 'Natural', params: [0.5, 0.0, 0.6, 1.0, 0, 1, 0, 0] },
    { name: 'Grave', params: [0.3, 0.0, 0.6, 0.7, 0, 1, 0, 0] },
    { name: 'Agudo y corto', params: [0.7, 0.0, 0.25, 1.0, 0, 1, 0, 0] },
    { name: 'Chipmunk', params: [0.85, 0.0, 0.3, 1.0, 0, 1, 0, 0] },
  ],
  // p3 Relación picks 0.5, 1, 2, 3, 3.5, 4, 5 or 7 (0, 1/7, 2/7 ... 1).
  fm: [
    { name: 'Piano FM', params: [0.28, 0.0, 0.55, 0.143, 0.5, 0.0, 0.2, 0.05] },
    { name: 'Piano eléctrico', params: [0.32, 0.0, 0.62, 0.143, 0.42, 0.25, 0.3, 0.1] },
    { name: 'Campanas', params: [0.5, 0.0, 0.75, 0.571, 0.7, 0.0, 0.0, 0.0] },
    { name: 'Marimba', params: [0.3, 0.0, 0.35, 0.714, 0.2, 0.0, 0.0, 0.0] },
    { name: 'Kalimba', params: [0.3, 0.0, 0.45, 0.429, 0.18, 0.0, 0.0, 0.0] },
    { name: 'Bajo FM', params: [0.35, 0.0, 0.35, 0.143, 0.25, 0.0, 0.6, 0.2] },
    { name: 'Órgano', params: [0.18, 0.02, 0.3, 0.286, 1.0, 0.3, 1.0, 0.1] },
    { name: 'Cristal', params: [0.35, 0.55, 0.8, 1.0, 0.8, 0.2, 0.8, 0.0] },
  ],
  super: [
    { name: 'Supersaw trance', params: [0.72, 0.0, 0.4, 0.55, 0.0, 0.25, 0.1, 0.85] },
    { name: 'Lead de festival', params: [0.8, 0.0, 0.3, 0.7, 0.3, 0.15, 0.1, 0.9] },
    { name: 'Pad gigante', params: [0.5, 0.6, 0.8, 0.5, 0.2, 0.1, 0.05, 0.9] },
    { name: 'Acordes trance', params: [0.45, 0.0, 0.3, 0.45, 0.0, 0.75, 0.2, 0.0] },
    { name: 'Bajo Reese', params: [0.3, 0.0, 0.25, 0.3, 0.6, 0.1, 0.25, 1.0] },
    { name: 'Hoover', params: [0.65, 0.02, 0.35, 0.95, 0.5, 0.3, 0.2, 0.9] },
  ],
  pluck: [
    { name: 'Guitarra de nylon', params: [0.45, 0.4, 0.55, 0.55, 0.0, 0.5, 0.5, 0.25] },
    { name: 'Guitarra acústica', params: [0.7, 0.7, 0.6, 0.45, 0.2, 0.5, 0.5, 0.3] },
    { name: 'Arpa', params: [0.6, 0.35, 0.72, 0.2, 0.0, 0.5, 0.5, 0.6] },
    { name: 'Koto', params: [0.8, 0.85, 0.45, 0.15, 0.4, 0.5, 0.5, 0.2] },
    { name: 'Bajo pulsado', params: [0.3, 0.3, 0.45, 0.35, 0.3, 0.5, 0.5, 0.15] },
    { name: 'Requinto', params: [0.85, 0.9, 0.5, 0.3, 0.25, 0.5, 0.5, 0.2] },
  ],
};

export interface Sound {
  id: string;
  name: string;
  desc: string;
  family: Family;
  pict: Pict;
  kind: InstKind;
  model: number;
  params: number[];
  preset: string;
}

const drum = (id: string, name: string, desc: string, pict: Pict, model: number, params: number[], family: Family = 'bateria'): Sound => ({
  id,
  name,
  desc,
  family,
  pict,
  kind: 'drum',
  model,
  params: pad8(params),
  preset: name,
});

const synth = (id: string, name: string, desc: string, family: Family, pict: Pict, kind: Exclude<InstKind, 'drum'>, preset: string): Sound => {
  const p = PRESETS[kind].find((x) => x.name === preset) ?? PRESETS[kind][0];
  return { id, name, desc, family, pict, kind, model: 0, params: [...p.params], preset: p.name };
};

export const SOUNDS: Sound[] = [
  drum('bombo-cuerpo', 'Bombo con cuerpo', 'Kit Madrugada', 'bombo', DM.kick, [0.45, 0.45, 0.5, 0.35]),
  drum('bombo-seco', 'Bombo seco', 'Corto y firme', 'bombo', DM.kick, [0.5, 0.22, 0.6, 0.2]),
  drum('bombo-rumble', 'Bombo rumble', 'Para techno', 'bombo', DM.kick, [0.34, 0.62, 0.35, 0.65]),
  drum('bombo-suave', 'Bombo suave', 'Para lo-fi', 'bombo', DM.kick, [0.38, 0.32, 0.25, 0.08]),
  drum('caja-dembow', 'Caja dembow', 'Seca y alta', 'caja', DM.snare, [0.62, 0.28, 0.6, 0.35]),
  drum('caja-suave', 'Caja suave', 'Con cuerpo', 'caja', DM.snare, [0.45, 0.45, 0.3, 0.1]),
  drum('palmas-secas', 'Palmas secas', 'Kit Madrugada', 'palmas', DM.clap, [0.5, 0.35, 0.55, 0.3]),
  drum('palmas-grandes', 'Palmas grandes', 'Con cola', 'palmas', DM.clap, [0.4, 0.72, 0.5, 0.45]),
  drum('hat-cobre', 'Hat cerrado de cobre', 'Kit Madrugada', 'hat', DM.hatc, [0.55, 0.35, 0.62, 0.2]),
  drum('hat-abierto', 'Hat abierto', 'Kit Madrugada', 'hatab', DM.hato, [0.52, 0.42, 0.55, 0.2]),
  drum('rim', 'Rim', 'Clic de madera', 'rim', DM.rim, [0.5, 0.4, 0.5, 0.3]),
  drum('conga-alta', 'Conga alta', 'Percusión latina', 'conga', DM.conga, [0.62, 0.4, 0.5, 0.2]),
  drum('conga-baja', 'Conga baja', 'Percusión latina', 'conga', DM.conga, [0.36, 0.5, 0.5, 0.2]),
  drum('shaker', 'Shaker de semillas', 'Percusión latina', 'shaker', DM.shaker, [0.3, 0.45, 0.6, 0.0]),
  drum('cencerro', 'Cencerro', 'Para phonk y latin', 'cencerro', DM.cowbell, [0.5, 0.45, 0.5, 0.3]),
  drum('timbal', 'Timbal', 'Redobles de reggaetón', 'timbal', DM.timbal, [0.5, 0.42, 0.5, 0.3]),
  drum('platillo', 'Platillo', 'Crash', 'platillo', DM.cymbal, [0.5, 0.5, 0.62, 0.2]),
  synth('acido-rodante', 'Bajo ácido rodante', 'Ácido', 'bajo', 'bajo', 'acid', 'Rodante de madrugada'),
  synth('acido-clasico', 'Ácido clásico', 'Ácido', 'bajo', 'bajo', 'acid', 'Ácido clásico'),
  synth('bajo-suave', 'Bajo suave', 'Ácido', 'bajo', 'bajo', 'acid', 'Suave'),
  synth('808-perreo', '808 perreo', '808', 'bajo', 'bajo', 'bass808', 'Perreo'),
  synth('808-largo', '808 largo', '808', 'bajo', 'bajo', 'bass808', 'Largo'),
  synth('808-sucio', '808 sucio', '808', 'bajo', 'bajo', 'bass808', 'Sucio'),
  synth('stab-organo', 'Stab de órgano', 'Analógico', 'sintes', 'acordes', 'poly', 'Stab de órgano'),
  synth('pad-madrugada', 'Pad de madrugada', 'Analógico', 'sintes', 'sinte', 'poly', 'Pad de madrugada'),
  synth('pluck', 'Pluck', 'Analógico', 'sintes', 'sinte', 'poly', 'Pluck'),
  synth('piano-electrico', 'Piano eléctrico', 'Analógico', 'sintes', 'acordes', 'poly', 'Piano eléctrico'),
  synth('lead', 'Lead', 'Analógico', 'sintes', 'sinte', 'poly', 'Lead'),
  synth('acordes-lofi', 'Acordes lo-fi', 'Analógico', 'sintes', 'acordes', 'poly', 'Acordes lo-fi'),
  drum('subida', 'Subida de 8 compases', 'Efectos de transición', 'subida', DM.riser, [0.5, 0.75, 0.6, 0.3], 'efectos'),
  drum('impacto', 'Impacto', 'Efectos de transición', 'impacto', DM.impact, [0.5, 0.5, 0.5, 0.4], 'efectos'),
];

export const soundById = (id: string): Sound | undefined => SOUNDS.find((s) => s.id === id);

export const FAMILY_NAME: Record<Family, string> = {
  bateria: 'Batería',
  bajo: 'Bajos',
  sintes: 'Sintes',
  voz: 'Voces',
  samples: 'Samples',
  efectos: 'Efectos',
};

/** A new, empty track from a catalog sound. */
export function trackFromSound(s: Sound, name?: string, length = 16): Track {
  return {
    id: uid('pista'),
    name: name ?? s.name,
    desc: s.name === name ? s.desc : s.name,
    family: s.family,
    pict: s.pict,
    kind: s.kind,
    model: s.model,
    preset: s.preset,
    params: [...s.params],
    steps: Array.from({ length: 64 }, emptyStep),
    length,
    vol: s.family === 'bateria' ? -6 : -8,
    pan: 0,
    mute: false,
    solo: false,
    sendRev: 0,
    sendDel: 0,
    duck: s.family === 'bajo' ? 0.6 : 0,
    once: s.kind === 'drum' && (s.model === DM.riser || s.model === DM.impact),
    filter: 0.5,
    eq: [0, 0, 0],
    drive: 0,
  };
}

/** A sampler track for audio the person recorded or imported. */
export function samplerTrack(name: string, slot: number, family: Family = 'voz'): Track {
  const p = PRESETS.sampler[0];
  return {
    id: uid('pista'),
    name,
    desc: family === 'voz' ? 'Tu voz' : 'Tu sample',
    family,
    pict: family === 'voz' ? 'voz' : 'sample',
    kind: 'sampler',
    model: 0,
    preset: p.name,
    params: [...p.params],
    steps: Array.from({ length: 64 }, emptyStep),
    length: 16,
    vol: -4,
    pan: 0,
    mute: false,
    solo: false,
    sendRev: 0.15,
    sendDel: 0.1,
    duck: 0,
    once: false,
    filter: 0.5,
    eq: [0, 0, 0],
    drive: 0,
    sampleSlot: slot,
  };
}

/** Note used when a pad or preview plays a melodic track without a pattern note. */
export function defaultNote(t: Track, root: number): number {
  const first = t.steps.find((s) => s.on && s.notes.length)?.notes[0];
  if (first !== undefined) return first;
  if (t.kind === 'acid' || t.kind === 'bass808') return 36 + root;
  if (t.kind === 'sampler') return 60;
  return 57 + root - 9 + (root < 3 ? 12 : 0);
}
