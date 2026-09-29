// The audio editor: pick your favorite part of a recording or a file.
// Drag the handles (or the whole selection), zoom with the wheel, listen to
// the part, then use it in a pad, cut it into pads or keep it in Mis samples.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { applySelection, chopSelection, closeAudioEditor, previewAudio, saveSelectionToLibrary, setEdit, soundRegion, stopPreview, useAudioEdit, type AudioSource } from '../state/audioEdit';
import { trackById, useStudio } from '../state/store';
import { closeDialog } from '../state/ui';
import { keyLabel } from '../input/keys';
import { INK } from './Pict';
import { Icon } from './Icon';
import { Menu } from './Menu';
import { Seg } from './controls';
import { useWidth } from './useWidth';

// ------------------------------------------------------------------ peaks --

interface Peaks {
  block: number;
  min: Float32Array;
  max: Float32Array;
}

const BLOCK = 256;
const peaksCache = new WeakMap<Float32Array, Peaks>();

/** Min and max of every block of 256 samples, computed once per audio. */
function peaksOf(data: Float32Array): Peaks {
  const hit = peaksCache.get(data);
  if (hit) return hit;
  const n = Math.ceil(data.length / BLOCK);
  const min = new Float32Array(n);
  const max = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let lo = 1;
    let hi = -1;
    const end = Math.min(data.length, (b + 1) * BLOCK);
    for (let i = b * BLOCK; i < end; i++) {
      const v = data[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[b] = lo;
    max[b] = hi;
  }
  const p = { block: BLOCK, min, max };
  peaksCache.set(data, p);
  return p;
}

/** Draws samples [a, b) of the audio across the whole canvas. */
function drawWave(c: HTMLCanvasElement, data: Float32Array, a: number, b: number, color: string): void {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const g = c.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  g.fillStyle = color;
  const peaks = peaksOf(data);
  const spp = (b - a) / w;
  const mid = h / 2;
  for (let x = 0; x < w; x++) {
    const s0 = a + x * spp;
    const s1 = s0 + Math.max(1, spp);
    let lo = 0;
    let hi = 0;
    if (spp >= peaks.block) {
      const b0 = Math.floor(s0 / peaks.block);
      const b1 = Math.min(peaks.min.length, Math.ceil(s1 / peaks.block));
      for (let k = b0; k < b1; k++) {
        if (peaks.min[k] < lo) lo = peaks.min[k];
        if (peaks.max[k] > hi) hi = peaks.max[k];
      }
    } else {
      const i1 = Math.min(data.length, Math.ceil(s1));
      for (let i = Math.max(0, Math.floor(s0)); i < i1; i++) {
        if (data[i] < lo) lo = data[i];
        if (data[i] > hi) hi = data[i];
      }
    }
    const top = mid - hi * mid * 0.95;
    const bottom = mid - lo * mid * 0.95;
    g.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
}

const cssVar = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim() || '#EEE8DE';

/** "0:01.25" */
function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// ----------------------------------------------------------------- editor --

type Drag = { kind: 'ini' | 'fin' } | { kind: 'mover'; offset: number; len: number } | { kind: 'nueva'; anchor: number } | { kind: 'ventana'; offset: number };

export function EditorAudio() {
  const source = useAudioEdit((s) => s.source);
  if (!source) return null;
  return <Editor source={source} />;
}

function Editor({ source }: { source: AudioSource }) {
  const { target, start, end, smooth, reverse } = useAudioEdit();
  const p = useStudio((s) => s.project);
  const secs = source.data.length / source.sr;
  const minLen = Math.min(1, (0.01 * source.sr) / Math.max(1, source.data.length));
  const [view, setView] = useState<[number, number]>([0, 1]);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const map = useRef<HTMLCanvasElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const play = useRef<{ raf: number } | null>(null);
  const width = useWidth(area);
  const mapWidth = useWidth(mapBox);
  const ink = INK[source.family];
  const dialog = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Focus the dialog; keys are ours while it is open.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('.ea-onda')?.focus();
    return () => {
      stopPreview();
      prev?.focus?.();
    };
  }, []);

  useLayoutEffect(() => {
    if (wave.current) drawWave(wave.current, source.data, view[0] * source.data.length, view[1] * source.data.length, cssVar(wave.current, '--c'));
  }, [source, view, width]);
  useLayoutEffect(() => {
    if (map.current) drawWave(map.current, source.data, 0, source.data.length, cssVar(map.current, '--tinta-3'));
  }, [source, mapWidth]);

  const stop = () => {
    stopPreview();
    if (play.current) cancelAnimationFrame(play.current.raf);
    play.current = null;
    if (head.current) head.current.style.display = 'none';
  };
  useEffect(() => stop, []);

  const listen = (from: number, to: number) => {
    stop();
    const got = previewAudio(source.data, source.sr, from, to, reverse);
    if (!got) return;
    const tick = () => {
      const t = (performance.now() - got.at) / 1000 / got.secs;
      if (t >= 1) {
        stop();
        return;
      }
      const f = reverse ? to - (to - from) * t : from + (to - from) * t;
      const el = head.current;
      if (el) {
        const [v0, v1] = viewRef.current;
        el.style.display = f >= v0 && f <= v1 ? '' : 'none';
        el.style.left = `${((f - v0) / (v1 - v0)) * 100}%`;
      }
      play.current = { raf: requestAnimationFrame(tick) };
    };
    play.current = { raf: requestAnimationFrame(tick) };
  };
  const playing = () => play.current !== null;

  // ----------------------------------------------------------- pointer --

  const fracAt = (clientX: number): number => {
    const r = area.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return view[0] + x * (view[1] - view[0]);
  };
  const setSel = (a: number, b: number) => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(1, Math.max(a, b));
    setEdit({ start: lo, end: Math.max(hi, Math.min(1, lo + minLen)) });
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    area.current?.focus();
    area.current?.setPointerCapture(e.pointerId);
    const el = e.target as HTMLElement;
    const f = fracAt(e.clientX);
    if (el.dataset.asa === 'ini' || el.dataset.asa === 'fin') drag.current = { kind: el.dataset.asa };
    else if (f > start && f < end) drag.current = { kind: 'mover', offset: f - start, len: end - start };
    else {
      drag.current = { kind: 'nueva', anchor: f };
      setSel(f, f + minLen);
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const f = fracAt(e.clientX);
    if (d.kind === 'ini') setEdit({ start: Math.max(0, Math.min(f, end - minLen)) });
    else if (d.kind === 'fin') setEdit({ end: Math.min(1, Math.max(f, start + minLen)) });
    else if (d.kind === 'mover') {
      const a = Math.min(1 - d.len, Math.max(0, f - d.offset));
      setEdit({ start: a, end: a + d.len });
    } else if (d.kind === 'nueva') setSel(d.anchor, f);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    // Listening right after a change is how people check the cut.
    if (d && d.kind !== 'ventana') listen(useAudioEdit.getState().start, useAudioEdit.getState().end);
  };

  const zoom = (factor: number, at = (start + end) / 2) => {
    const [v0, v1] = view;
    const span = Math.min(1, Math.max(minLen * 4, (v1 - v0) * factor));
    const k = (at - v0) / (v1 - v0);
    let a = at - span * k;
    a = Math.min(1 - span, Math.max(0, a));
    setView([a, a + span]);
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      const span = view[1] - view[0];
      const d = ((e.shiftKey ? e.deltaY : e.deltaX) / 400) * span;
      const a = Math.min(1 - span, Math.max(0, view[0] + d));
      setView([a, a + span]);
    } else zoom(e.deltaY < 0 ? 0.8 : 1.25, fracAt(e.clientX));
  };
  const toSelection = () => {
    const pad = (end - start) * 0.15;
    const a = Math.max(0, start - pad);
    const b = Math.min(1, end + pad);
    setView([a, b]);
  };

  // The small map of the whole audio: drag the window to move around.
  const mapDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    const span = view[1] - view[0];
    const inside = f >= view[0] && f <= view[1];
    const offset = inside ? f - view[0] : span / 2;
    drag.current = { kind: 'ventana', offset };
    const a = Math.min(1 - span, Math.max(0, f - offset));
    setView([a, a + span]);
  };
  const mapMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.kind !== 'ventana') return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    const span = view[1] - view[0];
    const a = Math.min(1 - span, Math.max(0, f - d.offset));
    setView([a, a + span]);
  };

  // --------------------------------------------------------- keyboard --

  const nudge = (edge: 'start' | 'end', dir: number, big: boolean) => {
    const d = ((big ? 0.1 : 0.01) * source.sr * dir) / source.data.length;
    if (edge === 'start') setEdit({ start: Math.max(0, Math.min(end - minLen, start + d)) });
    else setEdit({ end: Math.min(1, Math.max(start + minLen, end + d)) });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === ' ') {
      if (playing()) stop();
      else listen(start, end);
    } else if (e.key === 'Escape') {
      if (document.querySelector('.ea .menu')) return;
      stop();
      closeAudioEditor();
    } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) void use();
    else if (e.key === '+' || e.key === '=') zoom(0.7);
    else if (e.key === '-') zoom(1.4);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const handleKey = (edge: 'start' | 'end') => (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    nudge(edge, e.key === 'ArrowRight' ? 1 : -1, e.shiftKey);
  };

  // ------------------------------------------------------------ actions --

  const use = async () => {
    if (busy) return;
    setBusy(true);
    stop();
    try {
      if (await applySelection()) closeDialog();
    } finally {
      setBusy(false);
    }
  };
  const chop = async (how: number | 'golpes') => {
    setBusy(true);
    stop();
    try {
      if (await chopSelection(how)) closeDialog();
    } finally {
      setBusy(false);
    }
  };

  const useLabel = useMemo(() => {
    if (target.kind === 'pista') {
      const t = trackById(p, target.trackId);
      return t ? `Usar en “${t.name}”` : 'Usar esta parte';
    }
    if (target.kind === 'soundboard') return `Poner en la tecla ${keyLabel(target.code)}`;
    return 'Usar en un pad nuevo';
  }, [target, p]);

  const pos = (f: number) => `${((f - view[0]) / (view[1] - view[0])) * 100}%`;
  const selLen = (end - start) * secs;
  const zoomed = view[1] - view[0] < 0.999;

  return (
    <div className="velo">
      <div className="dialogo ancho ea" role="dialog" aria-modal="true" aria-label="Editor de audio" ref={dialog} onKeyDown={onKey} style={{ '--c': ink } as CSSProperties}>
        <header>
          <h2>Elige tu parte favorita</h2>
          <label className="ea-nombre">
            <span className="oculto">Nombre</span>
            <input className="campo-texto" value={source.name} maxLength={24} onChange={(e) => setEdit({ source: { ...source, name: e.target.value } })} aria-label="Nombre del audio" />
          </label>
          <Seg
            small
            label="Qué es"
            value={source.family === 'voz' ? 'voz' : 'samples'}
            onChange={(f) => setEdit({ source: { ...source, family: f } })}
            options={[
              { id: 'voz', text: 'Voz', title: 'Se pinta de rosa, como las voces' },
              { id: 'samples', text: 'Sample', title: 'Se pinta de verde, como los samples' },
            ]}
          />
          <button className="btn icono" onClick={() => (stop(), closeAudioEditor())} aria-label="Cerrar sin usar" title="Cerrar (Esc)">
            <Icon name="cerrar" size={14} />
          </button>
        </header>
        <div className="contenido">
          <p className="ea-ayuda">
            Arrastra las orillas para recortar, o arrastra en la onda para elegir otra parte. La rueda del mouse acerca. <b>Espacio</b> escucha la parte elegida.
          </p>
          <div
            className="ea-onda"
            ref={area}
            tabIndex={0}
            role="group"
            aria-label={`Forma de onda de ${source.name}. Parte elegida de ${clock(start * secs)} a ${clock(end * secs)}.`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => (drag.current = null)}
            onWheel={onWheel}
            data-tour="editor-onda"
          >
            <canvas ref={wave} aria-hidden="true" />
            {start > view[0] && <div className="ea-fuera" style={{ left: 0, width: pos(Math.min(start, view[1])) }} />}
            {end < view[1] && <div className="ea-fuera" style={{ left: pos(Math.max(end, view[0])), right: 0 }} />}
            <div className="ea-sel" style={{ left: pos(Math.max(start, view[0])), width: `calc(${pos(Math.min(end, view[1]))} - ${pos(Math.max(start, view[0]))})` }} />
            {start >= view[0] && start <= view[1] && (
              <div
                className="ea-asa ini"
                data-asa="ini"
                style={{ left: pos(start) }}
                role="slider"
                tabIndex={0}
                aria-label="Inicio de la parte"
                aria-valuemin={0}
                aria-valuemax={Math.round(secs * 100) / 100}
                aria-valuenow={Math.round(start * secs * 100) / 100}
                aria-valuetext={clock(start * secs)}
                onKeyDown={handleKey('start')}
              />
            )}
            {end >= view[0] && end <= view[1] && (
              <div
                className="ea-asa fin"
                data-asa="fin"
                style={{ left: pos(end) }}
                role="slider"
                tabIndex={0}
                aria-label="Final de la parte"
                aria-valuemin={0}
                aria-valuemax={Math.round(secs * 100) / 100}
                aria-valuenow={Math.round(end * secs * 100) / 100}
                aria-valuetext={clock(end * secs)}
                onKeyDown={handleKey('end')}
              />
            )}
            <div className="ea-cabezal" ref={head} style={{ display: 'none' }} aria-hidden="true" />
          </div>
          <div className="ea-mapa" ref={mapBox} onPointerDown={mapDown} onPointerMove={mapMove} onPointerUp={() => (drag.current = null)} aria-hidden="true">
            <canvas ref={map} />
            <div className="ea-mapa-sel" style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }} />
            {zoomed && <div className="ea-ventana" style={{ left: `${view[0] * 100}%`, width: `${(view[1] - view[0]) * 100}%` }} />}
          </div>
          <div className="ea-datos">
            <span>
              Desde <b className="num">{clock(start * secs)}</b>
            </span>
            <span>
              hasta <b className="num">{clock(end * secs)}</b>
            </span>
            <span>
              dura <b className="num">{selLen < 10 ? selLen.toFixed(2) : selLen.toFixed(1)} s</b>
            </span>
            <span className="espacio" />
            <button className="btn chico" onClick={() => setSel(...soundRegion(source.data, source.sr))} title="Quita el silencio del principio y del final">
              Quitar silencios
            </button>
            <button className="btn chico" onClick={() => setSel(0, 1)}>
              Todo el audio
            </button>
            <button className="btn chico icono" onClick={() => zoom(0.6)} aria-label="Acercar" title="Acercar (+)">
              <Icon name="acercar" size={14} />
            </button>
            <button className="btn chico icono" onClick={() => zoom(1.6)} disabled={!zoomed} aria-label="Alejar" title="Alejar (−)">
              <Icon name="alejar" size={14} />
            </button>
            <button className="btn chico" onClick={toSelection}>
              Ver la parte
            </button>
            <button className="btn chico" onClick={() => setView([0, 1])} disabled={!zoomed}>
              Ver todo
            </button>
          </div>
          <div className="ea-opciones">
            <button className="btn primario-neutro" onClick={() => (playing() ? stop() : listen(start, end))} data-tour="editor-escuchar">
              <Icon name="play" size={14} />
              Escuchar la parte
            </button>
            <button className="btn" onClick={() => listen(0, 1)}>
              Escuchar todo
            </button>
            <label className="ea-suave" title="Hace más suaves la entrada y la salida del audio">
              <span>Suavizar orillas</span>
              <input type="range" min={0} max={1} step={0.05} value={smooth} onChange={(e) => setEdit({ smooth: Number(e.target.value) })} />
              <output className="num">{Math.round(1.5 + smooth * 60)} ms</output>
            </label>
            <label className="casilla">
              <input type="checkbox" checked={reverse} onChange={(e) => setEdit({ reverse: e.target.checked })} />
              Al revés
            </label>
          </div>
        </div>
        <footer className="ea-pie">
          <button className="btn" onClick={() => void saveSelectionToLibrary(source.name)} disabled={busy} title="Queda en el navegador, para usarla en cualquier proyecto">
            <Icon name="guardar" size={14} />
            Guardar en Mis samples
          </button>
          {target.kind !== 'soundboard' && (
            <Menu
              className="btn"
              label={
                <>
                  <Icon name="tijeras" size={14} />
                  Cortar en pads
                  <Icon name="abajo" size={12} />
                </>
              }
              title="Parte la selección en varios pads, uno por pedazo"
              width={280}
            >
              {(close) => (
                <>
                  <span className="menu-grupo">Partes iguales</span>
                  {[2, 4, 8, 16].map((n) => (
                    <button key={n} role="menuitem" onClick={() => (close(), void chop(n))}>
                      {n} pads
                    </button>
                  ))}
                  <hr />
                  <button role="menuitem" className="con-desc" onClick={() => (close(), void chop('golpes'))}>
                    <b>Un pad por golpe</b>
                    <small>Para loops de batería: corta donde pega cada sonido</small>
                  </button>
                </>
              )}
            </Menu>
          )}
          <span className="espacio" />
          <button className="btn" onClick={() => (stop(), closeAudioEditor())}>
            Cancelar
          </button>
          <button className="btn primario" onClick={() => void use()} disabled={busy} data-tour="editor-usar">
            <Icon name="listo" size={14} />
            {useLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
