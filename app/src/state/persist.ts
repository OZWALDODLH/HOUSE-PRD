// Saving and opening projects. Autosave keeps the open project safe;
// files (.house) move projects between computers.
import { useStudio, openProject, normalizeProject } from './store';
import { useUi } from './ui';
import { allSamples, deleteSamplesOf, loadSamplesFor, putSample } from './samples';
import type { GenreId, Project } from './model';
import type { SectionKind } from '../engine/protocol';
import { isTauri } from '../engine/bridge';

const K = {
  index: 'house.v1.proyectos',
  last: 'house.v1.ultimo',
  project: (id: string) => `house.v1.proyecto.${id}`,
};

export interface ProjectMeta {
  id: string;
  name: string;
  genre: GenreId;
  bpm: number;
  updatedAt: number;
  sections: { kind: SectionKind; bars: number }[];
}

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const listProjects = (): ProjectMeta[] => (read<ProjectMeta[]>(K.index) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);

const metaOf = (p: Project): ProjectMeta => ({
  id: p.id,
  name: p.name,
  genre: p.genre,
  bpm: p.bpm,
  updatedAt: p.updatedAt,
  sections: p.sections.map((s) => ({ kind: s.kind, bars: s.bars })),
});

export function saveProject(p: Project): boolean {
  if (!write(K.project(p.id), p)) return false;
  const others = listProjects().filter((m) => m.id !== p.id);
  write(K.index, [metaOf(p), ...others]);
  write(K.last, p.id);
  return true;
}

export const loadProject = (id: string): Project | null => {
  const p = read<Project>(K.project(id));
  return p ? normalizeProject(p) : null;
};

export const lastProjectId = (): string | null => read<string>(K.last);

export function deleteProject(id: string): void {
  try {
    localStorage.removeItem(K.project(id));
  } catch {
    // ignore
  }
  write(
    K.index,
    listProjects().filter((m) => m.id !== id),
  );
  void deleteSamplesOf(id);
}

/** Opens a saved project and its audio. */
export async function openSaved(id: string): Promise<boolean> {
  const p = loadProject(id);
  if (!p) return false;
  openProject(p);
  write(K.last, p.id);
  await loadSamplesFor(p);
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Saves the open project a moment after each change. */
export function startAutosave(): () => void {
  const unsub = useStudio.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ok = saveProject(useStudio.getState().project);
      useUi.getState().set({ savedAt: ok ? Date.now() : -1 });
    }, 1200);
  });
  const flush = () => {
    clearTimeout(timer);
    saveProject(useStudio.getState().project);
  };
  window.addEventListener('beforeunload', flush);
  return () => {
    unsub();
    window.removeEventListener('beforeunload', flush);
  };
}

export const saveNow = (): boolean => {
  clearTimeout(timer);
  const ok = saveProject(useStudio.getState().project);
  useUi.getState().set({ savedAt: ok ? Date.now() : -1 });
  return ok;
};

// ------------------------------------------------------------------ files --

interface HouseFile {
  app: 'HOUSE';
  version: 1;
  project: Project;
  samples: { slot: number; sr: number; name: string; data: string }[];
}

const toBase64 = (f: Float32Array): string => {
  const bytes = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const fromBase64 = (b64: string): Float32Array => {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

export function projectFile(p: Project): Blob {
  const file: HouseFile = {
    app: 'HOUSE',
    version: 1,
    project: p,
    samples: [...allSamples()].map(([slot, s]) => ({ slot, sr: s.sr, name: s.name, data: toBase64(s.data) })),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

/** Opens a .house file. Returns an error message in Spanish, or null. */
export async function openProjectFile(file: File): Promise<string | null> {
  let parsed: HouseFile;
  try {
    parsed = JSON.parse(await file.text()) as HouseFile;
  } catch {
    return 'Ese archivo no es un proyecto de HOUSE.';
  }
  if (parsed?.app !== 'HOUSE' || !parsed.project?.tracks) return 'Ese archivo no es un proyecto de HOUSE.';
  const p = normalizeProject(parsed.project);
  openProject(p);
  for (const s of parsed.samples ?? []) await putSample(p.id, s.slot, { sr: s.sr, name: s.name, data: fromBase64(s.data) });
  saveProject(useStudio.getState().project);
  return null;
}

/** Saves a file: a save dialog in the desktop app, a download in the browser. */
export async function download(blob: Blob, name: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await invoke('save_file', bytes, { headers: { 'file-name': encodeURIComponent(name) } });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeFileName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'proyecto';
