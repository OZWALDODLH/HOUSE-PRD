// The song timeline: bar ruler, sections and the playhead. The one element
// that leads the studio (DESIGN.md 8). Click or drag on the ruler to move the
// playhead anywhere in the song, playing or stopped.
import { useMemo, useRef, type PointerEvent } from 'react';
import { ST } from '../engine/protocol';
import { getStatus, useLive } from '../engine/live';
import { seek } from '../engine/audio';
import { barsToSeconds, formatDuration, setMode, songBars, useStudio } from '../state/store';
import { toast, useUi } from '../state/ui';
import type { Family, Project } from '../state/model';
import { useFrame } from './frame';
import { useWidth } from './useWidth';

const WEIGHT: Record<Family, number> = { bateria: 1, bajo: 1.3, sintes: 0.8, voz: 0.9, samples: 0.6, efectos: 0.2 };

/** Energy of each section, from what plays in it (0..1), as an SVG polyline. */
function energyCurve(p: Project): string {
  const total = songBars(p) || 1;
  const all = p.tracks.reduce((a, t) => a + WEIGHT[t.family] * (t.pict === 'bombo' ? 1.5 : 1), 0) || 1;
  const pts: [number, number][] = [];
  let bar = 0;
  let prev = 0.15;
  for (const s of p.sections) {
    const e = s.tracks.reduce((a, id) => {
      const t = p.tracks.find((x) => x.id === id);
      return t && !t.once ? a + WEIGHT[t.family] * (t.pict === 'bombo' ? 1.5 : 1) : a;
    }, 0);
    const level = Math.min(1, 0.1 + (e / all) * 0.9);
    const x0 = (bar / total) * 1000;
    const x1 = ((bar + s.bars) / total) * 1000;
    if (s.kind === 'subida' || s.kind === 'precoro') pts.push([x0, prev], [x1, Math.min(1, level + 0.2)]);
    else pts.push([x0, level], [x1, level]);
    prev = level;
    bar += s.bars;
  }
  return pts.map(([x, e]) => `${x.toFixed(1)},${(30 - e * 26).toFixed(1)}`).join(' ');
}

/** Bars between ruler labels so they never touch. */
function labelEvery(total: number, width: number): number {
  const px = width / Math.max(1, total);
  for (const n of [1, 2, 4, 8, 16, 32]) if (px * n >= 30) return n;
  return 64;
}

export function Timeline() {
  const p = useStudio((s) => s.project);
  const selected = useUi((s) => s.selectedSection);
  const set = useUi((s) => s.set);
  const total = songBars(p) || 1;
  const song = p.mode === 'cancion';
  const cur = useLive((s) => (s[ST.MODE] > 0.5 && s[ST.PLAYING] > 0.5 ? s[ST.SECTION] : -1));
  const area = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const drag = useRef<{ last: number } | null>(null);
  const width = useWidth(area);
  const every = labelEvery(total, width || 900);
  const curve = useMemo(() => energyCurve(p), [p]);

  const starts = useMemo(() => {
    let b = 0;
    return p.sections.map((s) => {
      const at = b;
      b += s.bars;
      return at;
    });
  }, [p.sections]);

  useFrame((s) => {
    const el = head.current;
    if (!el) return;
    const live = s[ST.MODE] > 0.5;
    const pos = s[ST.STEP] + (s[ST.PLAYING] > 0.5 ? s[ST.STEP_FRACTION] : 0);
    const f = Math.min(1, Math.max(0, (live ? pos : 0) / (total * 16)));
    // Moved on its own layer: the timeline never repaints while it plays.
    el.style.transform = `translateX(${f * (area.current?.clientWidth ?? 0)}px)`;
    el.classList.toggle('quieto', !live);
  });

  /** Song step under the pointer: snapped to the beat, or to the step with Shift. */
  const stepAt = (e: PointerEvent): number => {
    const r = area.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const raw = x * total * 16;
    const snap = e.shiftKey ? 1 : 4;
    return Math.min(total * 16 - 1, Math.round(raw / snap) * snap);
  };

  const go = (step: number) => {
    if (drag.current && drag.current.last === step) return;
    if (drag.current) drag.current.last = step;
    seek(Math.floor(step / 16), step % 16);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    area.current?.setPointerCapture(e.pointerId);
    if (!song) {
      setMode('cancion');
      toast('Modo Canción: suena la canción desde donde elegiste.', 'info', 2600);
    }
    drag.current = { last: -1 };
    go(stepAt(e));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) go(stepAt(e));
  };
  const up = () => {
    drag.current = null;
  };

  const marks: number[] = [];
  for (let b = 0; b < total; b += every) marks.push(b);

  return (
    <section className="linea-tiempo" aria-label="Línea de tiempo de la canción" data-tour="linea-tiempo">
      <div className="lt-info">
        <b>Canción</b>
        <span className="num">
          {formatDuration(barsToSeconds(total, p.bpm))}, {total} compases
        </span>
      </div>
      <div className="lt-area" ref={area}>
        <div
          className="lt-regla"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          role="slider"
          tabIndex={0}
          aria-label="Posición en la canción. Clic o arrastra para moverte."
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={1}
          data-tour="regla"
          onKeyDown={(e) => {
            // Arrows move the playhead a beat (a bar with Shift).
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            e.stopPropagation();
            const now = Math.round(getStatus()[ST.STEP]);
            const d = (e.shiftKey ? 16 : 4) * (e.key === 'ArrowRight' ? 1 : -1);
            const step = Math.min(total * 16 - 1, Math.max(0, now + d));
            if (!song) setMode('cancion');
            seek(Math.floor(step / 16), step % 16);
          }}
        >
          {marks.map((b) => (
            <span key={b} className="marca" style={{ left: `${(b / total) * 100}%` }}>
              {b + 1}
            </span>
          ))}
        </div>
        <div className="lt-secciones" data-tour="secciones">
          {p.sections.map((s, i) => (
            <button
              key={s.id}
              className={`lt-sec${i === cur ? ' actual' : ''}${selected === s.id ? ' sel' : ''}`}
              style={{ left: `${(starts[i] / total) * 100}%`, width: `${(s.bars / total) * 100}%` }}
              onClick={() => {
                set({ selectedSection: selected === s.id ? null : s.id });
                if (song) seek(starts[i]);
              }}
              aria-pressed={selected === s.id}
              title={`${s.name}: ${s.bars} compases. Clic para elegirla${song ? ' e ir ahí' : ''}.`}
            >
              <b>{s.name}</b>
              <small className="num">{s.bars}</small>
            </button>
          ))}
          <svg className="lt-energia" viewBox="0 0 1000 30" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={curve} fill="none" stroke="var(--tinta-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="lt-cabezal" ref={head} aria-hidden="true">
          <i />
        </div>
      </div>
    </section>
  );
}
