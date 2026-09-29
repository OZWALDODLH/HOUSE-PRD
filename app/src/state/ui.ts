// View state: which screen, what is selected, preferences. Not saved in projects.
import { create } from 'zustand';
import type { OutputRouting } from '../engine/bridge';

export type Screen = 'inicio' | 'estudio';
/** The views of the studio: pattern (channel rack), arrangement, piano roll and mixer. */
export type Tab = 'patron' | 'arreglo' | 'piano' | 'mezcla';
export const TAB_NAME: Record<Tab, string> = { patron: 'Patrón', arreglo: 'Arreglo', piano: 'Piano roll', mezcla: 'Mezcla' };
export const TAB_KEY: Record<Tab, string> = { patron: 'F1', arreglo: 'F2', mezcla: 'F3', piano: 'F4' };
/** What the browser on the left shows. */
export type NavTab = 'sonidos' | 'samples' | 'efectos';
export type KbMode = 'pads' | 'piano' | 'escala' | 'soundboard';
export const KB_MODE_NAME: Record<KbMode, string> = { pads: 'Pads', piano: 'Piano', escala: 'Escala', soundboard: 'Soundboard' };
export type Dialog = null | 'salidas' | 'exportar' | 'grabar' | 'proyectos' | 'atajos' | 'visuales' | 'plantillas' | 'acerca';
export type Tone = 'info' | 'bien' | 'error';

export interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

export interface Prefs {
  pro: boolean;
  kbMode: KbMode;
  lessMotion: boolean;
  outputs: OutputRouting;
  micId: string | null;
  /** The instrument and keyboard dock under the view. */
  dock: boolean;
  /** The browser on the left. */
  nav: boolean;
}

export interface UiState extends Prefs {
  screen: Screen;
  tab: Tab;
  selected: string | null;
  keyboardOn: boolean;
  octave: number;
  kbVel: number;
  recArmed: boolean;
  page: number;
  follow: boolean;
  selectedSection: string | null;
  navTab: NavTab;
  audio: 'off' | 'starting' | 'on' | 'error';
  audioError: string | null;
  toast: Toast | null;
  dialog: Dialog;
  savedAt: number;
  set: (patch: Partial<UiState>) => void;
}

const PREFS_KEY = 'house.v1.prefs';

const defaults: Prefs = {
  pro: false,
  kbMode: 'pads',
  lessMotion: false,
  outputs: { master: null, cue: null, alignMs: 0 },
  micId: null,
  dock: true,
  nav: true,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return defaults;
  }
}

export const useUi = create<UiState>((set) => ({
  ...loadPrefs(),
  screen: 'inicio',
  tab: 'patron',
  selected: null,
  keyboardOn: true,
  octave: 4,
  kbVel: 0.8,
  recArmed: false,
  page: 0,
  follow: true,
  selectedSection: null,
  navTab: 'sonidos',
  audio: 'off',
  audioError: null,
  toast: null,
  dialog: null,
  savedAt: 0,
  set: (patch) => set(patch),
}));

// Preferences persist on their own, whenever they change.
useUi.subscribe((s, prev) => {
  const same = s.pro === prev.pro && s.kbMode === prev.kbMode && s.lessMotion === prev.lessMotion && s.outputs === prev.outputs && s.micId === prev.micId && s.dock === prev.dock && s.nav === prev.nav;
  if (same) return;
  try {
    const p: Prefs = { pro: s.pro, kbMode: s.kbMode, lessMotion: s.lessMotion, outputs: s.outputs, micId: s.micId, dock: s.dock, nav: s.nav };
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private windows can refuse storage; preferences then last for the session.
  }
});

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, tone: Tone = 'info', ms = 3200): void {
  clearTimeout(toastTimer);
  useUi.getState().set({ toast: { id: ++toastId, text, tone } });
  toastTimer = setTimeout(() => useUi.getState().set({ toast: null }), ms);
}

export const openDialog = (dialog: Dialog): void => useUi.getState().set({ dialog });
export const closeDialog = (): void => useUi.getState().set({ dialog: null });
