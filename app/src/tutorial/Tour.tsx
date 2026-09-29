// What the tutorial draws: the list of lessons, and during a lesson a
// spotlight on the part of the screen it talks about plus a bubble that
// explains it. Clicks go through, so the person does things for real.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { LESSONS } from './lessons';
import { endTour, finishLesson, goStep, startLesson, useTour, type TourStep } from './tour';
import { Icon } from '../ui/Icon';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;

/** Where the target is on screen, followed every frame (panels move and resize). */
function useTargetBox(target: string | undefined): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    if (!target) {
      setBox(null);
      return;
    }
    let raf = 0;
    let last = '';
    const tick = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? `${r.x}|${r.y}|${r.width}|${r.height}` : '';
      if (next !== last) {
        last = next;
        setBox(r && r.width > 0 ? { x: r.x - PAD, y: r.y - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return box;
}

/** Moves on by itself when the step's task is done. */
function useWaitFor(step: TourStep | undefined, index: number) {
  useEffect(() => {
    if (!step?.done) return;
    const id = setInterval(() => {
      if (step.done?.()) {
        clearInterval(id);
        setTimeout(() => {
          if (useTour.getState().step === index) goStep(index + 1);
        }, 450);
      }
    }, 200);
    return () => clearInterval(id);
  }, [step, index]);
}

function Bubble({ step, index, count, box }: { step: TourStep; index: number; count: number; box: Box | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!box) {
      setPos({ left: (vw - bw) / 2, top: (vh - bh) / 2 });
      return;
    }
    const gap = 12;
    const clampX = (x: number) => Math.min(vw - bw - 12, Math.max(12, x));
    const clampY = (y: number) => Math.min(vh - bh - 12, Math.max(12, y));
    // Below, above, right or left: the first side where it fits.
    if (box.y + box.h + gap + bh < vh) setPos({ left: clampX(box.x), top: box.y + box.h + gap });
    else if (box.y - gap - bh > 0) setPos({ left: clampX(box.x), top: box.y - gap - bh });
    else if (box.x + box.w + gap + bw < vw) setPos({ left: box.x + box.w + gap, top: clampY(box.y) });
    else setPos({ left: clampX(box.x - gap - bw), top: clampY(box.y) });
  }, [box, step]);
  const waiting = !!step.done;
  const last = index === count - 1;
  return (
    <div className="tour-burbuja" ref={ref} style={pos} role="dialog" aria-label={step.title} aria-live="polite">
      <div className="tour-cab">
        <span className="num">
          {index + 1} de {count}
        </span>
        <button className="btn chico icono" onClick={endTour} aria-label="Salir del tutorial" title="Salir del tutorial">
          <Icon name="cerrar" size={12} />
        </button>
      </div>
      <h3>{step.title}</h3>
      {step.body.split('\n\n').map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      {waiting && step.hazlo && (
        <p className="tour-hazlo">
          <b>Hazlo tú:</b> {step.hazlo}
        </p>
      )}
      <div className="tour-acciones">
        <button className="btn chico" onClick={() => goStep(index - 1)} disabled={index === 0}>
          Atrás
        </button>
        {waiting ? (
          <button className="btn chico" onClick={() => goStep(index + 1)} title="Pasar sin hacerlo">
            Saltar este paso
          </button>
        ) : last ? (
          <button className="btn chico primario" onClick={finishLesson}>
            Terminar lección
          </button>
        ) : (
          <button className="btn chico primario" onClick={() => goStep(index + 1)} autoFocus>
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}

function Picker() {
  const finished = useTour((s) => s.finished);
  return (
    <div className="velo" onPointerDown={(e) => e.target === e.currentTarget && endTour()}>
      <div className="dialogo ancho tour-lecciones" role="dialog" aria-modal="true" aria-label="Tutorial">
        <header>
          <h2>Tutorial: aprende a hacer música con HOUSE</h2>
          <button className="btn icono" onClick={endTour} aria-label="Cerrar">
            <Icon name="cerrar" size={14} />
          </button>
        </header>
        <div className="contenido">
          <p>
            Cada lección te señala dónde está cada cosa y te pide hacerla tú. No hace falta saber música: empieza por la primera y ve en orden. Las lecciones abren un proyecto
            de práctica; el tuyo queda guardado. Sal cuando quieras con la ✕ y regresa desde Ayuda.
          </p>
          <ol className="lecciones">
            {LESSONS.map((l, i) => (
              <li key={l.id}>
                <button onClick={() => startLesson(l)} className={finished.includes(l.id) ? 'hecha' : ''}>
                  <span className="n num">{i + 1}</span>
                  <span className="txt">
                    <b>{l.title}</b>
                    <small>{l.summary}</small>
                  </span>
                  <span className="dur num">{finished.includes(l.id) ? 'Hecha' : `${l.minutes} min`}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export function Tour() {
  const { picker, lesson, step } = useTour();
  const s = lesson?.steps[step];
  const box = useTargetBox(s?.target);
  useWaitFor(s, step);
  useEffect(() => {
    if (!lesson) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.velo, [role="menu"]')) endTour();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [lesson]);
  if (picker) return <Picker />;
  if (!lesson || !s) return null;
  return (
    <div className="tour" aria-live="polite">
      {box ? <div className="tour-foco" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-velo" />}
      <Bubble step={s} index={step} count={lesson.steps.length} box={box} />
    </div>
  );
}
