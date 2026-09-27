// Inicio: the only poster-like screen. Big type, ink strips, left aligned.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { audition, endAudition, startAudio } from '../engine/audio';
import { GENRES, emptyProject, genreById, newProjectFromGenre } from '../state/templates';
import { openProject } from '../state/store';
import { loadSamplesFor } from '../state/samples';
import { listProjects, openSaved, saveNow, saveProject } from '../state/persist';
import { openDialog, toast, useUi } from '../state/ui';
import { startReto } from '../state/retos';
import type { GenreId, Project } from '../state/model';
import { Icon } from '../ui/Icon';
import { Pict } from '../ui/Pict';
import { MiniMarquesina } from '../ui/MiniMarquesina';

type Camino = 'beat' | 'voz' | 'pads' | 'retos';

const N = '#161412';
const ICONOS: Record<Camino, ReactNode> = {
  beat: <Pict pict="bombo" family="bateria" size={48} />,
  voz: <Pict pict="voz" family="voz" size={48} />,
  pads: (
    <svg width="48" height="48" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="var(--verde)" />
      <rect x="5" y="5" width="8" height="8" rx="2" fill={N} />
      <rect x="15" y="5" width="8" height="8" rx="2" fill={N} />
      <rect x="5" y="15" width="8" height="8" rx="2" fill={N} />
      <rect x="15" y="15" width="8" height="8" rx="2" fill={N} />
    </svg>
  ),
  retos: (
    <svg width="48" height="48" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="var(--azul)" />
      <path d="M14 4l2.6 6.2 6.4.5-4.9 4.2 1.5 6.3L14 17.8 8.4 21.2l1.5-6.3L5 10.7l6.4-.5z" fill={N} />
    </svg>
  ),
};

const CAMINOS: { id: Camino; title: string; text: string }[] = [
  { id: 'beat', title: 'Hacer un beat', text: 'Batería, bajo y acordes con una plantilla que ya suena' },
  { id: 'voz', title: 'Grabar mi voz', text: 'Graba una toma y úsala como pad en tu canción' },
  { id: 'pads', title: 'Tocar pads', text: 'Tu teclado se vuelve pads para jugar' },
  { id: 'retos', title: 'Aprender con retos', text: 'Tres misiones cortas para agarrarle la onda' },
];

const TRAE_PICT: [Parameters<typeof Pict>[0]['pict'], Parameters<typeof Pict>[0]['family']][] = [
  ['bombo', 'bateria'],
  ['bajo', 'bajo'],
  ['acordes', 'sintes'],
  ['subida', 'efectos'],
];

function enter(p: Project, camino: Camino): void {
  openProject(p);
  void loadSamplesFor(p);
  saveProject(p);
  const firstMelodic = p.tracks.find((t) => t.kind === 'acid' || t.kind === 'bass808') ?? p.tracks[0];
  useUi.getState().set({
    screen: 'estudio',
    tab: 'patron',
    selected: firstMelodic?.id ?? null,
    selectedSection: null,
    page: 0,
    follow: true,
    keyboardOn: true,
    kbMode: 'pads',
    savedAt: Date.now(),
  });
  if (camino === 'voz') openDialog('grabar');
  if (camino === 'retos') startReto(0);
  if (camino === 'pads') toast('Toca con 1 2 3 4, Q W E R, A S D F y Z X C V. Espacio para reproducir.', 'info', 6000);
}

export function Inicio() {
  const [camino, setCamino] = useState<Camino>('beat');
  const [genre, setGenre] = useState<GenreId>('techhouse');
  const [playing, setPlaying] = useState<GenreId | null>(null);
  const [projects] = useState(() => listProjects());
  const audioOn = useUi((s) => s.audio === 'on');
  const hover = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const g = genreById(genre);

  useEffect(() => () => endAudition(), []);

  const listen = async (id: GenreId) => {
    if (playing === id) {
      endAudition();
      setPlaying(null);
      return;
    }
    setGenre(id);
    await startAudio();
    await audition(newProjectFromGenre(id));
    setPlaying(id);
  };

  const start = (empty: boolean) => {
    endAudition();
    // The first mission starts from an empty pattern with the genre's kit.
    const p = empty || camino === 'retos' ? emptyProject(genre) : newProjectFromGenre(genre);
    enter(p, camino);
    void startAudio();
  };

  return (
    <div className="app inicio">
      <header className="top surco-b">
        <div className="logo">HOUSE</div>
        <div className="espacio" />
        <button className="btn" onClick={() => openDialog('salidas')}>
          <Icon name="bocina" size={16} />
          Salidas de audio
        </button>
        <button className="btn" onClick={() => openDialog('atajos')}>
          <Icon name="teclado" size={16} />
          Atajos
        </button>
      </header>
      <section className="medio">
        <div className="cartel surco-r">
          <h1>¿Qué suena hoy?</h1>
          <p>Elige por dónde empezar. Todo se puede cambiar después y nada se pierde: HOUSE guarda solo.</p>
          <div className="caminos" role="radiogroup" aria-label="Por dónde empezar">
            {CAMINOS.map((c) => (
              <button key={c.id} role="radio" aria-checked={camino === c.id} className={`camino${camino === c.id ? ' sel' : ''}`} onClick={() => setCamino(c.id)} onDoubleClick={() => start(false)}>
                {ICONOS[c.id]}
                <b>{c.title}</b>
                <span>{c.text}</span>
              </button>
            ))}
          </div>
        </div>
        <aside className="estilos">
          <h2>Elige un estilo</h2>
          <div className="nota">{audioOn ? 'Pasa el cursor para escuchar cada uno.' : 'Presiona el botón redondo para escuchar cada uno.'}</div>
          <div className="generos" role="radiogroup" aria-label="Estilos">
            {GENRES.map((x) => (
              <div
                key={x.id}
                className={`genero${genre === x.id ? ' sel' : ''}`}
                onPointerEnter={() => {
                  if (!audioOn) return;
                  clearTimeout(hover.current);
                  hover.current = setTimeout(() => void listen(x.id), 220);
                }}
                onPointerLeave={() => clearTimeout(hover.current)}
                onClick={() => setGenre(x.id)}
                role="radio"
                aria-checked={genre === x.id}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setGenre(x.id))}
              >
                <button
                  className={`play${playing === x.id ? ' on' : ''}`}
                  aria-label={playing === x.id ? `Parar ${x.name}` : `Escuchar ${x.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void listen(x.id);
                  }}
                >
                  <Icon name={playing === x.id ? 'stop' : 'play'} size={12} />
                </button>
                <div>
                  <b>{x.name}</b>
                  <small className="num">{x.bpm} BPM</small>
                </div>
                <div className="ritmo" aria-hidden="true">
                  {x.rhythm.map((row, ri) => (
                    <div key={ri}>
                      {Array.from({ length: 16 }, (_, k) => (
                        <i key={k} className={row.includes(k) ? `r${ri}` : ''} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="trae">
            <b>La plantilla de {g.name.toLowerCase()} trae</b>
            <ul>
              {g.includes.map((t, i) => (
                <li key={t}>
                  <Pict pict={TRAE_PICT[i][0]} family={TRAE_PICT[i][1]} size={26} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="acciones-inicio">
            <button className="cta" onClick={() => start(false)}>
              {camino === 'voz' ? `Grabar sobre ${g.name.toLowerCase()}` : camino === 'retos' ? 'Empezar el primer reto' : `Empezar con ${g.name.toLowerCase()}`}
            </button>
            <button className="sec-btn" onClick={() => start(true)}>
              Proyecto vacío
            </button>
          </div>
        </aside>
      </section>
      <section className="proyectos">
        <header>
          <h2>Tus proyectos</h2>
          <span className="num">{projects.length ? `${Math.min(4, projects.length)} de ${projects.length}` : ''}</span>
          {projects.length > 4 && (
            <button className="btn chico" onClick={() => openDialog('proyectos')}>
              Ver todos
            </button>
          )}
        </header>
        {projects.length ? (
          <div className="tiras">
            {projects.slice(0, 4).map((m) => (
              <button
                key={m.id}
                className="proy"
                onClick={async () => {
                  endAudition();
                  saveNow();
                  if (await openSaved(m.id)) {
                    useUi.getState().set({ screen: 'estudio', selected: null, selectedSection: null, page: 0 });
                    void startAudio();
                  }
                }}
              >
                <MiniMarquesina sections={m.sections} />
                <b>{m.name}</b>
                <small>
                  <i style={{ background: 'var(--naranja)' }} />
                  {genreById(m.genre).name}, {m.bpm} BPM, {ago(m.updatedAt)}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="vacio">Aquí aparecerán tus proyectos. Empieza uno arriba: se guarda solo.</p>
        )}
      </section>
    </div>
  );
}

function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
