// Automation curves as the person sees them: what each lane moves, its name,
// how its values read, and the ready-made transitions between sections.
import { AUTO_MASTER, AUTO_TRACK, MAX_LANES } from '../engine/protocol';
import { edit, getProject, sectionStart, trackById } from './store';
import { MACROS } from './instruments';
import { fxById, fxKnobText } from './effects';
import { uid, type AutoLane, type AutoPoint, type Project, type Track } from './model';

export interface LaneTarget {
  target: 'master' | 'track';
  trackId?: string;
  param: number;
  name: string;
}

const MASTER_NAMES: Record<number, string> = {
  [AUTO_MASTER.FILTER]: 'Filtro',
  [AUTO_MASTER.VOLUME]: 'Volumen',
  [AUTO_MASTER.REVERB]: 'Espacio',
  [AUTO_MASTER.DELAY]: 'Eco',
};

function trackParamName(t: Track, param: number): string {
  if (param === AUTO_TRACK.VOLUME) return 'Volumen';
  if (param === AUTO_TRACK.FILTER) return 'Filtro';
  if (param === AUTO_TRACK.PAN) return 'Paneo';
  if (param === AUTO_TRACK.SEND_REVERB) return 'Envío a espacio';
  if (param === AUTO_TRACK.SEND_DELAY) return 'Envío a eco';
  if (param >= AUTO_TRACK.INST && param < AUTO_TRACK.INST + 8) {
    const k = param - AUTO_TRACK.INST;
    return MACROS[t.kind].find((m, i) => (m.idx ?? i) === k)?.name ?? `Perilla ${k + 1}`;
  }
  if (param >= AUTO_TRACK.FX && param < AUTO_TRACK.FX + 6) {
    const k = param - AUTO_TRACK.FX;
    const slot = t.fx[Math.floor(k / 3)];
    const info = fxById(slot?.kind ?? 0);
    return info ? `${info.name}: ${info.knobs[k % 3]}` : 'Efecto';
  }
  return 'Perilla';
}

export function laneName(p: Project, l: AutoLane): string {
  if (l.target === 'master') return `${MASTER_NAMES[l.param] ?? 'Master'} de la canción`;
  const t = trackById(p, l.trackId ?? null);
  return t ? `${trackParamName(t, l.param)} de ${t.name}` : 'Pista borrada';
}

/** The value a lane starts from: where the knob is now. */
export function laneRest(p: Project, target: Pick<AutoLane, 'target' | 'trackId' | 'param'>): number {
  if (target.target === 'master') return target.param === AUTO_MASTER.VOLUME ? 1 : 0.5;
  const t = trackById(p, target.trackId ?? null);
  if (!t) return 0.5;
  const k = target.param;
  if (k === AUTO_TRACK.VOLUME) return 1;
  if (k === AUTO_TRACK.FILTER) return t.filter;
  if (k === AUTO_TRACK.PAN) return (t.pan + 1) / 2;
  if (k === AUTO_TRACK.SEND_REVERB) return t.sendRev;
  if (k === AUTO_TRACK.SEND_DELAY) return t.sendDel;
  if (k >= AUTO_TRACK.INST && k < AUTO_TRACK.INST + 8) return t.params[k - AUTO_TRACK.INST] ?? 0.5;
  if (k >= AUTO_TRACK.FX && k < AUTO_TRACK.FX + 6) return t.fx[Math.floor((k - AUTO_TRACK.FX) / 3)]?.knobs[(k - AUTO_TRACK.FX) % 3] ?? 0.5;
  return 0.5;
}

/** How a lane value reads ("Abierto", "80%", "Izq 30"…). */
export function laneValueText(p: Project, l: AutoLane, v: number): string {
  const pct = `${Math.round(v * 100)}%`;
  const filter = (x: number) => (Math.abs(x - 0.5) < 0.015 ? 'Abierto' : x < 0.5 ? `Opaco ${Math.round((0.5 - x) * 200)}%` : `Delgado ${Math.round((x - 0.5) * 200)}%`);
  if (l.target === 'master') {
    if (l.param === AUTO_MASTER.FILTER) return filter(v);
    if (l.param === AUTO_MASTER.VOLUME) return v <= 0.005 ? 'Silencio' : `${Math.round(40 * Math.log10(v))} dB`;
    return `${Math.round(v * 200)}%`;
  }
  if (l.param === AUTO_TRACK.FILTER) return filter(v);
  if (l.param === AUTO_TRACK.VOLUME) return v <= 0.005 ? 'Silencio' : `${Math.round(40 * Math.log10(v))} dB`;
  if (l.param === AUTO_TRACK.PAN) {
    const pan = v * 2 - 1;
    return Math.abs(pan) < 0.02 ? 'Centro' : pan < 0 ? `Izq ${Math.round(-pan * 100)}` : `Der ${Math.round(pan * 100)}`;
  }
  if (l.param >= AUTO_TRACK.FX && l.param < AUTO_TRACK.FX + 6) {
    const t = trackById(p, l.trackId ?? null);
    const k = l.param - AUTO_TRACK.FX;
    return fxKnobText(t?.fx[Math.floor(k / 3)]?.kind ?? 0, k % 3, v);
  }
  return pct;
}

/** What a curve can move: the master, and the knobs of one track. */
export function laneTargets(p: Project, trackId: string | null): { group: string; items: LaneTarget[] }[] {
  const master: LaneTarget[] = [AUTO_MASTER.FILTER, AUTO_MASTER.VOLUME, AUTO_MASTER.REVERB, AUTO_MASTER.DELAY].map((param) => ({ target: 'master', param, name: `${MASTER_NAMES[param]} de la canción` }));
  const out = [{ group: 'Toda la canción', items: master }];
  const t = trackById(p, trackId);
  if (t) {
    const params: number[] = [AUTO_TRACK.VOLUME, AUTO_TRACK.FILTER, AUTO_TRACK.PAN, AUTO_TRACK.SEND_REVERB, AUTO_TRACK.SEND_DELAY];
    MACROS[t.kind].forEach((m, i) => params.push(AUTO_TRACK.INST + (m.idx ?? i)));
    t.fx.forEach((f, slot) => {
      if (f.kind) for (let k = 0; k < 3; k++) params.push(AUTO_TRACK.FX + slot * 3 + k);
    });
    out.push({ group: t.name, items: params.map((param) => ({ target: 'track', trackId: t.id, param, name: trackParamName(t, param) })) });
  }
  return out;
}

const songSteps = (p: Project) => p.sections.reduce((a, s) => a + s.bars, 0) * 16;

/** Adds a curve, flat at the knob's current value. Returns its id, or null when all 16 are used. */
export function addLane(target: LaneTarget): string | null {
  const p = getProject();
  const found = p.lanes.find((l) => l.target === target.target && l.trackId === target.trackId && l.param === target.param);
  if (found) return found.id;
  if (p.lanes.length >= MAX_LANES) return null;
  const rest = laneRest(p, target);
  const end = Math.max(16, songSteps(p));
  const lane: AutoLane = {
    id: uid('curva'),
    target: target.target,
    trackId: target.trackId,
    param: target.param,
    points: [
      { pos: 0, value: rest, tension: 0 },
      { pos: end, value: rest, tension: 0 },
    ],
  };
  edit(null, (p) => ({ ...p, lanes: [...p.lanes, lane] }));
  return lane.id;
}

export const removeLane = (id: string): void => edit(null, (p) => ({ ...p, lanes: p.lanes.filter((l) => l.id !== id) }));

export function setLanePoints(id: string, points: AutoPoint[], key: string | null = `curva:${id}`): void {
  const sorted = [...points].sort((a, b) => a.pos - b.pos).slice(0, 64);
  edit(key, (p) => ({ ...p, lanes: p.lanes.map((l) => (l.id === id ? { ...l, points: sorted } : l)) }));
}

// ------------------------------------------------------------ transitions --

export type TransitionId = 'abre' | 'cierra' | 'barrido' | 'entra' | 'sale' | 'silencio' | 'eco' | 'espacio';

export const TRANSITIONS: { id: TransitionId; name: string; desc: string }[] = [
  { id: 'abre', name: 'Filtro que se abre', desc: 'Empieza opaco y se va abriendo. Clásico de la subida.' },
  { id: 'barrido', name: 'Barrido agudo', desc: 'Se adelgaza poco a poco y regresa de golpe cuando entra la siguiente parte.' },
  { id: 'cierra', name: 'Filtro que se cierra', desc: 'Se va apagando hacia lo grave. Para salidas y pausas.' },
  { id: 'entra', name: 'Entrada suave', desc: 'El volumen sube desde el silencio.' },
  { id: 'sale', name: 'Salida suave', desc: 'El volumen baja hasta el silencio al final.' },
  { id: 'silencio', name: 'Silencio antes del drop', desc: 'Todo se calla en el último tiempo y regresa con fuerza.' },
  { id: 'eco', name: 'Eco al final', desc: 'El eco crece en el último compás (en las pistas que tienen eco).' },
  { id: 'espacio', name: 'Espacio que crece', desc: 'La reverberación se hace enorme hacia el final.' },
];

/** Writes a ready-made curve over a section, keeping the rest of the song as it was. */
export function applyTransition(sectionId: string, id: TransitionId): void {
  const p = getProject();
  const sec = p.sections.find((s) => s.id === sectionId);
  if (!sec) return;
  const s0 = sectionStart(p, sectionId) * 16;
  const s1 = s0 + sec.bars * 16;
  const lastBar = Math.max(s0, s1 - 16);
  const E = 0.05;
  const param = { abre: AUTO_MASTER.FILTER, barrido: AUTO_MASTER.FILTER, cierra: AUTO_MASTER.FILTER, entra: AUTO_MASTER.VOLUME, sale: AUTO_MASTER.VOLUME, silencio: AUTO_MASTER.VOLUME, eco: AUTO_MASTER.DELAY, espacio: AUTO_MASTER.REVERB }[id];
  const rest = param === AUTO_MASTER.VOLUME ? 1 : 0.5;
  const pts: AutoPoint[] = {
    abre: [
      { pos: s0, value: 0.12, tension: 0.5 },
      { pos: s1 - E, value: 0.5, tension: 0 },
    ],
    barrido: [
      { pos: s0, value: 0.5, tension: 0.6 },
      { pos: s1 - E, value: 0.84, tension: 0 },
      { pos: s1, value: 0.5, tension: 0 },
    ],
    cierra: [
      { pos: s0, value: 0.5, tension: -0.4 },
      { pos: s1 - E, value: 0.1, tension: 0 },
      { pos: s1, value: 0.5, tension: 0 },
    ],
    entra: [
      { pos: s0, value: 0, tension: -0.3 },
      { pos: Math.min(s1, s0 + 128), value: 1, tension: 0 },
    ],
    sale: [
      { pos: Math.max(s0, s1 - 128), value: 1, tension: 0.3 },
      { pos: s1 - E, value: 0, tension: 0 },
    ],
    silencio: [
      { pos: s1 - 4 - E, value: 1, tension: 0 },
      { pos: s1 - 4, value: 0, tension: 0 },
      { pos: s1 - E, value: 0, tension: 0 },
      { pos: s1, value: 1, tension: 0 },
    ],
    eco: [
      { pos: lastBar, value: 0.5, tension: 0.4 },
      { pos: s1 - E, value: 1, tension: 0 },
      { pos: s1, value: 0.5, tension: 0 },
    ],
    espacio: [
      { pos: s0, value: 0.5, tension: 0.5 },
      { pos: s1 - E, value: 1, tension: 0 },
      { pos: s1, value: 0.5, tension: 0 },
    ],
  }[id];
  const target: LaneTarget = { target: 'master', param, name: '' };
  const laneId = addLane(target);
  if (!laneId) return;
  const lane = getProject().lanes.find((l) => l.id === laneId)!;
  const first = pts[0].pos;
  const last = pts[pts.length - 1].pos;
  // Keep what the curve does outside the section; make sure the music before
  // and after it sounds as it did.
  const kept = lane.points.filter((pt) => pt.pos < first - E || pt.pos > last + E);
  if (!kept.some((pt) => pt.pos < first)) kept.push({ pos: Math.max(0, first - E), value: rest, tension: 0 });
  if (!kept.some((pt) => pt.pos > last) && id !== 'sale' && id !== 'abre') kept.push({ pos: last + E, value: rest, tension: 0 });
  setLanePoints(laneId, [...kept, ...pts], null);
}
