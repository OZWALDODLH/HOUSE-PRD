// Inicio: the start page of a real program. Start blank, from a template or
// from a file; your projects on the right; the tutorial always at hand.
import { useState } from 'react';
import { endAudition, startAudio } from '../engine/audio';
import { blankProject, emptyProject, genreById } from '../state/templates';
import { listProjects, openSaved, saveNow, type ProjectMeta } from '../state/persist';
import { openDialog, useUi } from '../state/ui';
import { startReto } from '../state/retos';
import { enterStudio, newBlankProject, newFromTemplate, openProjectFromDisk } from '../state/actions';
import { LESSONS } from '../tutorial/lessons';
import { startTutorial, useTour } from '../tutorial/tourState';
import { Icon, type IconName } from '../ui/Icon';
import { MiniMarquesina } from '../ui/MiniMarquesina';
import { ListaPlantillas } from '../ui/Plantillas';
import { shortcut } from '../ui/MenuBar';

function Accion({ icon, title, text, keys, onClick, tour }: { icon: IconName; title: string; text: string; keys?: string; onClick: () => void; tour?: string }) {
  return (
    <button className="accion" onClick={onClick} data-tour={tour}>
      <span className="accion-ico" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="accion-txt">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      {keys && <kbd>{shortcut(keys)}</kbd>}
    </button>
  );
}

async function openMeta(m: ProjectMeta): Promise<void> {
  endAudition();
  saveNow();
  if (await openSaved(m.id)) {
    useUi.getState().set({ screen: 'estudio', selected: null, selectedSection: null, page: 0 });
    void startAudio();
  }
}

export function Inicio() {
  const [projects] = useState(() => listProjects());
  const finished = useTour((s) => s.finished);
  const done = LESSONS.filter((l) => finished.includes(l.id)).length;

  return (
    <div className="app inicio">
      <header className="inicio-barra">
        <span className="marca">HOUSE</span>
        <span className="espacio" />
        <button className="btn" onClick={() => openDialog('salidas')}>
          <Icon name="audifonos" size={14} />
          Salidas de audio
        </button>
        <button className="btn" onClick={() => openDialog('atajos')}>
          <Icon name="teclado" size={14} />
          Atajos
        </button>
      </header>
      <div className="inicio-cuerpo">
        <section className="inicio-col empezar" aria-labelledby="t-empezar">
          <h1 id="t-empezar">Empezar</h1>
          <Accion icon="mas" title="Proyecto en blanco" text="Sin nada: tú eliges cada sonido." keys="Ctrl+N" onClick={newBlankProject} tour="proyecto-blanco" />
          <Accion icon="carpeta" title="Abrir archivo .house" text="Un proyecto que guardaste en tu compu." onClick={() => void openProjectFromDisk()} />
          <Accion
            icon="micro"
            title="Grabar mi voz"
            text="Graba, recorta tu parte favorita y úsala en un pad."
            onClick={() => {
              saveNow();
              enterStudio(blankProject());
              openDialog('grabar');
            }}
          />
          <h2>Aprender</h2>
          <Accion
            icon="libro"
            title="Tutorial"
            text={done ? `Llevas ${done} de ${LESSONS.length} lecciones. Sigue donde te quedaste.` : 'De cero a tu primera canción: ritmo, bajo, acordes, estructura y mezcla.'}
            onClick={startTutorial}
            tour="abrir-tutorial"
          />
          <Accion
            icon="listo"
            title="Retos"
            text="Tres misiones cortas para agarrarle la onda."
            onClick={() => {
              saveNow();
              enterStudio(emptyProject('techhouse'));
              startReto(0);
            }}
          />
        </section>
        <section className="inicio-col centro" aria-labelledby="t-plantillas">
          <div className="inicio-tit">
            <h1 id="t-plantillas">Plantillas</h1>
            <p>Cada una ya suena. Escúchala con el botón redondo y dale Crear: todo se puede cambiar.</p>
          </div>
          <ListaPlantillas onCreate={(g) => newFromTemplate(g)} />
        </section>
        <section className="inicio-col recientes" aria-labelledby="t-proyectos">
          <div className="inicio-tit">
            <h1 id="t-proyectos">Tus proyectos</h1>
            {projects.length > 6 && (
              <button className="btn chico" onClick={() => openDialog('proyectos')}>
                Ver todos
              </button>
            )}
          </div>
          {projects.length ? (
            <div className="rec-lista" role="list">
              {projects.slice(0, 8).map((m) => (
                <button key={m.id} role="listitem" className="rec" onClick={() => void openMeta(m)}>
                  <MiniMarquesina sections={m.sections} />
                  <b>{m.name}</b>
                  <small>
                    {genreById(m.genre).name}, {m.bpm} BPM, {ago(m.updatedAt)}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <p className="vacio">Aquí aparecerán tus proyectos. HOUSE guarda solo mientras trabajas.</p>
          )}
        </section>
      </div>
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
