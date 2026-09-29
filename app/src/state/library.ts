// "Mis samples": sounds the person made (a recorded take, a part cut from a
// song, a chop) kept in this computer for any project. The list lives in one
// IndexedDB store and the audio in another, so listing never loads audio.
import { create } from 'zustand';
import type { Family } from './model';

export interface LibraryItem {
  id: string;
  name: string;
  family: Family;
  sr: number;
  /** Length in samples. */
  length: number;
  createdAt: number;
}

const DB = 'house-biblioteca';
const META = 'meta';
const DATA = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sin IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META, { keyPath: 'id' });
      req.result.createObjectStore(DATA);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const r = fn(db.transaction(store, mode).objectStore(store));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

interface LibraryState {
  items: LibraryItem[];
  ready: boolean;
}

export const useLibrary = create<LibraryState>(() => ({ items: [], ready: false }));

export async function refreshLibrary(): Promise<void> {
  try {
    const items = await run<LibraryItem[]>(META, 'readonly', (s) => s.getAll());
    useLibrary.setState({ items: items.sort((a, b) => b.createdAt - a.createdAt), ready: true });
  } catch {
    useLibrary.setState({ ready: true });
  }
}

export async function addToLibrary(name: string, family: Family, data: Float32Array, sr: number): Promise<LibraryItem | null> {
  const item: LibraryItem = {
    id: `smp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, 40) || 'Sample',
    family,
    sr,
    length: data.length,
    createdAt: Date.now(),
  };
  try {
    await run(DATA, 'readwrite', (s) => s.put(data, item.id));
    await run(META, 'readwrite', (s) => s.put(item));
    await refreshLibrary();
    return item;
  } catch {
    return null;
  }
}

export async function libraryAudio(id: string): Promise<{ data: Float32Array; sr: number; item: LibraryItem } | null> {
  const item = useLibrary.getState().items.find((x) => x.id === id);
  if (!item) return null;
  try {
    const data = await run<Float32Array | undefined>(DATA, 'readonly', (s) => s.get(id));
    return data ? { data, sr: item.sr, item } : null;
  } catch {
    return null;
  }
}

export async function renameLibraryItem(id: string, name: string): Promise<void> {
  const item = useLibrary.getState().items.find((x) => x.id === id);
  if (!item) return;
  await run(META, 'readwrite', (s) => s.put({ ...item, name: name.trim().slice(0, 40) || item.name }));
  await refreshLibrary();
}

export async function removeFromLibrary(id: string): Promise<void> {
  try {
    await run(META, 'readwrite', (s) => s.delete(id));
    await run(DATA, 'readwrite', (s) => s.delete(id));
  } finally {
    await refreshLibrary();
  }
}
