// Visuals panel in the main window: preview, scenes, mood and the buttons
// that open the window (also on the second screen).
import { useState } from 'react';
import { getStatus } from '../engine/live';
import { closeDialog } from '../state/ui';
import { Dialogo } from '../ui/Dialogos';
import { Icon } from '../ui/Icon';
import { Switch } from '../ui/controls';
import { openVisuals, type SceneId } from './link';
import { SCENES } from './scenes';
import { useVisuals } from './settings';
import { Stage } from './Stage';

const AVISO = 'house.v1.aviso-visuales';

export function PanelVisuales() {
  const v = useVisuals();
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(AVISO) === '1';
    } catch {
      return false;
    }
  });
  const accept = () => {
    try {
      localStorage.setItem(AVISO, '1');
    } catch {
      // ignore
    }
    setSeen(true);
  };
  if (!seen) {
    return (
      <Dialogo title="Antes de ver los visuales">
        <p>Los visuales tienen luces, colores y movimiento que siguen a la música. Si tú o alguien que los va a ver tiene epilepsia fotosensible, tengan cuidado.</p>
        <p>
          El <b>modo seguro</b> está siempre activo: la luz no cambia más de 3 veces por segundo, no hay cambios bruscos en áreas grandes y el rojo intenso se suaviza.
        </p>
        <div className="acciones">
          <button className="btn" onClick={closeDialog}>
            Ahora no
          </button>
          <button className="btn claro" onClick={accept}>
            Entendido
          </button>
        </div>
      </Dialogo>
    );
  }
  return (
    <Dialogo title="Visuales" wide>
      <div className="vis-panel">
        <div className="vis-previa">
          <Stage getStatus={getStatus} settings={v} className="lienzo" maxDpr={1} />
        </div>
        <div className="vis-controles">
          <div className="acciones" style={{ justifyContent: 'flex-start' }}>
            <button className="btn claro" onClick={() => void openVisuals(true)}>
              <Icon name="pantalla" size={16} />
              Abrir en pantalla 2
            </button>
            <button className="btn" onClick={() => void openVisuals(false)}>
              Abrir ventana
            </button>
          </div>
          <label className="etiqueta" htmlFor="animo">
            Ánimo
          </label>
          <div className="animo">
            <span>Relax</span>
            <input id="animo" type="range" min={0} max={1} step={0.01} value={v.mood} onChange={(e) => v.set({ mood: Number(e.target.value) })} />
            <span>Psicodélico</span>
          </div>
          <div className="linea-opcion">
            <div>
              <b>Piloto automático</b>
              <small>Cambia de escena en cada sección y explota en el drop</small>
            </div>
            <Switch on={v.scene === 'auto'} label="Piloto automático" onChange={(on) => v.set({ scene: on ? 'auto' : 'aurora' })} />
          </div>
          <div className="escenas" role="radiogroup" aria-label="Escenas">
            {SCENES.map((s) => (
              <button key={s.id} role="radio" aria-checked={v.scene === s.id} className={`chip${v.scene === s.id ? ' on' : ''}`} onClick={() => v.set({ scene: s.id as SceneId })}>
                {s.name}
              </button>
            ))}
          </div>
          <div className="linea-opcion">
            <div>
              <b>Apagón</b>
              <small>Baja la luz poco a poco hasta negro (B en la ventana)</small>
            </div>
            <Switch on={v.blackout} label="Apagón" ink="var(--tinta)" onChange={(blackout) => v.set({ blackout })} />
          </div>
          <p className="nota-seguro">Modo seguro activo: máximo 3 destellos por segundo, medidos en cada cuadro.</p>
        </div>
      </div>
    </Dialogo>
  );
}
