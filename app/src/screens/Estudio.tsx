// The studio: menu bar, toolbar, browser, the views (pattern, arrangement,
// piano roll, mixer) under the song timeline, and the instrument dock.
import { useState, type DragEvent } from 'react';
import { TAB_KEY, TAB_NAME, openDialog, useUi, type Tab } from '../state/ui';
import { importAudio } from '../state/audioEdit';
import { MenuBar } from '../ui/MenuBar';
import { Barra } from '../ui/Barra';
import { Navegador } from '../ui/Navegador';
import { Timeline } from '../ui/Timeline';
import { Cabecera, Pistas } from '../ui/Pasos';
import { Arreglo } from '../ui/Arreglo';
import { PianoRoll } from '../ui/PianoRoll';
import { Instrumento } from '../ui/Instrumento';
import { Pads } from '../ui/Pads';
import { Mezcla } from '../ui/Mezcla';
import { Reto } from '../ui/Reto';
import { Icon } from '../ui/Icon';
import { openVisuals } from '../visuals/link';

const TABS: Tab[] = ['patron', 'arreglo', 'piano', 'mezcla'];

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

function Vistas() {
  const { tab, set, dock } = useUi();
  return (
    <nav className="vistas" aria-label="Vistas">
      <div role="tablist" aria-label="Vista">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => set({ tab: t })} data-tour={`vista-${t}`}>
            {TAB_NAME[t]}
            <kbd>{TAB_KEY[t]}</kbd>
          </button>
        ))}
      </div>
      <div className="espacio" />
      {tab !== 'mezcla' && (
        <button className="btn" onClick={() => set({ dock: !dock })} title={dock ? 'Esconde el instrumento y el teclado para ver más' : 'Muestra el instrumento y el teclado'} data-tour="panel">
          <Icon name="teclado" size={14} />
          {dock ? 'Ocultar panel' : 'Mostrar panel'}
        </button>
      )}
      <button className="btn" onClick={() => openVisuals()} title="Abre los visuales en otra ventana (F6)" data-tour="visuales">
        <Icon name="pantalla" size={14} />
        Visuales
      </button>
      <button className="btn" onClick={() => openDialog('exportar')} title="Exportar canción (Ctrl+E)" data-tour="exportar">
        <Icon name="exportar" size={14} />
        Exportar
      </button>
    </nav>
  );
}

function Salidas() {
  const outputs = useUi((s) => s.outputs);
  return (
    <button className="salidas" onClick={() => openDialog('salidas')} title="Elige por dónde suena" data-tour="salidas">
      <Icon name="bocina" size={14} />
      {outputs.cue ? 'Bocina y audífonos' : 'Salida de audio'}
    </button>
  );
}

export function Estudio() {
  const { tab, dock, nav, keyboardOn } = useUi();
  const [dropping, setDropping] = useState(false);
  return (
    <div
      className={`estudio${nav ? '' : ' sin-nav'}${dock && tab !== 'mezcla' ? '' : ' sin-dock'}`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget) setDropping(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        void importAudio(Array.from(e.dataTransfer.files));
      }}
    >
      {keyboardOn && <div className="franja-tm" aria-hidden="true" />}
      <MenuBar right={<Salidas />} />
      <Barra />
      <div className="cuerpo">
        {nav && <Navegador />}
        <main className="trabajo">
          <Vistas />
          <Timeline />
          <div className={`vista vista-${tab}`}>
            {tab === 'patron' && (
              <>
                <Cabecera />
                <Pistas />
              </>
            )}
            {tab === 'arreglo' && <Arreglo />}
            {tab === 'piano' && <PianoRoll />}
            {tab === 'mezcla' && <Mezcla />}
          </div>
          {dock && tab !== 'mezcla' && (
            <section className="dock" aria-label="Instrumento y teclado musical" data-tour="dock">
              <Instrumento />
              <Pads />
            </section>
          )}
        </main>
      </div>
      {dropping && (
        <div className="soltar-audio" aria-hidden="true">
          <b>Suelta el audio aquí</b>
          <span>Se abre en el editor para que elijas la parte que quieres.</span>
        </div>
      )}
      <Reto />
    </div>
  );
}

export { openVisuals };
