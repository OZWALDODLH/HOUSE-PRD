// Piano roll: the notes of a melodic track on a keyboard-by-time grid, with a
// chord strip on top. Click to draw, drag to move, drag the right edge to
// make it longer, double click (or right click) to erase.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { ST } from '../engine/protocol';
import { padOff, padOn } from '../engine/audio';
import { edit, mapTrack, setLength, useStudio } from '../state/store';
import { toast, useUi } from '../state/ui';
import { NOTE_NAMES, SCALES, isChordKind, isMelodic, type Project, type Track } from '../state/model';
import { INSTRUMENT_NAME } from '../state/instruments';
import { PROGRESSIONS, buildChord, chordLabel, chordLongName, diatonicChords, invert, type ChordType } from '../state/chords';
import { addNote, clearStepAt, moveNote, moveStep, notesOf, removeNote, resizeNote, resizeStep, setChord, setStepVel, writeProgression, type RollNote } from '../state/notes';
import { INK, Pict } from './Pict';
import { Icon } from './Icon';
import { Menu } from './Menu';
import { useFrame } from './frame';
import { useWidth } from './useWidth';

const LOW = 24; // Do 1
const HIGH = 96; // Do 7
const ROW = 14;
const BLACK = new Set([1, 3, 6, 8, 10]);
const SNAPS: { steps: number; name: string }[] = [
  { steps: 1, name: '1/16' },
  { steps: 2, name: '1/8' },
  { steps: 4, name: '1/4 (un tiempo)' },
  { steps: 16, name: 'Un compás' },
];

const noteText = (n: number) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

function audition(t: Track, pitch: number) {
  const key = `roll:${t.id}`;
  padOn(t.id, 0.8, key, pitch);
  setTimeout(() => padOff(key), 220);
}

export function PianoRoll() {
  const p = useStudio((s) => s.project);
  const selected = useUi((s) => s.selected);
  const set = useUi((s) => s.set);
  const melodic = p.tracks.filter(isMelodic);
  const t = melodic.find((x) => x.id === selected) ?? melodic[0];
  if (!t) {
    return (
      <div className="vacio-pistas">
        El piano roll edita las notas de bajos y sintes. Agrega uno desde el navegador (por ejemplo “Pad de madrugada” o “Piano FM”) y aquí aparecerán sus notas.
      </div>
    );
  }
  return (
    <div className="piano-roll" style={{ '--c': INK[t.family] } as CSSProperties}>
      <Herramientas p={p} t={t} melodic={melodic} onPick={(id) => set({ selected: id })} />
      <Rollo p={p} t={t} />
    </div>
  );
}

// -------------------------------------------------------------- toolbar --

function Herramientas({ p, t, melodic, onPick }: { p: Project; t: Track; melodic: Track[]; onPick: (id: string) => void }) {
  const chords = isChordKind(t.kind);
  const chordTracks = p.tracks.filter((x) => isChordKind(x.kind) && x.id !== t.id && x.steps.some((s) => s.on && s.notes.length > 1));
  return (
    <div className="pr-barra">
      <Menu
        label={
          <>
            <Pict pict={t.pict} family={t.family} size={16} />
            {t.name}
            <Icon name="abajo" size={12} />
          </>
        }
        title="Qué pista editas"
      >
        {(close) =>
          melodic.map((m) => (
            <button key={m.id} role="menuitemradio" aria-checked={m.id === t.id} className={m.id === t.id ? 'on' : ''} onClick={() => (onPick(m.id), close())}>
              <Pict pict={m.pict} family={m.family} size={16} />
              {m.name} <small>{INSTRUMENT_NAME[m.kind]}</small>
            </button>
          ))
        }
      </Menu>
      <Menu label={<>{t.length / 16 >= 1 ? `${t.length / 16} ${t.length === 16 ? 'compás' : 'compases'}` : `${t.length} pasos`} <Icon name="abajo" size={12} /></>} title="Largo del patrón">
        {(close) =>
          [16, 32, 48, 64].map((n) => (
            <button key={n} role="menuitemradio" aria-checked={t.length === n} className={t.length === n ? 'on' : ''} onClick={() => (setLength(t.id, n), close())}>
              {n / 16} {n === 16 ? 'compás' : 'compases'}
            </button>
          ))
        }
      </Menu>
      <Ajuste />
      <EscalaSolo />
      <div className="espacio" />
      {chords ? (
        <>
          <Menu tour="agregar-acorde" label={<><Icon name="mas" size={14} /> Acorde</>} title="Agregar un acorde de tu tonalidad" align="right" width={320}>
            {(close) => <SelectorAcorde p={p} onPick={(notes) => (addChordAtFreeBar(t, notes), close())} />}
          </Menu>
          <Menu tour="progresiones" label={<>Progresiones <Icon name="abajo" size={12} /></>} title="Cuatro acordes que suenan bien juntos" align="right" width={320}>
            {(close) => (
              <>
                <span className="menu-grupo">En {p.key.scale === 'menor' ? 'tonalidad menor' : 'tonalidad mayor'}</span>
                {PROGRESSIONS[p.key.scale].map((pr) => {
                  const list = pr.degrees.map((d) => buildChord(p.key, d, pr.type ?? 'triada'));
                  return (
                    <button
                      key={pr.name}
                      role="menuitem"
                      className="con-desc"
                      onClick={() => {
                        close();
                        writeProgression(t.id, list);
                        toast(`Progresión “${pr.name}” en ${t.name}. Ctrl+Z para regresar.`, 'bien', 3200);
                      }}
                    >
                      <b>
                        {pr.name}: {list.map((n) => chordLabel(n)).join(', ')}
                      </b>
                      <small>{pr.where}</small>
                    </button>
                  );
                })}
              </>
            )}
          </Menu>
        </>
      ) : (
        chordTracks.length > 0 && (
          <Menu tour="seguir-acordes" label={<>Seguir acordes <Icon name="abajo" size={12} /></>} title="Escribe un bajo que toca la nota principal de cada acorde" align="right" width={300}>
            {(close) =>
              chordTracks.map((c) => (
                <button
                  key={c.id}
                  role="menuitem"
                  onClick={() => {
                    close();
                    bassFromChords(t, c);
                    toast(`${t.name} sigue los acordes de ${c.name}. Ctrl+Z para regresar.`, 'bien', 3200);
                  }}
                >
                  Bajo con las notas de “{c.name}”
                </button>
              ))
            }
          </Menu>
        )
      )}
    </div>
  );
}

function Ajuste() {
  const snap = usePrefs((s) => s.snap);
  return (
    <Menu label={<>Ajuste: {SNAPS.find((x) => x.steps === snap)?.name.split(' ')[0]} <Icon name="abajo" size={12} /></>} title="A qué se pegan las notas al dibujar y mover">
      {(close) =>
        SNAPS.map((s) => (
          <button key={s.steps} role="menuitemradio" aria-checked={snap === s.steps} className={snap === s.steps ? 'on' : ''} onClick={() => (usePrefs.set({ snap: s.steps }), close())}>
            {s.name}
          </button>
        ))
      }
    </Menu>
  );
}

function EscalaSolo() {
  const only = usePrefs((s) => s.scaleOnly);
  return (
    <label className="casilla" title="Así nunca desafinas: las notas se pegan a las de tu tonalidad" data-tour="solo-escala">
      <input type="checkbox" checked={only} onChange={(e) => usePrefs.set({ scaleOnly: e.target.checked })} />
      Solo notas de la escala
    </label>
  );
}

/** Small preferences of the piano roll (not saved in the project). */
interface RollPrefs {
  snap: number;
  scaleOnly: boolean;
}
const prefs: { v: RollPrefs; subs: Set<() => void> } = { v: { snap: 2, scaleOnly: true }, subs: new Set() };
function usePrefs<T>(sel: (p: RollPrefs) => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    prefs.subs.add(f);
    return () => void prefs.subs.delete(f);
  }, []);
  return sel(prefs.v);
}
usePrefs.set = (patch: Partial<RollPrefs>) => {
  prefs.v = { ...prefs.v, ...patch };
  for (const f of prefs.subs) f();
};

// ---------------------------------------------------------------- chords --

function SelectorAcorde({ p, onPick }: { p: Project; onPick: (notes: number[]) => void }) {
  const [type, setType] = useState<ChordType>('triada');
  const list = diatonicChords(p.key, type);
  return (
    <div className="selector-acorde">
      <div className="seg seg-s" role="radiogroup" aria-label="Tipo de acorde">
        {(
          [
            ['triada', 'Normal'],
            ['septima', 'Con séptima'],
            ['sus2', 'Sus2'],
            ['sus4', 'Sus4'],
          ] as [ChordType, string][]
        ).map(([id, text]) => (
          <button key={id} role="radio" aria-checked={type === id} className={type === id ? 'on' : ''} onClick={() => setType(id)}>
            {text}
          </button>
        ))}
      </div>
      {list.map((c) => (
        <button key={c.degree} role="menuitem" className="acorde-op" onClick={() => onPick(c.notes)}>
          <span className="romano">{c.roman}</span>
          <b>{c.label}</b>
          <small>{c.feel}</small>
        </button>
      ))}
    </div>
  );
}

function addChordAtFreeBar(t: Track, notes: number[]) {
  // The first bar whose downbeat is free, else the first bar.
  let at = 0;
  for (let b = 0; b < t.length / 16; b++) {
    if (!t.steps[b * 16].on) {
      at = b * 16;
      break;
    }
  }
  setChord(t.id, at, notes, 16);
}

function bassFromChords(bass: Track, chords: Track) {
  edit(null, (p) =>
    mapTrack(p, bass.id, (t) => {
      const steps = t.steps.map((s) => ({ ...s, on: false, notes: [] as number[], lens: undefined }));
      chords.steps.slice(0, chords.length).forEach((s, i) => {
        if (!s.on || s.notes.length < 2) return;
        const root = Math.min(...s.notes);
        const low = 36 + (((root % 12) + 12) % 12);
        steps[i] = { ...steps[i], on: true, vel: 0.9, len: Math.max(1, s.len - 1), notes: [low] };
      });
      return { ...t, steps, length: chords.length };
    }),
  );
}

// ----------------------------------------------------------------- roll --

type Drag =
  | { kind: 'mover'; note: RollNote; dx: number; key: string; last: { step: number; pitch: number } }
  | { kind: 'alargar'; note: RollNote; key: string }
  | { kind: 'acorde'; step: number; len: number; offset: number; key: string; last: number }
  | { kind: 'acorde-largo'; step: number; key: string }
  | { kind: 'fuerza'; key: string };

function Rollo({ p, t }: { p: Project; t: Track }) {
  const snap = usePrefs((s) => s.snap);
  const scaleOnly = usePrefs((s) => s.scaleOnly);
  const grid = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const width = useWidth(grid) || 800;
  const steps = t.length;
  const colW = width / steps;
  const notes = useMemo(() => notesOf(t), [t]);
  const [sel, setSel] = useState<{ step: number; pitch: number } | null>(null);
  const [chordMenu, setChordMenu] = useState<{ step: number; x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const lastDown = useRef<{ id: string; at: number } | null>(null);
  const chords = isChordKind(t.kind);
  const scale = SCALES[p.key.scale];
  const inKey = (n: number) => scale.includes((((n - p.key.root) % 12) + 12) % 12);
  const rows = HIGH - LOW + 1;

  // Show the notes (or the middle) when the track changes.
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const ps = notesOf(t).map((n) => n.pitch);
    const mid = ps.length ? (Math.min(...ps) + Math.max(...ps)) / 2 : 60;
    el.scrollTop = (HIGH - mid) * ROW - el.clientHeight / 2;
  }, [t.id]);

  useFrame((s) => {
    const el = head.current;
    if (!el) return;
    const on = s[ST.PLAYING] > 0.5;
    el.style.display = on ? '' : 'none';
    if (on) el.style.transform = `translateX(${(((s[ST.STEP] % steps) + s[ST.STEP_FRACTION]) / steps) * width}px)`;
  });

  const snapPitch = (n: number) => {
    if (!scaleOnly || inKey(n)) return n;
    return inKey(n + 1) ? n + 1 : n - 1;
  };
  const at = (e: PointerEvent) => {
    const r = grid.current!.getBoundingClientRect();
    const x = Math.min(width - 1, Math.max(0, e.clientX - r.left));
    const y = e.clientY - r.top;
    const raw = x / colW;
    const step = Math.min(steps - 1, Math.floor(raw / snap) * snap);
    const pitch = Math.min(HIGH, Math.max(LOW, HIGH - Math.floor(y / ROW)));
    return { step, pitch, raw };
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    const key = `roll:${t.id}:${performance.now()}`;
    const noteEl = el.closest<HTMLElement>('.pr-nota');
    e.preventDefault();
    grid.current?.focus({ preventScroll: true });
    grid.current?.setPointerCapture(e.pointerId);
    if (noteEl) {
      const n: RollNote = { step: Number(noteEl.dataset.step), pitch: Number(noteEl.dataset.pitch), len: Number(noteEl.dataset.len), vel: 0.8 };
      // Double click erases (pointer capture keeps dblclick from reaching the note).
      const id = `${n.step}:${n.pitch}`;
      const now = performance.now();
      if (lastDown.current?.id === id && now - lastDown.current.at < 350) {
        lastDown.current = null;
        erase(n);
        return;
      }
      lastDown.current = { id, at: now };
      setSel({ step: n.step, pitch: n.pitch });
      if (el.classList.contains('borde')) drag.current = { kind: 'alargar', note: n, key };
      else {
        const { raw } = at(e);
        drag.current = { kind: 'mover', note: n, dx: raw - n.step, key, last: { step: n.step, pitch: n.pitch } };
      }
      audition(t, n.pitch);
      return;
    }
    const { step, pitch } = at(e);
    const pc = snapPitch(pitch);
    if (scaleOnly && !inKey(pc)) return;
    const len = Math.max(1, snap);
    if (addNote(t.id, step, pc, len, key) === 'lleno') {
      toast('Un paso tiene máximo 4 notas. Pon esta nota en otro lugar.', 'info');
      return;
    }
    audition(t, pc);
    setSel({ step, pitch: pc });
    drag.current = { kind: 'alargar', note: { step, pitch: pc, len, vel: 0.8 }, key };
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'alargar') {
      const { raw } = at(e);
      const end = Math.max(d.note.step + 1, Math.ceil((raw + 0.001) / snap) * snap);
      resizeNote(t.id, d.note.step, d.note.pitch, Math.min(steps - d.note.step, end - d.note.step), d.key);
    } else if (d.kind === 'mover') {
      const { raw, pitch } = at(e);
      const step = Math.min(steps - 1, Math.max(0, Math.round((raw - d.dx) / snap) * snap));
      const pc = snapPitch(pitch);
      if (step === d.last.step && pc === d.last.pitch) return;
      if (moveNote(t.id, d.last, { step, pitch: pc }, d.key)) {
        if (pc !== d.last.pitch) audition(t, pc);
        d.last = { step, pitch: pc };
        setSel({ step, pitch: pc });
      }
    }
  };
  const up = () => {
    drag.current = null;
  };

  const erase = (n: { step: number; pitch: number }) => {
    removeNote(t.id, n.step, n.pitch);
    setSel(null);
  };

  // Keyboard: Delete erases the selected note; arrows move it.
  const onKey = (e: KeyboardEvent) => {
    if (!sel) return;
    if (e.key === 'Delete' || e.key === 'Backspace') erase(sel);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const pitch = snapPitch(sel.pitch + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1));
      if (moveNote(t.id, sel, { step: sel.step, pitch })) setSel({ ...sel, pitch });
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const step = Math.min(steps - 1, Math.max(0, sel.step + (e.key === 'ArrowRight' ? snap : -snap)));
      if (moveNote(t.id, sel, { step, pitch: sel.pitch })) setSel({ ...sel, step });
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!chordMenu) return;
    const out = (e: globalThis.PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.pr-flota')) setChordMenu(null);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setChordMenu(null);
      }
    };
    const id = setTimeout(() => document.addEventListener('pointerdown', out), 0);
    window.addEventListener('keydown', esc, true);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', out);
      window.removeEventListener('keydown', esc, true);
    };
  }, [chordMenu]);

  const blocks = t.steps.slice(0, steps).flatMap((s, i) => (s.on && s.notes.length > 1 ? [{ step: i, len: Math.min(s.len, steps - i), notes: s.notes }] : []));

  // ------------------------------------------------------ chord strip --
  const stripDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const step = Math.min(steps - 1, Math.floor(x / colW / snap) * snap);
    const el = e.target as HTMLElement;
    // The chord's own menu handles its clicks.
    if (el.closest('.pr-acorde-mas, .menu')) return;
    const b = el.closest<HTMLElement>('.pr-acorde');
    const key = `acorde:${t.id}:${performance.now()}`;
    if (b) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const s0 = Number(b.dataset.step);
      if (el.classList.contains('borde')) drag.current = { kind: 'acorde-largo', step: s0, key };
      else drag.current = { kind: 'acorde', step: s0, len: Number(b.dataset.len), offset: x / colW - s0, key, last: s0 };
      return;
    }
    setChordMenu({ step, x: e.clientX, y: r.bottom });
  };
  const stripMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / colW;
    if (d.kind === 'acorde') {
      const to = Math.min(steps - 1, Math.max(0, Math.round((x - d.offset) / snap) * snap));
      if (to !== d.last && !t.steps[to].on) {
        moveStep(t.id, d.last, to, d.key);
        d.last = to;
      }
    } else if (d.kind === 'acorde-largo') {
      const end = Math.max(d.step + 1, Math.ceil(x / snap) * snap);
      resizeStep(t.id, d.step, Math.min(steps - d.step, end - d.step), d.key);
    }
  };

  const rowsBg = useMemo(() => {
    // One band per row: black keys darker, out-of-key rows dimmer.
    const stops: string[] = [];
    for (let i = 0; i < rows; i++) {
      const n = HIGH - i;
      const col = BLACK.has(n % 12) ? 'var(--pr-negra)' : 'var(--pr-blanca)';
      const c = scaleOnly && !inKey(n) ? 'var(--pr-fuera)' : col;
      stops.push(`${c} ${i * ROW}px ${(i + 1) * ROW}px`);
    }
    return `linear-gradient(${stops.join(',')})`;
  }, [scaleOnly, p.key.root, p.key.scale]);

  const beats = Array.from({ length: steps / 4 + 1 }, (_, i) => i);

  return (
    <div className="pr-cuerpo" onKeyDown={onKey}>
      {chords && (
        <div className="pr-tira">
          <div className="pr-tira-et">Acordes</div>
          <div className="pr-tira-area" onPointerDown={stripDown} onPointerMove={stripMove} onPointerUp={up} onPointerCancel={up} data-tour="tira-acordes" title="Clic en un espacio para poner un acorde. Arrastra un acorde para moverlo.">
            {blocks.map((b) => (
              <div
                key={b.step}
                className="pr-acorde"
                data-step={b.step}
                data-len={b.len}
                style={{ left: `${(b.step / steps) * 100}%`, width: `${(b.len / steps) * 100}%` }}
                title={chordLongName(b.notes) ?? 'Acorde'}
              >
                <b>{chordLabel(b.notes) ?? '?'}</b>
                <MenuAcorde p={p} t={t} step={b.step} notes={b.notes} len={b.len} />
                <i className="borde" aria-hidden="true" />
              </div>
            ))}
            {!blocks.length && <span className="pr-tira-vacia">Clic aquí para poner tu primer acorde, o usa “Progresiones”.</span>}
            {chordMenu && (
              <div
                className="menu pr-flota"
                role="menu"
                style={{ position: 'fixed', left: Math.max(8, Math.min(chordMenu.x - 20, window.innerWidth - 328)), top: chordMenu.y + 2, maxHeight: window.innerHeight - chordMenu.y - 12 }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <SelectorAcorde
                  p={p}
                  onPick={(n) => {
                    setChord(t.id, chordMenu.step, n, Math.max(4, Math.min(16, steps - chordMenu.step)));
                    audition(t, n[0]);
                    setChordMenu(null);
                  }}
                />
                <button className="btn chico" onClick={() => setChordMenu(null)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="pr-scroll" ref={scroll}>
        <div className="pr-teclas" style={{ height: rows * ROW }}>
          {Array.from({ length: rows }, (_, i) => {
            const n = HIGH - i;
            return (
              <button
                key={n}
                className={`pr-tecla${BLACK.has(n % 12) ? ' negra' : ''}${inKey(n) ? ' en-escala' : ''}`}
                style={{ top: i * ROW, height: ROW }}
                onPointerDown={() => audition(t, n)}
                tabIndex={-1}
                aria-label={noteText(n)}
              >
                {n % 12 === 0 || (inKey(n) && n % 12 === p.key.root) ? noteText(n) : ''}
              </button>
            );
          })}
        </div>
        <div
          className="pr-rejilla"
          ref={grid}
          tabIndex={0}
          aria-label={`Notas de ${t.name}`}
          style={{ height: rows * ROW, backgroundImage: rowsBg }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>('.pr-nota');
            if (!el) return;
            e.preventDefault();
            erase({ step: Number(el.dataset.step), pitch: Number(el.dataset.pitch) });
          }}
          data-tour="rejilla-notas"
        >
          {beats.map((b) => (
            <i key={b} className={`pr-linea${b % 4 === 0 ? ' compas' : ''}`} style={{ left: `${((b * 4) / steps) * 100}%` }} />
          ))}
          {notes.map((n) => {
            const s = sel && sel.step === n.step && sel.pitch === n.pitch;
            return (
              <div
                key={`${n.step}-${n.pitch}`}
                className={`pr-nota${s ? ' sel' : ''}`}
                data-step={n.step}
                data-pitch={n.pitch}
                data-len={n.len}
                style={{ left: n.step * colW, width: Math.max(4, Math.min(n.len, steps - n.step) * colW - 1), top: (HIGH - n.pitch) * ROW + 1, height: ROW - 2, opacity: 0.55 + n.vel * 0.45 }}
                title={`${noteText(n.pitch)}, ${n.len} ${n.len === 1 ? 'paso' : 'pasos'}. Doble clic o clic derecho para borrarla.`}
              >
                {n.len * colW > 34 && <span>{noteText(n.pitch)}</span>}
                <i className="borde" aria-hidden="true" />
              </div>
            );
          })}
          <div className="pr-cabezal" ref={head} aria-hidden="true" />
        </div>
      </div>
      <Fuerza t={t} steps={steps} />
    </div>
  );
}

function MenuAcorde({ p, t, step, notes, len }: { p: Project; t: Track; step: number; notes: number[]; len: number }) {
  return (
    <Menu className="pr-acorde-mas" label={<Icon name="abajo" size={10} />} title="Cambiar este acorde" width={320}>
      {(close) => (
        <>
          <span className="menu-grupo">Cambiar por</span>
          <SelectorAcorde p={p} onPick={(n) => (setChord(t.id, step, n, len), audition(t, n[0]), close())} />
          <hr />
          <button role="menuitem" onClick={() => (setChord(t.id, step, invert(notes, 1), len), close())}>
            Inversión hacia arriba
          </button>
          <button role="menuitem" onClick={() => (setChord(t.id, step, invert(notes, -1), len), close())}>
            Inversión hacia abajo
          </button>
          <button role="menuitem" onClick={() => (setChord(t.id, step, notes.map((n) => n + 12), len), close())}>
            Una octava arriba
          </button>
          <button role="menuitem" onClick={() => (setChord(t.id, step, notes.map((n) => n - 12), len), close())}>
            Una octava abajo
          </button>
          <button
            role="menuitem"
            disabled={step + 16 >= t.length || t.steps[step + 16]?.on}
            onClick={() => (setChord(t.id, step + 16, notes, len), close())}
          >
            Copiar al siguiente compás
          </button>
          <hr />
          <button role="menuitem" onClick={() => (clearStepAt(t.id, step), close())}>
            Borrar acorde
          </button>
        </>
      )}
    </Menu>
  );
}

/** Velocity (fuerza) of each step: drag the bars up or down. */
function Fuerza({ t, steps }: { t: Track; steps: number }) {
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const setAt = (e: PointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    const i = Math.min(steps - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * steps)));
    const v = 1 - (e.clientY - r.top) / r.height;
    if (t.steps[i]?.on) setStepVel(t.id, i, v, drag.current);
  };
  return (
    <div className="pr-fuerza" data-tour="fuerza">
      <div className="pr-tira-et">Fuerza</div>
      <div
        className="pr-fuerza-area"
        ref={area}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          area.current?.setPointerCapture(e.pointerId);
          drag.current = `fuerza:${t.id}:${performance.now()}`;
          setAt(e);
        }}
        onPointerMove={(e) => drag.current && setAt(e)}
        onPointerUp={() => (drag.current = null)}
        title="Arrastra para que cada nota pegue más fuerte o más suave"
      >
        {t.steps.slice(0, steps).map((s, i) =>
          s.on ? <i key={i} style={{ left: `${(i / steps) * 100}%`, height: `${s.vel * 100}%` }} /> : null,
        )}
      </div>
    </div>
  );
}

