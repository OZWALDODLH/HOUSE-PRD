// Arreglo: the song laid out like a playlist. Each row is a track, each
// column a section of the timeline; a block means the track plays there.
// Under the rows, the automation curves (transitions) over the same time.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { SECTION_NAMES, addSection, duplicateSection, moveSection, removeSection, sectionStart, setSection, songBars, toggleSectionTrack, useStudio } from '../state/store';
import { toast, useUi } from '../state/ui';
import { isMelodic, type AutoLane, type AutoPoint, type Project, type Track } from '../state/model';
import type { SectionKind } from '../engine/protocol';
import { TRANSITIONS, addLane, applyTransition, laneName, laneTargets, laneValueText, removeLane, setLanePoints } from '../state/automation';
import { dropOnTrack } from './Navegador';
import { INK, Pict } from './Pict';
import { Icon } from './Icon';
import { Menu } from './Menu';
import { useWidth } from './useWidth';

const KINDS: SectionKind[] = ['intro', 'verso', 'precoro', 'coro', 'subida', 'drop', 'pausa', 'puente', 'salida', 'none'];

export function Arreglo() {
  const p = useStudio((s) => s.project);
  const total = songBars(p) || 1;
  return (
    <div className="arreglo">
      <BarraSecciones p={p} />
      <div className="arr-scroll">
        <Filas p={p} total={total} />
        <Curvas p={p} total={total} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------- sections --

function BarraSecciones({ p }: { p: Project }) {
  const selectedSection = useUi((s) => s.selectedSection);
  const set = useUi((s) => s.set);
  const s = p.sections.find((x) => x.id === selectedSection);
  const add = (after?: string) => set({ selectedSection: addSection('drop', after) });
  if (!s) {
    return (
      <div className="arr-barra">
        <span className="nota">Elige una sección en la línea de tiempo para cambiarla, o haz clic en los bloques para decidir qué suena en cada parte.</span>
        <div className="espacio" />
        <button className="btn" onClick={() => add(p.sections[p.sections.length - 1]?.id)} data-tour="agregar-seccion">
          <Icon name="mas" size={14} />
          Sección al final
        </button>
      </div>
    );
  }
  const i = p.sections.indexOf(s);
  return (
    <div className="arr-barra" data-tour="editor-seccion">
      <Menu
        label={
          <>
            {s.name}
            <Icon name="abajo" size={12} />
          </>
        }
        title="Tipo de sección"
      >
        {(close) =>
          KINDS.map((k) => (
            <button
              key={k}
              role="menuitemradio"
              aria-checked={s.kind === k}
              className={s.kind === k ? 'on' : ''}
              onClick={() => {
                setSection(s.id, { kind: k, name: SECTION_NAMES[k] });
                close();
              }}
            >
              {SECTION_NAMES[k]}
            </button>
          ))
        }
      </Menu>
      <div className="grupo-h" role="group" aria-label="Duración">
        <button className="btn icono" onClick={() => setSection(s.id, { bars: Math.max(1, s.bars - 1) })} aria-label="Un compás menos" disabled={s.bars <= 1}>
          −
        </button>
        <span className="valor num">
          {s.bars} {s.bars === 1 ? 'compás' : 'compases'}
        </span>
        <button className="btn icono" onClick={() => setSection(s.id, { bars: Math.min(64, s.bars + 1) })} aria-label="Un compás más">
          +
        </button>
      </div>
      <div className="grupo-h">
        <button className="btn icono" onClick={() => moveSection(s.id, -1)} disabled={i === 0} aria-label="Mover antes" title="Mover antes">
          <Icon name="izq" size={14} />
        </button>
        <button className="btn icono" onClick={() => moveSection(s.id, 1)} disabled={i === p.sections.length - 1} aria-label="Mover después" title="Mover después">
          <Icon name="der" size={14} />
        </button>
      </div>
      <Menu tour="transicion" label={<>Transición <Icon name="abajo" size={12} /></>} title="Una curva lista para esta sección" width={300}>
        {(close) => (
          <>
            {TRANSITIONS.map((t) => (
              <button
                key={t.id}
                role="menuitem"
                className="con-desc"
                onClick={() => {
                  close();
                  applyTransition(s.id, t.id);
                  toast(`${t.name} en ${s.name}. Ajusta la curva abajo si quieres.`, 'bien', 3200);
                }}
              >
                <b>{t.name}</b>
                <small>{t.desc}</small>
              </button>
            ))}
          </>
        )}
      </Menu>
      <button className="btn" onClick={() => duplicateSection(s.id)}>
        <Icon name="duplicar" size={14} />
        Duplicar
      </button>
      <button className="btn" onClick={() => add(s.id)}>
        <Icon name="mas" size={14} />
        Sección
      </button>
      <button
        className="btn icono"
        onClick={() => {
          removeSection(s.id);
          set({ selectedSection: null });
        }}
        disabled={p.sections.length <= 1}
        aria-label="Borrar sección"
        title="Borrar sección"
      >
        <Icon name="basura" size={14} />
      </button>
      <div className="espacio" />
      <button className="btn chico" onClick={() => set({ selectedSection: null })}>
        Listo
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ rows --

/** Tiny drawing of a track's pattern, repeated over a section. */
function Miniatura({ t, bars }: { t: Track; bars: number }) {
  const steps = bars * 16;
  const hits: { x: number; y: number; w: number }[] = [];
  const notes = t.steps.slice(0, t.length).flatMap((s) => (s.on ? s.notes : []));
  const lo = notes.length ? Math.min(...notes) : 0;
  const hi = notes.length ? Math.max(...notes) : 1;
  for (let i = 0; i < steps && hits.length < 600; i++) {
    const s = t.steps[i % t.length];
    if (!s.on) continue;
    if (isMelodic(t) && s.notes.length) {
      for (const n of s.notes) hits.push({ x: i / steps, y: hi > lo ? 1 - (n - lo) / (hi - lo) : 0.5, w: s.len / steps });
    } else hits.push({ x: i / steps, y: 0.5, w: 0 });
  }
  return (
    <svg className="mini" viewBox="0 0 1000 20" preserveAspectRatio="none" aria-hidden="true">
      {hits.map((h, k) =>
        h.w ? (
          <rect key={k} x={h.x * 1000} y={2 + h.y * 14} width={Math.max(2, h.w * 1000 - 1)} height={2.5} />
        ) : (
          <rect key={k} x={h.x * 1000} y={4} width={1.4} height={12} />
        ),
      )}
    </svg>
  );
}

function Filas({ p, total }: { p: Project; total: number }) {
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const grid = useRef<HTMLDivElement>(null);
  const paint = useRef<{ on: boolean; done: Set<string> } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const cellAt = (e: PointerEvent) => {
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-celda]');
    return el && grid.current?.contains(el) ? { sec: el.dataset.sec!, track: el.dataset.track! } : null;
  };
  const apply = (sec: string, track: string) => {
    const pt = paint.current;
    if (!pt || pt.done.has(`${sec}|${track}`)) return;
    pt.done.add(`${sec}|${track}`);
    const s = p.sections.find((x) => x.id === sec);
    if (s && s.tracks.includes(track) !== pt.on) toggleSectionTrack(sec, track);
  };

  if (!p.tracks.length) {
    return <div className="vacio-pistas">Tu canción no tiene pistas todavía. Arrastra sonidos del navegador o graba tu voz.</div>;
  }

  return (
    <div
      className="arr-filas"
      ref={grid}
      onPointerDown={(e) => {
        const c = cellAt(e);
        if (!c || e.button !== 0) return;
        e.preventDefault();
        grid.current?.setPointerCapture(e.pointerId);
        const s = p.sections.find((x) => x.id === c.sec);
        paint.current = { on: !s?.tracks.includes(c.track), done: new Set() };
        apply(c.sec, c.track);
      }}
      onPointerMove={(e) => {
        if (!paint.current) return;
        const c = cellAt(e);
        if (c) apply(c.sec, c.track);
      }}
      onPointerUp={() => (paint.current = null)}
      onPointerCancel={() => (paint.current = null)}
      data-tour="arreglo-filas"
    >
      {p.tracks.map((t) => (
        <div
          key={t.id}
          className={`arr-fila${selected === t.id ? ' sel' : ''}${over === t.id ? ' soltar' : ''}`}
          style={{ '--c': INK[t.family] } as CSSProperties}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/house-fx') || e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              e.stopPropagation();
              setOver(t.id);
            }
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            setOver(null);
            if (dropOnTrack(t.id, e.dataTransfer)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <button className="arr-nombre" onClick={() => set({ selected: t.id })} aria-pressed={selected === t.id}>
            <i className="tira" aria-hidden="true" />
            <Pict pict={t.pict} family={t.family} size={18} />
            <span>{t.name}</span>
          </button>
          <div className="arr-celdas">
            {p.sections.map((s) => {
              const on = s.tracks.includes(t.id);
              const left = (sectionStart(p, s.id) / total) * 100;
              return (
                <button
                  key={s.id}
                  data-celda
                  data-sec={s.id}
                  data-track={t.id}
                  className={`arr-celda${on ? ' on' : ''}`}
                  style={{ left: `${left}%`, width: `${(s.bars / total) * 100}%` }}
                  aria-pressed={on}
                  aria-label={`${t.name} en ${s.name}: ${on ? 'suena' : 'callada'}`}
                  title={on ? `${t.name} suena en ${s.name}. Clic para callarla ahí.` : `${t.name} está callada en ${s.name}. Clic para que suene.`}
                >
                  {on && <Miniatura t={t} bars={s.bars} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- curves --

function Curvas({ p, total }: { p: Project; total: number }) {
  const selected = useUi((s) => s.selected);
  const groups = useMemo(() => laneTargets(p, selected), [p, selected]);
  const box = useRef<HTMLElement>(null);
  const count = useRef(p.lanes.length);
  // A new curve (from "Transición" or "+ Curva") scrolls into view.
  useEffect(() => {
    if (p.lanes.length > count.current) box.current?.querySelector('.carril:last-of-type')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    count.current = p.lanes.length;
  }, [p.lanes.length]);
  return (
    <section className="arr-curvas" aria-label="Curvas de automatización" data-tour="curvas" ref={box}>
      <div className="arr-curvas-cab">
        <b>Curvas</b>
        <span className="nota">Mueven una perilla con el tiempo, como abrir un filtro en la subida. Suenan en modo Canción.</span>
        <div className="espacio" />
        <Menu tour="agregar-curva" label={<><Icon name="mas" size={14} /> Curva</>} title="Agregar una curva" align="right" width={260}>
          {(close) => (
            <>
              {groups.map((g) => (
                <div key={g.group} role="group" aria-label={g.group}>
                  <span className="menu-grupo">{g.group}</span>
                  {g.items.map((it) => (
                    <button
                      key={`${it.target}-${it.trackId}-${it.param}`}
                      role="menuitem"
                      onClick={() => {
                        close();
                        if (!addLane(it)) toast('Ya tienes 16 curvas. Quita una para agregar otra.', 'error');
                      }}
                    >
                      {it.name}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </Menu>
      </div>
      {p.lanes.map((l) => (
        <Carril key={l.id} p={p} lane={l} total={total} />
      ))}
      {!p.lanes.length && <p className="vacio-curvas">Sin curvas. Elige una sección y usa “Transición”, o agrega una curva con el botón de arriba.</p>}
    </section>
  );
}

const H = 56;

function Carril({ p, lane, total }: { p: Project; lane: AutoLane; total: number }) {
  const area = useRef<HTMLDivElement>(null);
  const width = useWidth(area) || 800;
  const steps = total * 16;
  const drag = useRef<{ kind: 'punto'; index: number; key: string } | { kind: 'curva'; index: number; y: number; t0: number; key: string } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const lastDown = useRef<{ i: number; at: number } | null>(null);
  const pts = lane.points;
  const X = (pos: number) => (pos / steps) * width;
  const Y = (v: number) => 4 + (1 - v) * (H - 8);

  const path = useMemo(() => {
    if (!pts.length) return '';
    const d: string[] = [`M0 ${Y(pts[0].value)}`, `L${X(pts[0].pos)} ${Y(pts[0].value)}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      for (let k = 1; k <= 20; k++) {
        const t = k / 20;
        const v = a.value + (b.value - a.value) * bend(t, a.tension);
        d.push(`L${X(a.pos + (b.pos - a.pos) * t).toFixed(1)} ${Y(v).toFixed(1)}`);
      }
    }
    const last = pts[pts.length - 1];
    d.push(`L${width} ${Y(last.value)}`);
    return d.join(' ');
  }, [pts, width, steps]);

  const toPoint = (e: PointerEvent): AutoPoint => {
    const r = area.current!.getBoundingClientRect();
    const pos = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * steps * (e.shiftKey ? 4 : 1)) / (e.shiftKey ? 4 : 1);
    const value = Math.min(1, Math.max(0, 1 - (e.clientY - r.top - 4) / (H - 8)));
    return { pos, value: Math.round(value * 100) / 100, tension: 0 };
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    area.current?.setPointerCapture(e.pointerId);
    const el = e.target as HTMLElement;
    const key = `curva:${lane.id}:${performance.now()}`;
    if (el.dataset.punto !== undefined) {
      const i = Number(el.dataset.punto);
      // Double click removes the point (pointer capture keeps dblclick away).
      const now = performance.now();
      if (lastDown.current?.i === i && now - lastDown.current.at < 350) {
        lastDown.current = null;
        remove(i);
        return;
      }
      lastDown.current = { i, at: now };
      drag.current = { kind: 'punto', index: i, key };
      return;
    }
    if (el.dataset.tension !== undefined) {
      const i = Number(el.dataset.tension);
      drag.current = { kind: 'curva', index: i, y: e.clientY, t0: pts[i].tension, key };
      return;
    }
    // A new point where you clicked.
    const np = toPoint(e);
    const next = [...pts, np].sort((a, b) => a.pos - b.pos);
    setLanePoints(lane.id, next, key);
    drag.current = { kind: 'punto', index: next.indexOf(np), key };
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const cur = useStudio.getState().project.lanes.find((l) => l.id === lane.id)?.points ?? pts;
    if (d.kind === 'punto') {
      const np = toPoint(e);
      const prev = cur[d.index - 1];
      const next = cur[d.index + 1];
      const pos = Math.min(next ? next.pos : steps, Math.max(prev ? prev.pos : 0, np.pos));
      const copy = cur.slice();
      copy[d.index] = { ...cur[d.index], pos, value: np.value };
      setLanePoints(lane.id, copy, d.key);
    } else {
      const a = cur[d.index];
      const b = cur[d.index + 1];
      if (!a || !b) return;
      const dir = Math.sign(b.value - a.value) || 1;
      const tension = Math.round(Math.min(1, Math.max(-1, d.t0 + ((e.clientY - d.y) / 50) * dir)) * 100) / 100;
      const copy = cur.slice();
      copy[d.index] = { ...a, tension };
      setLanePoints(lane.id, copy, d.key);
    }
  };

  const remove = (i: number) => {
    if (pts.length <= 1) return;
    setLanePoints(
      lane.id,
      pts.filter((_, k) => k !== i),
      null,
    );
  };

  return (
    <div className="carril">
      <div className="carril-cab">
        <b title={laneName(p, lane)}>{laneName(p, lane)}</b>
        <span className="num">{hover !== null && pts[hover] ? laneValueText(p, lane, pts[hover].value) : ''}</span>
        <button className="btn chico icono" onClick={() => removeLane(lane.id)} aria-label={`Quitar la curva ${laneName(p, lane)}`} title="Quitar curva">
          <Icon name="basura" size={12} />
        </button>
      </div>
      <div
        className="carril-area"
        ref={area}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        title="Clic para agregar un punto, arrastra para moverlo, doble clic para quitarlo. Arrastra el círculo del medio para curvar."
      >
        <svg width={width} height={H} aria-hidden="true">
          {p.sections.map((s) => {
            const x = X(sectionStart(p, s.id) * 16);
            return <line key={s.id} x1={x} x2={x} y1={0} y2={H} className="div" />;
          })}
          <path d={`${path} L${width} ${H} L0 ${H}Z`} className="relleno" />
          <path d={path} className="linea" />
          {pts.slice(0, -1).map((a, i) => {
            const b = pts[i + 1];
            const x = X((a.pos + b.pos) / 2);
            const y = Y(a.value + (b.value - a.value) * bend(0.5, a.tension));
            return Math.abs(X(b.pos) - X(a.pos)) > 18 && a.value !== b.value ? <circle key={`t${i}`} cx={x} cy={y} r={4} className="tension" data-tension={i} /> : null;
          })}
          {pts.map((pt, i) => (
            <rect
              key={i}
              x={X(pt.pos) - 4}
              y={Y(pt.value) - 4}
              width={8}
              height={8}
              rx={2}
              className={`punto${hover === i ? ' hover' : ''}`}
              data-punto={i}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                remove(i);
              }}
            >
              <title>{`Compás ${Math.floor(pt.pos / 16) + 1}.${Math.floor((pt.pos % 16) / 4) + 1}: ${laneValueText(p, lane, pt.value)}`}</title>
            </rect>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Same bend as the engine (automation.rs `shape`). */
function bend(t: number, tension: number): number {
  if (Math.abs(tension) < 0.001) return t;
  const k = tension * 6;
  return (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
}

