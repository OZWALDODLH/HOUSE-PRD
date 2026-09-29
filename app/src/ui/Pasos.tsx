// The step sequencer (channel rack): a header with the beats and pages, and
// one row per track with its steps (or notes), mute, solo and volume.
import { useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type RefObject } from 'react';
import { ST } from '../engine/protocol';
import { useLive } from '../engine/live';
import {
  addTrack,
  setStep,
  setStepOn,
  setTrack,
  shiftStepNotes,
  toggleSectionTrack,
  useStudio,
} from '../state/store';
import { useUi, toast } from '../state/ui';
import { isMelodic, noteName, type Project, type Section, type Track } from '../state/model';
import { soundById } from '../state/instruments';
import { INK, Pict } from './Pict';
import { Icon } from './Icon';
import { Fader } from './controls';
import { useFrame } from './frame';
import { dropOnTrack, librarySampleToTrack } from './Navegador';

export const pageCount = (p: Project): number => Math.max(1, ...p.tracks.map((t) => Math.ceil(t.length / 16)));

// ------------------------------------------------------------- cabecera --

export function Cabecera() {
  const p = useStudio((s) => s.project);
  const { page, selectedSection, set, follow } = useUi();
  const pages = pageCount(p);
  const livePage = useLive((s) => (s[ST.PLAYING] > 0.5 ? Math.floor((s[ST.STEP] % (pages * 16)) / 16) : -1));
  const liveSection = useLive((s) => (s[ST.MODE] > 0.5 && s[ST.PLAYING] > 0.5 ? s[ST.SECTION] : -1));
  const section = p.mode === 'cancion' ? (p.sections.find((s) => s.id === selectedSection) ?? p.sections[liveSection]) : undefined;
  const shown = follow && livePage >= 0 ? livePage : Math.min(page, pages - 1);
  return (
    <div className="cabecera">
      <div className="izq">
        <b>{section ? section.name : 'Patrón'}</b>
        <span className="duracion num" title={section ? 'Las pistas con ✓ suenan en esta sección' : 'Largo del patrón'}>
          {section ? `${section.bars} compases` : `${pages} ${pages === 1 ? 'compás' : 'compases'}`}
        </span>
      </div>
      <div className="tiempos" aria-hidden="true">
        {[1, 2, 3, 4].map((t) => (
          <div key={t}>
            <span>{pages > 1 ? `${shown + 1}.${t}` : t}</span>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
      <div className="der">
        {pages > 1 && (
          <div className="paginas" role="group" aria-label="Compás que ves">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                className={`pag${i === shown ? ' on' : ''}${i === livePage ? ' suena' : ''}`}
                aria-pressed={i === shown}
                aria-label={`Compás ${i + 1}`}
                onClick={() => set({ page: i, follow: livePage < 0 || i === livePage })}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ pistas --

export function Pistas() {
  const p = useStudio((s) => s.project);
  const { selected, page, follow, selectedSection } = useUi();
  const pages = pageCount(p);
  const livePage = useLive((s) => (s[ST.PLAYING] > 0.5 ? Math.floor((s[ST.STEP] % (pages * 16)) / 16) : -1));
  const shown = follow && livePage >= 0 ? livePage : Math.min(page, pages - 1);
  const liveSection = useLive((s) => (s[ST.MODE] > 0.5 && s[ST.PLAYING] > 0.5 ? s[ST.SECTION] : -1));
  const song = p.mode === 'cancion';
  const section = song ? (p.sections.find((s) => s.id === selectedSection) ?? p.sections[liveSection]) : undefined;
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    setOver(false);
    const sample = e.dataTransfer.getData('text/house-sample');
    if (sample) {
      e.preventDefault();
      void librarySampleToTrack(sample);
      return;
    }
    const s = soundById(e.dataTransfer.getData('text/house-sound'));
    if (!s) return;
    e.preventDefault();
    const tid = addTrack(s);
    if (!tid) toast('Ya tienes 32 pistas. Borra una para agregar otra.', 'error');
    else useUi.getState().set({ selected: tid });
  };

  return (
    <section
      className={`pistas${over ? ' soltar' : ''}`}
      aria-label="Pistas del patrón"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/house-sound') || e.dataTransfer.types.includes('text/house-sample')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      data-tour="pistas"
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {p.tracks.map((t, i) => (
        <Fila key={t.id} t={t} index={i} page={shown} selected={selected === t.id} section={section} />
      ))}
      {!p.tracks.length && (
        <div className="vacio-pistas">
          <b>Tu proyecto está en blanco.</b> Arrastra aquí un sonido del navegador (o haz doble clic en uno), suelta un archivo de audio o graba tu voz.
        </div>
      )}
    </section>
  );
}

interface FilaProps {
  t: Track;
  index: number;
  page: number;
  selected: boolean;
  section?: Section;
}

function Fila({ t, index, page, selected, section }: FilaProps) {
  const set = useUi((s) => s.set);
  const inSection = section ? section.tracks.includes(t.id) : true;
  const [editing, setEditing] = useState(false);
  const repeats = page * 16 >= t.length;
  const [over, setOver] = useState(false);
  return (
    <div
      className={`pista${selected ? ' sel' : ''}${section && !inSection ? ' fuera' : ''}${over ? ' soltar' : ''}`}
      style={{ '--c': INK[t.family] } as CSSProperties}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/house-fx') || e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (dropOnTrack(t.id, e.dataTransfer)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <button className="nombre" onClick={() => set({ selected: t.id })} onDoubleClick={() => setEditing(true)} aria-pressed={selected} title="Doble clic para cambiar el nombre">
        <Pict pict={t.pict} family={t.family} />
        <div>
          {editing ? (
            <input
              className="campo-texto"
              style={{ height: 22, width: '100%' }}
              autoFocus
              defaultValue={t.name}
              maxLength={24}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                setTrack(t.id, { name: e.currentTarget.value.trim() || t.name }, null);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <b>{t.name}</b>
          )}
          <small>{t.desc}</small>
        </div>
      </button>
      {isMelodic(t) ? <Rollo t={t} index={index} page={page} repeats={repeats} /> : <Pasos t={t} index={index} page={page} repeats={repeats} />}
      <div className="controles">
        {section && (
          <button
            className={`ms en-sec${inSection ? ' on' : ''}`}
            aria-pressed={inSection}
            onClick={() => toggleSectionTrack(section.id, t.id)}
            title={inSection ? `Suena en ${section.name}. Clic para quitarla.` : `No suena en ${section.name}. Clic para agregarla.`}
          >
            <Icon name={inSection ? 'listo' : 'cerrar'} size={14} />
          </button>
        )}
        <button className={`ms${t.mute ? ' on' : ''}`} aria-pressed={t.mute} onClick={() => setTrack(t.id, { mute: !t.mute }, null)} title="Silenciar (mute)">
          M
        </button>
        <button className={`ms${t.solo ? ' on' : ''}`} aria-pressed={t.solo} onClick={() => setTrack(t.id, { solo: !t.solo }, null)} title="Solo">
          S
        </button>
        <Fader label={`Volumen de ${t.name}`} db={t.vol} onChange={(vol) => setTrack(t.id, { vol })} ink={INK[t.family]} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------- pasos --

/**
 * Marks the step that sounds with a frame that moves over the row on its own
 * layer: the row itself never repaints while the music plays.
 */
function usePlayhead(t: Track, page: number, container: RefObject<HTMLElement | null>, cursor: RefObject<HTMLElement | null>, selector: string) {
  const last = useRef(-2);
  useFrame((s) => {
    const el = container.current;
    const c = cursor.current;
    if (!el || !c) return;
    let k = -1;
    if (s[ST.PLAYING] > 0.5) {
      const now = (s[ST.STEP] % t.length) - ((page * 16) % t.length);
      if (now >= 0 && now < 16) k = now;
    }
    if (k === last.current) return;
    last.current = k;
    const cell = k >= 0 ? el.querySelectorAll<HTMLElement>(selector)[k] : undefined;
    if (!cell) {
      c.style.display = 'none';
      return;
    }
    c.style.display = '';
    c.style.width = `${cell.offsetWidth}px`;
    c.style.height = `${cell.offsetHeight}px`;
    c.style.transform = `translate(${cell.offsetLeft}px, ${cell.offsetTop}px)`;
  });
}

function Pasos({ t, index, page, repeats }: { t: Track; index: number; page: number; repeats: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const paint = useRef<{ on: boolean; key: string; last: number } | null>(null);
  const pro = useUi((s) => s.pro);
  const cursor = useRef<HTMLElement>(null);
  usePlayhead(t, page, ref, cursor, '.paso');
  const base = (page * 16) % t.length;
  const stepAt = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const k = el?.dataset?.k;
    return k === undefined || el?.closest('.pasos') !== ref.current ? -1 : Number(k);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const k = stepAt(e);
    if (k < 0) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    const i = base + k;
    const on = !t.steps[i].on;
    const key = `paint:${t.id}:${performance.now()}`;
    paint.current = { on, key, last: k };
    setStepOn(t.id, i, on, key);
    useUi.getState().set({ selected: t.id });
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const pt = paint.current;
    if (!pt) return;
    const k = stepAt(e);
    if (k < 0 || k === pt.last) return;
    pt.last = k;
    setStepOn(t.id, base + k, pt.on, pt.key);
  };
  const up = () => {
    paint.current = null;
  };
  const wheel = (k: number, dy: number) => {
    const s = t.steps[base + k];
    if (!s.on) return;
    const vel = Math.round(Math.min(1, Math.max(0.1, s.vel + (dy < 0 ? 0.1 : -0.1))) * 100) / 100;
    setStep(t.id, base + k, { vel });
  };
  return (
    <div
      ref={ref}
      className={`pasos${repeats ? ' repite' : ''}`}
      style={{ '--c': INK[t.family] } as CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="group"
      aria-label={`Pasos de ${t.name}`}
      title={repeats ? `Este patrón dura ${t.length / 16} compás y se repite.` : undefined}
      data-track={index}
    >
      {[0, 1, 2, 3].map((g) => (
        <div key={g} className={`grupo${g % 2 ? ' b' : ''}`}>
          {[0, 1, 2, 3].map((j) => {
            const k = g * 4 + j;
            const s = t.steps[base + k];
            const outside = base + k >= t.length;
            return (
              <button
                key={k}
                data-k={k}
                className={`paso${s.on && !outside ? ' on suave' : ''}${s.accent && s.on ? ' acento' : ''}`}
                style={{ '--v': s.vel } as CSSProperties}
                aria-label={`Paso ${base + k + 1}${s.on ? ', encendido' : ''}`}
                aria-pressed={s.on}
                disabled={outside}
                onWheel={pro ? (e) => wheel(k, e.deltaY) : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setStepOn(t.id, base + k, !s.on);
                  }
                }}
              />
            );
          })}
        </div>
      ))}
      <i className="cursor-paso" ref={cursor} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
}

// ------------------------------------------------------------- rollo --

function Rollo({ t, index, page, repeats }: { t: Track; index: number; page: number; repeats: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; y: number; moved: boolean; key: string; applied: number } | null>(null);
  const pro = useUi((s) => s.pro);
  const cursor = useRef<HTMLElement>(null);
  usePlayhead(t, page, ref, cursor, '.col');
  const base = (page * 16) % t.length;
  // Pitch range of the whole track, so the notes keep their height between pages.
  const all = t.steps.slice(0, t.length).flatMap((s) => (s.on ? s.notes : []));
  const lo = all.length ? Math.min(...all) : 48;
  const hi = all.length ? Math.max(...all) : 60;
  const span = Math.max(12, hi - lo);
  const mid = (lo + hi) / 2;
  const y = (n: number) => 3 + ((n - (mid - span / 2)) / span) * 23;

  const notes: { k: number; n: number; len: number; slide: boolean; accent: boolean }[] = [];
  for (let k = 0; k < 16; k++) {
    const i = base + k;
    const s = t.steps[i];
    if (!s || !s.on || i >= t.length) continue;
    for (const n of s.notes) notes.push({ k, n, len: Math.min(s.len, 16 - k), slide: s.slide, accent: s.accent });
  }

  const colAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(15, Math.max(0, Math.floor(((clientX - r.left) / r.width) * 16)));
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    useUi.getState().set({ selected: t.id });
    const target = e.target as HTMLElement;
    const k = target.dataset.k !== undefined ? Number(target.dataset.k) : colAt(e.clientX);
    const i = base + k;
    if (i >= t.length) return;
    const s = t.steps[i];
    if (target.classList.contains('nota') && pro && (e.shiftKey || e.altKey)) {
      setStep(t.id, i, e.shiftKey ? { accent: !s.accent } : { slide: !s.slide }, null);
      return;
    }
    if (!target.classList.contains('nota')) {
      // Empty place: a new note (or chord) that fits the key.
      if (!s.on) setStepOn(t.id, i, true);
      return;
    }
    ref.current?.setPointerCapture(e.pointerId);
    drag.current = { i, y: e.clientY, moved: false, key: `notes:${t.id}:${i}:${performance.now()}`, applied: 0 };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const steps = Math.round((d.y - e.clientY) / 7);
    if (Math.abs(d.y - e.clientY) > 3) d.moved = true;
    if (steps !== d.applied) {
      shiftStepNotes(t.id, d.i, steps - d.applied);
      d.applied = steps;
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setStepOn(t.id, d.i, false);
  };

  return (
    <div
      ref={ref}
      className={`rollo${repeats ? ' repite' : ''}`}
      style={{ '--c': INK[t.family] } as CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="group"
      aria-label={`Notas de ${t.name}. Clic para poner o quitar una nota; arrastra una nota para cambiarla.`}
      title={repeats ? `Este patrón dura ${t.length / 16} compás y se repite.` : undefined}
      data-track={index}
    >
      {Array.from({ length: 16 }, (_, k) => (
        <i key={k} className="col" data-k={k} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(k / 16) * 100}%`, width: `${100 / 16}%` }} />
      ))}
      {notes.map((x, j) => (
        <i
          key={j}
          data-k={x.k}
          className={`nota${x.slide ? ' slide' : ''}${x.accent ? ' acento' : ''}`}
          style={{ left: `calc(${(x.k / 16) * 100}% + 2px)`, width: `calc(${(x.len / 16) * 100}% - 4px)`, bottom: `${y(x.n)}px` }}
          title={`${noteName(x.n)}${x.slide ? ', con slide' : ''}${x.accent ? ', con acento' : ''}`}
          onWheel={(e) => shiftStepNotes(t.id, base + x.k, e.deltaY < 0 ? 1 : -1)}
        />
      ))}
      <i className="cursor-paso" ref={cursor} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
}
