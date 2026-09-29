// Retos: three short missions that teach by doing. Each step checks the
// real state of the project, so nothing has to be marked by hand.
import { create } from 'zustand';
import type { Project, Track } from './model';

export interface RetoCtx {
  p: Project;
  selected: Track | undefined;
  playing: boolean;
  songSection: number;
  selectedSectionKind: string | null;
  exported: boolean;
  start: Project;
}

interface Paso {
  text: string;
  done: (c: RetoCtx) => boolean;
}

interface Reto {
  title: string;
  goal: string;
  steps: Paso[];
}

const on = (t: Track | undefined, steps: number[]) => !!t && steps.every((i) => t.steps[i]?.on);
const byPict = (p: Project, ...picts: string[]) => p.tracks.find((t) => picts.includes(t.pict));
const count = (t: Track | undefined) => (t ? t.steps.slice(0, t.length).filter((s) => s.on).length : 0);

export const RETOS: Reto[] = [
  {
    title: 'Tu primer beat',
    goal: 'Arma un ritmo de tech house desde cero.',
    steps: [
      { text: 'Presiona Espacio o el botón de reproducir.', done: (c) => c.playing },
      { text: 'Prende el Bombo en los pasos 1, 5, 9 y 13: uno en cada tiempo.', done: (c) => on(byPict(c.p, 'bombo'), [0, 4, 8, 12]) },
      { text: 'Pon Palmas en el 5 y el 13. Así suena el “uno, DOS, tres, CUATRO”.', done: (c) => on(byPict(c.p, 'palmas', 'caja'), [4, 12]) },
      { text: 'Prende hats en los pasos que quieras. Prueba entre los bombos.', done: (c) => count(byPict(c.p, 'hat', 'hatab')) >= 2 },
      { text: 'Sube el tempo a 128 BPM: arrastra el número hacia arriba.', done: (c) => c.p.bpm >= 128 },
    ],
  },
  {
    title: 'Un bajo que respira',
    goal: 'Haz que el bajo se aparte del bombo, como en el club.',
    steps: [
      { text: 'Haz clic en el nombre de la pista del Bajo.', done: (c) => c.selected?.family === 'bajo' },
      {
        text: 'Presiona Dados para que el bajo toque algo nuevo.',
        done: (c) => {
          const now = c.p.tracks.find((t) => t.family === 'bajo');
          const before = c.start.tracks.find((t) => t.id === now?.id);
          return !!now && !!before && now.steps !== before.steps;
        },
      },
      {
        text: 'Cambia el preset con las flechas junto a su nombre.',
        done: (c) => {
          const now = c.p.tracks.find((t) => t.family === 'bajo');
          const before = c.start.tracks.find((t) => t.id === now?.id);
          return !!now && !!before && now.preset !== before.preset;
        },
      },
      {
        text: 'Apaga el Bombeo con el bombo y escucha. Luego préndelo otra vez.',
        done: (c) => {
          const now = c.p.tracks.find((t) => t.family === 'bajo');
          return !!now && now.duck > 0 && (c as RetoCtx & { sawOff?: boolean }).sawOff === true;
        },
      },
    ],
  },
  {
    title: 'Arma tu drop',
    goal: 'Convierte tu loop en una canción con subida y drop.',
    steps: [
      { text: 'Cambia de Loop a Canción, en la barra de arriba.', done: (c) => c.p.mode === 'cancion' },
      { text: 'Haz clic en “¡Drop!” en la línea de tiempo para ir directo ahí.', done: (c) => c.selectedSectionKind === 'drop' },
      { text: 'Reproduce y escucha cómo la subida prepara el drop.', done: (c) => c.playing && c.songSection >= 0 },
      { text: 'Exporta tu canción con Ctrl+E o el botón Exportar.', done: (c) => c.exported },
    ],
  },
];

interface RetoState {
  active: number | null;
  step: number;
  start: Project | null;
  sawOff: boolean;
  exported: boolean;
  set: (p: Partial<RetoState>) => void;
}

export const useReto = create<RetoState>((set) => ({
  active: null,
  step: 0,
  start: null,
  sawOff: false,
  exported: false,
  set: (p) => set(p),
}));

/** Starts a mission; the studio shows it in a small poster. */
export function startReto(i: number): void {
  useReto.getState().set({ active: i, step: 0, start: null, sawOff: false, exported: false });
}

export const markExported = (): void => useReto.getState().set({ exported: true });
