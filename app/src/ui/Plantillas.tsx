// The list of genre templates, grouped, with a listen button and a small
// drawing of each rhythm. Used by Inicio and by "Nuevo desde plantilla…".
import { useEffect, useState } from 'react';
import { audition, endAudition, startAudio } from '../engine/audio';
import { GROUP_NAME, TEMPLATE_GENRES, newProjectFromGenre, type GenreGroup } from '../state/templates';
import type { GenreId } from '../state/model';
import { Icon } from './Icon';

const GROUPS: GenreGroup[] = ['electronica', 'urbano', 'latino', 'tranquilo'];

export function ListaPlantillas({ onCreate }: { onCreate: (g: GenreId) => void }) {
  const [group, setGroup] = useState<GenreGroup | null>(null);
  const [sel, setSel] = useState<GenreId | null>(null);
  const [playing, setPlaying] = useState<GenreId | null>(null);
  useEffect(() => () => endAudition(), []);

  const listen = async (id: GenreId) => {
    setSel(id);
    if (playing === id) {
      endAudition();
      setPlaying(null);
      return;
    }
    await startAudio();
    await audition(newProjectFromGenre(id));
    setPlaying(id);
  };
  const create = (id: GenreId) => {
    endAudition();
    setPlaying(null);
    onCreate(id);
  };

  const list = TEMPLATE_GENRES.filter((g) => !group || g.group === group);
  return (
    <div className="plantillas">
      <div className="chips" role="group" aria-label="Estilos">
        <button className={`chip${group === null ? ' on' : ''}`} aria-pressed={group === null} onClick={() => setGroup(null)}>
          Todos <span className="num">{TEMPLATE_GENRES.length}</span>
        </button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip${group === g ? ' on' : ''}`} aria-pressed={group === g} onClick={() => setGroup(group === g ? null : g)}>
            {GROUP_NAME[g]}
          </button>
        ))}
      </div>
      <div className="pl-lista" role="list" aria-label="Plantillas" data-tour="plantillas">
        {list.map((g) => (
          <div
            key={g.id}
            role="listitem"
            className={`pl-fila${sel === g.id ? ' sel' : ''}${playing === g.id ? ' suena' : ''}`}
            onClick={() => setSel(g.id)}
            onDoubleClick={() => create(g.id)}
          >
            <button
              className={`pl-play${playing === g.id ? ' on' : ''}`}
              aria-label={playing === g.id ? `Parar ${g.name}` : `Escuchar ${g.name}`}
              title={playing === g.id ? 'Parar' : 'Escuchar'}
              onClick={(e) => {
                e.stopPropagation();
                void listen(g.id);
              }}
            >
              <Icon name={playing === g.id ? 'stop' : 'play'} size={12} />
            </button>
            <div className="pl-nombre">
              <b>{g.name}</b>
              <small>{g.blurb}</small>
            </div>
            <span className="pl-bpm num">{g.bpm} BPM</span>
            <div className="ritmo" aria-hidden="true">
              {g.rhythm.map((row, ri) => (
                <div key={ri}>
                  {Array.from({ length: 16 }, (_, k) => (
                    <i key={k} className={row.includes(k) ? `r${ri}` : ''} />
                  ))}
                </div>
              ))}
            </div>
            <button
              className="btn chico pl-crear"
              onClick={(e) => {
                e.stopPropagation();
                create(g.id);
              }}
            >
              Crear
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
