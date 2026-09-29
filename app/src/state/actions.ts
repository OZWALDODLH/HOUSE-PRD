// What the menus, the shortcuts, the start page and the tutorial can do.
// One place, so "Proyecto en blanco" does the same wherever it is asked for.
import { endAudition, startAudio } from '../engine/audio';
import { blankProject, newProjectFromGenre } from './templates';
import { openProject } from './store';
import { loadSamplesFor } from './samples';
import { openProjectFile, projectFile, safeFileName, saveNow, saveProject } from './persist';
import { saveFile, viewerDownloads } from './files';
import { toast, useUi, type Tab } from './ui';
import { isMelodic, type GenreId, type Project } from './model';

/** Opens a project in the studio and saves it, so it shows up in "Tus proyectos". */
export function enterStudio(p: Project, tab: Tab = 'patron'): void {
  endAudition();
  openProject(p);
  void loadSamplesFor(p);
  saveProject(p);
  const first = p.tracks.find((t) => isMelodic(t)) ?? p.tracks[0];
  useUi.getState().set({
    screen: 'estudio',
    tab,
    selected: first?.id ?? null,
    selectedSection: null,
    page: 0,
    follow: true,
    keyboardOn: true,
    dialog: null,
    savedAt: Date.now(),
  });
  void startAudio();
}

/** A project with nothing in it: no tracks, one part of 16 bars, 120 BPM. */
export function newBlankProject(): void {
  saveNow();
  enterStudio(blankProject());
  toast('Proyecto en blanco. Arrastra sonidos del navegador o graba tu voz para empezar.', 'info', 5000);
}

export function newFromTemplate(g: GenreId): void {
  saveNow();
  enterStudio(newProjectFromGenre(g));
}

export function goHome(): void {
  saveNow();
  endAudition();
  useUi.getState().set({ screen: 'inicio', dialog: null });
}

export const setView = (tab: Tab): void => useUi.getState().set({ tab });

export const toggleDock = (): void => useUi.getState().set({ dock: !useUi.getState().dock });
export const toggleNav = (): void => useUi.getState().set({ nav: !useUi.getState().nav });

/** Saves the project as a .house file (desktop: a save dialog; browser: a download). */
export async function saveProjectFile(p: Project): Promise<void> {
  const inViewer = !!(await viewerDownloads());
  const res = await saveFile(projectFile(p), `${safeFileName(p.name)}${inViewer ? '.house.json' : '.house'}`);
  if (res === 'saved') toast('Proyecto guardado en un archivo.', 'bien');
  else if (res === 'unavailable') toast('Esta vista no deja guardar archivos. Usa la app de escritorio de HOUSE.', 'error', 6000);
}

/** Asks for files with the system picker. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    });
    // A cancelled picker never fires "change"; the promise simply stays pending.
    document.body.appendChild(input);
    input.click();
  });
}

export async function openProjectFromDisk(): Promise<void> {
  const [f] = await pickFiles('.house,.json,application/json');
  if (!f) return;
  saveNow();
  const err = await openProjectFile(f);
  if (err) toast(err, 'error');
  else {
    useUi.getState().set({ screen: 'estudio', dialog: null, selected: null, selectedSection: null });
    toast('Proyecto abierto.', 'bien');
  }
}

export const AUDIO_ACCEPT = 'audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aif,.aiff';
