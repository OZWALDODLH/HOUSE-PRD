// The current mission, as a small poster in a corner of the studio.
import { useEffect } from 'react';
import { ST } from '../engine/protocol';
import { useLive } from '../engine/live';
import { RETOS, startReto, useReto, type RetoCtx } from '../state/retos';
import { trackById, useStudio } from '../state/store';
import { useUi } from '../state/ui';
import { Icon } from './Icon';

export function Reto() {
  const r = useReto();
  const p = useStudio((s) => s.project);
  const { selected, selectedSection } = useUi();
  const playing = useLive((s) => s[ST.PLAYING] > 0.5);
  const songSection = useLive((s) => (s[ST.MODE] > 0.5 && s[ST.PLAYING] > 0.5 ? s[ST.SECTION] : -1));
  const reto = r.active !== null ? RETOS[r.active] : null;

  // The project when the mission started, to notice what changed.
  useEffect(() => {
    if (r.active !== null && !r.start) r.set({ start: p });
  }, [r.active, r.start, p, r]);

  // Bombeo step: remember when the person turned it off.
  const bass = p.tracks.find((t) => t.family === 'bajo');
  useEffect(() => {
    if (r.active === 1 && bass && bass.duck === 0 && !r.sawOff) r.set({ sawOff: true });
  }, [r.active, bass, r]);

  const ctx: RetoCtx & { sawOff: boolean } = {
    p,
    selected: trackById(p, selected),
    playing,
    songSection,
    selectedSectionKind: p.sections.find((s) => s.id === selectedSection)?.kind ?? null,
    exported: r.exported,
    start: r.start ?? p,
    sawOff: r.sawOff,
  };
  const finished = !!reto && r.step >= reto.steps.length;
  const done = !!reto && !finished && reto.steps[r.step].done(ctx);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => useReto.getState().set({ step: useReto.getState().step + 1 }), 700);
    return () => clearTimeout(id);
  }, [done, r.step]);

  if (!reto) return null;
  return (
    <aside className="reto" aria-live="polite" aria-label={`Reto: ${reto.title}`}>
      <header>
        <b>
          Reto {r.active! + 1} de {RETOS.length}: {reto.title}
        </b>
        <button className="cerrar" onClick={() => r.set({ active: null })} aria-label="Cerrar reto">
          <Icon name="cerrar" size={14} />
        </button>
      </header>
      {finished ? (
        <>
          <p className="grande">¡Reto cumplido!</p>
          {r.active! + 1 < RETOS.length ? (
            <button className="btn claro" onClick={() => startReto(r.active! + 1)}>
              Siguiente reto: {RETOS[r.active! + 1].title}
            </button>
          ) : (
            <p>Ya sabes lo básico. Ahora haz tu propia canción.</p>
          )}
        </>
      ) : (
        <>
          <p>{reto.goal}</p>
          <ol>
            {reto.steps.map((s, i) => (
              <li key={i} className={i < r.step || (i === r.step && done) ? 'hecho' : i === r.step ? 'ahora' : ''}>
                <span className="marca">{i < r.step || (i === r.step && done) ? <Icon name="listo" size={12} /> : i + 1}</span>
                {s.text}
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}
