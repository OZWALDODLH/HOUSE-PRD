// The main window: Inicio or Estudio, plus dialogs and notices.
import { useEffect, useState } from 'react';
import { useUi } from './state/ui';
import { Inicio } from './screens/Inicio';
import { Estudio } from './screens/Estudio';
import { Dialogos } from './ui/Dialogos';
import { PanelVisuales } from './visuals/Panel';
import { EditorAudio } from './ui/EditorAudio';
import { useAudioEdit } from './state/audioEdit';
import { Tour } from './tutorial/Tour';
import { useTour } from './tutorial/tourState';

function Toast() {
  const t = useUi((s) => s.toast);
  if (!t) return null;
  return (
    <div key={t.id} className={`toast ${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
      {t.text}
    </div>
  );
}

function AudioError() {
  const err = useUi((s) => s.audioError);
  if (!err) return null;
  return (
    <div className="toast error" role="alert" style={{ bottom: 64 }}>
      {err}
    </div>
  );
}

const ANCHO_MINIMO = 900;

/** On a phone: HOUSE is made for a computer keyboard. Offer to look anyway. */
function PantallaChica({ onAnyway }: { onAnyway: () => void }) {
  return (
    <div className="chica" role="dialog" aria-modal="true" aria-label="HOUSE en pantalla chica">
      <svg width="64" height="64" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="var(--rosa)" />
        <circle cx="14" cy="14" r="7.5" fill="none" stroke="#161412" strokeWidth="3" />
        <circle cx="14" cy="14" r="2.5" fill="#161412" />
      </svg>
      <h1>HOUSE se toca con teclado</h1>
      <p>Está hecha para computadora: tu teclado se vuelve pads y en la pantalla grande ves todas las pistas. Ábrela en tu compu para usarla bien.</p>
      <button className="cta" onClick={onAnyway}>
        Verla de todos modos
      </button>
    </div>
  );
}

export function App() {
  const { screen, dialog, lessMotion } = useUi();
  const editing = useAudioEdit((s) => s.source !== null);
  const picker = useTour((s) => s.picker);
  const [chica, setChica] = useState(() => window.innerWidth < ANCHO_MINIMO);
  useEffect(() => {
    document.documentElement.classList.toggle('menos-movimiento', lessMotion);
  }, [lessMotion]);
  const anyway = () => {
    // Shows the whole studio, scaled down to the width of the screen.
    document.documentElement.style.setProperty('zoom', String(window.innerWidth / 1280));
    setChica(false);
  };
  if (chica) return <PantallaChica onAnyway={anyway} />;
  return (
    <>
      {/* While a dialog is open, the screen behind it can't take focus or clicks. */}
      <div className="pantalla-app" inert={dialog !== null || editing || picker}>
        {screen === 'inicio' ? <Inicio /> : <Estudio />}
      </div>
      <Dialogos />
      {dialog === 'visuales' && <PanelVisuales />}
      <EditorAudio />
      <Tour />
      <AudioError />
      <Toast />
    </>
  );
}
