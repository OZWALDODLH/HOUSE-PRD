// The main window: Inicio or Estudio, plus dialogs and notices.
import { useEffect } from 'react';
import { useUi } from './state/ui';
import { Inicio } from './screens/Inicio';
import { Estudio } from './screens/Estudio';
import { Dialogos } from './ui/Dialogos';
import { PanelVisuales } from './visuals/Panel';

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

export function App() {
  const { screen, dialog, lessMotion } = useUi();
  useEffect(() => {
    document.documentElement.classList.toggle('menos-movimiento', lessMotion);
  }, [lessMotion]);
  return (
    <>
      {/* While a dialog is open, the screen behind it can't take focus or clicks. */}
      <div className="pantalla-app" inert={dialog !== null}>
        {screen === 'inicio' ? <Inicio /> : <Estudio />}
      </div>
      <Dialogos />
      {dialog === 'visuales' && <PanelVisuales />}
      <AudioError />
      <Toast />
    </>
  );
}
