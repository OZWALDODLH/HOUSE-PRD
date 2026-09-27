// The computer keyboard as an instrument, plus the global shortcuts.
import { releaseAll, togglePlay } from '../engine/audio';
import { getProject, redo, undo } from '../state/store';
import { closeDialog, openDialog, toast, useUi } from '../state/ui';
import { saveNow } from '../state/persist';
import { BANK_A, BANK_B, PIANO, SCALE_DEGREE, SOUNDBOARD_CODES } from './keys';
import { hitNote, hitShot, hitTrack, releaseNote, releaseTrack, scaleNote } from './play';
import { releaseEverything } from './pressed';
import { openVisuals } from '../visuals/link';

type Held = { kind: 'track'; id: string } | { kind: 'note'; note: number };
const held = new Map<string, Held>();

const isTyping = (el: EventTarget | null): boolean => {
  const e = el as HTMLElement | null;
  if (!e) return false;
  const tag = e.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.isContentEditable;
};

const onBody = (): boolean => {
  const a = document.activeElement;
  return !a || a === document.body || a === document.documentElement;
};

/** Velocity: fixed, and Shift gives an accent. */
const velocity = (shift: boolean): number => (shift ? 1 : useUi.getState().kbVel);

function noteDown(code: string, shift: boolean): boolean {
  const ui = useUi.getState();
  if (ui.kbMode === 'soundboard') {
    if (!SOUNDBOARD_CODES.has(code)) return false;
    // Shots end on their own: releasing the key changes nothing.
    hitShot(code, velocity(shift));
    return true;
  }
  if (ui.kbMode === 'pads') {
    const a = BANK_A.indexOf(code);
    if (a >= 0) {
      const t = getProject().tracks[a];
      if (!t) return true;
      hitTrack(t.id, velocity(shift), `kb:${code}`);
      held.set(code, { kind: 'track', id: t.id });
      return true;
    }
    const b = BANK_B.indexOf(code);
    if (b >= 0) {
      // Bank B: 16 scale notes of the melodic track, lowest row at the bottom.
      const row = Math.floor(b / 4);
      const degree = (3 - row) * 4 + (b % 4);
      const note = scaleNote(degree);
      hitNote(note, velocity(shift), `kb:${code}`);
      held.set(code, { kind: 'note', note });
      return true;
    }
    return false;
  }
  if (ui.kbMode === 'piano') {
    if (code === 'KeyZ' || code === 'KeyX') {
      const octave = Math.min(7, Math.max(1, ui.octave + (code === 'KeyZ' ? -1 : 1)));
      ui.set({ octave });
      toast(`Octava ${octave}`, 'info', 1200);
      return true;
    }
    if (code === 'KeyC' || code === 'KeyV') {
      const kbVel = Math.min(1, Math.max(0.2, Math.round((ui.kbVel + (code === 'KeyC' ? -0.1 : 0.1)) * 10) / 10));
      ui.set({ kbVel });
      toast(`Fuerza ${Math.round(kbVel * 100)}`, 'info', 1200);
      return true;
    }
    const semi = PIANO[code];
    if (semi === undefined) return false;
    const note = ui.octave * 12 + semi + (bassTrack() ? -24 : 0);
    hitNote(note, velocity(shift), `kb:${code}`);
    held.set(code, { kind: 'note', note });
    return true;
  }
  const degree = SCALE_DEGREE[code];
  if (degree === undefined) return false;
  const note = scaleNote(degree - 7);
  hitNote(note, velocity(shift), `kb:${code}`);
  held.set(code, { kind: 'note', note });
  return true;
}

const bassTrack = (): boolean => {
  const p = getProject();
  const t = p.tracks.find((x) => x.id === useUi.getState().selected);
  return !!t && (t.kind === 'acid' || t.kind === 'bass808');
};

function noteUp(code: string): void {
  const h = held.get(code);
  if (!h) return;
  held.delete(code);
  if (h.kind === 'track') releaseTrack(h.id, `kb:${code}`);
  else releaseNote(h.note, `kb:${code}`);
}

export function installKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    const ui = useUi.getState();
    if (e.code === 'Escape' && ui.dialog) {
      closeDialog();
      return;
    }
    if (isTyping(e.target)) {
      if (e.code === 'Escape') (e.target as HTMLElement).blur();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        if (!undo()) toast('No hay nada que deshacer.', 'info', 1600);
      } else if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
        e.preventDefault();
        if (!redo()) toast('No hay nada que rehacer.', 'info', 1600);
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        const ok = saveNow();
        toast(ok ? 'Proyecto guardado.' : 'No pude guardar: tu navegador no deja usar el almacenamiento.', ok ? 'bien' : 'error');
      } else if (e.code === 'KeyE' && ui.screen === 'estudio') {
        e.preventDefault();
        openDialog('exportar');
      }
      return;
    }
    if (ui.dialog) {
      if (e.code === 'Escape') closeDialog();
      return;
    }
    if (ui.screen !== 'estudio') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) void togglePlay();
      return;
    }
    if (e.code === 'Escape') {
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    if (e.code === 'Tab') {
      // Tab turns the musical keyboard on and off; while a control has the
      // focus and the keyboard is off, Tab keeps moving the focus as usual.
      if (ui.keyboardOn || onBody()) {
        e.preventDefault();
        releaseKeys();
        ui.set({ keyboardOn: !ui.keyboardOn });
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      return;
    }
    if (e.code === 'F1' || e.code === 'F3') {
      e.preventDefault();
      ui.set({ tab: e.code === 'F1' ? 'patron' : 'mezcla' });
      return;
    }
    if (e.code === 'F6') {
      e.preventDefault();
      openVisuals();
      return;
    }
    if (e.altKey || !ui.keyboardOn) return;
    if (e.repeat) {
      if (held.has(e.code) || (ui.kbMode === 'soundboard' && SOUNDBOARD_CODES.has(e.code))) e.preventDefault();
      return;
    }
    if (noteDown(e.code, e.shiftKey)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => noteUp(e.code);
  const blur = () => releaseKeys();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

export function releaseKeys(): void {
  for (const code of [...held.keys()]) noteUp(code);
  releaseAll();
  releaseEverything();
}
