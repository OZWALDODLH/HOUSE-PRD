// A canvas that runs the visuals from a status source (used by the window
// and by the small preview in the main window).
import { useEffect, useRef, useState } from 'react';
import { VisualsRenderer } from './renderer';
import { Autopilot } from './settings';
import type { VisualSettings } from './link';

interface Props {
  getStatus: () => Float32Array;
  settings: VisualSettings;
  className?: string;
  /** Caps device pixels for the small preview. */
  maxDpr?: number;
  onRenderer?: (r: VisualsRenderer | null) => void;
}

export function Stage({ getStatus, settings, className, maxDpr = 1.5, onRenderer }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(settings);
  live.current = settings;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    let r: VisualsRenderer;
    try {
      r = new VisualsRenderer(c, 'aurora');
    } catch {
      setError('Tu equipo no tiene WebGL2. Actualiza el navegador o los controladores de video.');
      return;
    }
    onRenderer?.(r);
    const pilot = new Autopilot();
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      const dpr = Math.min(maxDpr, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(c.clientWidth * dpr));
      const h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    };
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      resize();
      const s = live.current;
      const input = pilot.update(getStatus(), dt, s.mood);
      const want = s.scene === 'auto' ? pilot.scene : s.scene;
      if (want !== r.scene) r.setScene(want, s.scene === 'auto' ? 2.2 : 1.2);
      r.frame({ ...input, brightness: s.brightness, blackout: s.blackout });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      onRenderer?.(null);
      r.dispose();
    };
    // The renderer lives as long as the canvas.
  }, []);

  if (error) return <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#B9B0A3' }}>{error}</div>;
  return <canvas ref={canvas} className={className} aria-label="Visuales" />;
}
