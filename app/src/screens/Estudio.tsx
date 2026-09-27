// Estudio: top bar, sounds, tabs, marquee, steps, instrument and pads (or the mixer).
import { useUi } from '../state/ui';
import { Barra } from '../ui/Barra';
import { Sonidos } from '../ui/Sonidos';
import { Marquesina } from '../ui/Marquesina';
import { Cabecera, Pistas } from '../ui/Pasos';
import { Instrumento } from '../ui/Instrumento';
import { Pads } from '../ui/Pads';
import { Mezcla } from '../ui/Mezcla';
import { Reto } from '../ui/Reto';
import { Icon } from '../ui/Icon';
import { openVisuals } from '../visuals/link';
import { openDialog } from '../state/ui';

export function Estudio() {
  const { tab, set, keyboardOn, kbMode } = useUi();
  const modo = kbMode === 'pads' ? 'Pads' : kbMode === 'piano' ? 'Piano' : 'Escala';
  return (
    <div className="app">
      {keyboardOn && <div className="franja-tm" aria-hidden="true" />}
      <Barra />
      <div className="cuerpo">
        <Sonidos />
        <main className={`trabajo${tab === 'mezcla' ? ' mezcla-on' : ''}`}>
          <nav className="pestanas" aria-label="Espacios">
            <button className={tab === 'patron' ? 'on' : ''} aria-pressed={tab === 'patron'} onClick={() => set({ tab: 'patron' })}>
              Patrón <small>F1</small>
            </button>
            <button className={tab === 'mezcla' ? 'on' : ''} aria-pressed={tab === 'mezcla'} onClick={() => set({ tab: 'mezcla' })}>
              Mezcla <small>F3</small>
            </button>
            <div className="derecha">
              <button className={`tm${keyboardOn ? ' on' : ''}`} onClick={() => set({ keyboardOn: !keyboardOn })} aria-pressed={keyboardOn}>
                <i />
                {keyboardOn ? `Teclado musical en ${modo}. Tab para salir` : 'Teclado musical apagado. Tab para prender'}
              </button>
              <button className="btn-vis" onClick={() => openDialog('visuales')}>
                <Icon name="pantalla" size={18} />
                Visuales
                <kbd>F6</kbd>
              </button>
              <button className="btn-vis" onClick={() => openDialog('exportar')}>
                <Icon name="exportar" size={16} />
                Exportar
              </button>
              <button className="btn-vis" onClick={() => openDialog('atajos')} aria-label="Atajos de teclado" title="Atajos de teclado">
                <Icon name="teclado" size={18} />
              </button>
            </div>
          </nav>
          <Marquesina />
          {tab === 'patron' ? (
            <>
              <Cabecera />
              <Pistas />
              <section className="inferior surco-t">
                <Instrumento />
                <Pads />
              </section>
            </>
          ) : (
            <Mezcla />
          )}
        </main>
      </div>
      <Reto />
    </div>
  );
}

export { openVisuals };
