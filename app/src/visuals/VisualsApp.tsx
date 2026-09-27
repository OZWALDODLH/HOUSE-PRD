// The visuals window: only the picture. F full screen, B blackout, Esc leave.
import { useEffect, useRef, useState } from 'react';
import { StatusFold } from '../engine/live';
import { listen, post, type VisualSettings } from './link';
import { Stage } from './Stage';

export function VisualsApp() {
  const status = useRef(new StatusFold());
  const [settings, setSettings] = useState<VisualSettings>({ scene: 'auto', mood: 0.55, brightness: 1, blackout: false });
  const [hint, setHint] = useState(true);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    document.title = 'HOUSE · Visuales';
    const off = listen((m) => {
      if (m.t === 'live') status.current.push(m.s);
      else if (m.t === 'settings') setSettings(m.settings);
    });
    post({ t: 'hello' });
    const bye = () => post({ t: 'bye' });
    window.addEventListener('beforeunload', bye);
    const hide = setTimeout(() => setHint(false), 5000);
    return () => {
      off();
      clearTimeout(hide);
      window.removeEventListener('beforeunload', bye);
    };
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const move = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2000);
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') toggleFull();
      else if (e.code === 'KeyB') {
        setSettings((s) => {
          const next = { ...s, blackout: !s.blackout };
          post({ t: 'settings', settings: next });
          return next;
        });
      } else if (e.code === 'Escape' && document.fullscreenElement) void document.exitFullscreen();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('keydown', key);
    move();
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', key);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`ventana-vis${idle ? ' sin-cursor' : ''}`} onDoubleClick={toggleFull}>
      <Stage getStatus={() => status.current.read()} settings={settings} className="lienzo" maxDpr={1.25} />
      {hint && <div className="pista-vis">F pantalla completa, B apagón, Esc salir</div>}
    </div>
  );
}

function toggleFull(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}
