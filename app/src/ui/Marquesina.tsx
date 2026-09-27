// The protagonist of the studio: the song sections on a poster (papel),
// with the energy curve, the fair lights and the playhead.
import { useMemo, useRef, type CSSProperties } from 'react';
import { ST } from '../engine/protocol';
import { useLive } from '../engine/live';
import { seek } from '../engine/audio';
import { sectionStart, songBars, useStudio } from '../state/store';
import { useUi } from '../state/ui';
import type { Family, Project } from '../state/model';
import { useFrame } from './frame';

const WEIGHT: Record<Family, number> = { bateria: 1, bajo: 1.3, sintes: 0.8, voz: 0.9, samples: 0.6, efectos: 0.2 };
const BULBS = 96;

/** Energy of each section, from what plays in it (0..1). */
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
    const level = Math.min(1, 0.12 + (e / all) * 0.88);
    const x0 = (bar / total) * 1000;
    const x1 = ((bar + s.bars) / total) * 1000;
    if (s.kind === 'subida' || s.kind === 'precoro') {
      pts.push([x0, prev], [x1, Math.min(1, level + 0.25)]);
    } else {
      pts.push([x0, level], [x1, level]);
    }
    prev = level;
    bar += s.bars;
  }
  return pts.map(([x, e]) => `${x.toFixed(1)},${(54 - e * 40).toFixed(1)}`).join(' ');
}

export function Marquesina() {
  const p = useStudio((s) => s.project);
  const selected = useUi((s) => s.selectedSection);
  const set = useUi((s) => s.set);
  const song = p.mode === 'cancion';
  const cur = useLive((s) => (s[ST.MODE] > 0.5 && s[ST.PLAYING] > 0.5 ? s[ST.SECTION] : -1));
  const total = songBars(p) || 1;
  const head = useRef<HTMLDivElement>(null);

  const starts = useMemo(() => {
    let b = 0;
    return p.sections.map((s) => {
      const at = b;
      b += s.bars;
      return at;
    });
  }, [p.sections]);

  const curve = useMemo(() => energyCurve(p), [p]);

  useFrame((s) => {
    const el = head.current;
    if (!el) return;
    const on = s[ST.MODE] > 0.5 && s[ST.PLAYING] > 0.5;
    el.style.display = on ? '' : 'none';
    if (on) el.style.left = `${Math.min(100, ((s[ST.STEP] + s[ST.STEP_FRACTION]) / (total * 16)) * 100)}%`;
  });

  // Ruler: section starts, skipping labels that would touch.
  const marks: { bar: number; left: number }[] = [];
  for (const b of [...starts, total]) {
    const left = (b / total) * 100;
    if (b < total && (!marks.length || left - marks[marks.length - 1].left > 3.5)) marks.push({ bar: b + 1, left });
  }

  const curStart = cur >= 0 ? starts[cur] : -1;
  const curEnd = cur >= 0 ? starts[cur] + (p.sections[cur]?.bars ?? 0) : -1;
  const bulbOn = (i: number) => {
    const at = (i / (BULBS - 1)) * total;
    return cur >= 0 && at >= curStart && at <= curEnd;
  };
  const onBulbs = Array.from({ length: BULBS }, (_, i) => bulbOn(i));
  const firstOn = onBulbs.indexOf(true);

  const choose = (id: string) => {
    set({ selectedSection: selected === id ? null : id });
    if (song) seek(sectionStart(p, id));
  };

  return (
    <section className="marquesina" aria-label="Secciones de la canción">
      <div className="regla" aria-hidden="true">
        {marks.map((m) => (
          <span key={m.bar} style={{ left: `${m.left}%` }}>
            {m.bar}
          </span>
        ))}
      </div>
      <div className="letrero">
        <div className="focos" key={cur} aria-hidden="true">
          {onBulbs.map((on, i) => (
            <i key={i} className={on ? 'on corre' : ''} style={on ? ({ '--k': ((i - firstOn) * 400) / Math.max(1, onBulbs.filter(Boolean).length) } as CSSProperties) : undefined} />
          ))}
        </div>
        {p.sections.map((s, i) => (
          <button
            key={s.id}
            className={`sec${s.kind === 'drop' || s.kind === 'coro' ? ' drop' : ''}${i === cur ? ' actual' : ''}${selected === s.id ? ' sel' : ''}`}
            style={{ flex: `${s.bars} 1 0` }}
            onClick={() => choose(s.id)}
            aria-pressed={selected === s.id}
            title={song ? `Ir a ${s.name}` : `Elegir ${s.name}`}
          >
            <b>{s.name}</b>
            <small>{s.bars} compases</small>
          </button>
        ))}
        <svg className="energia" viewBox="0 0 1000 54" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={`0,54 ${curve} 1000,54`} fill="var(--negro)" opacity=".06" />
          <polyline points={curve} fill="none" stroke="var(--negro)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".22" />
        </svg>
        <div className="cabezal" ref={head} style={{ display: 'none' }} />
      </div>
    </section>
  );
}
