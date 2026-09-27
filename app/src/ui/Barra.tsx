// Top bar: project, transport, position, tempo, key, swing, mode, outputs, speaker.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ST } from '../engine/protocol';
import { useLive } from '../engine/live';
import { play, startAudio, stop } from '../engine/audio';
import { NOTE_NAMES, keyName } from '../state/model';
import { redo, setBpm, setKey, setMetronome, setSwing, undo, useStudio } from '../state/store';
import { genreById } from '../state/templates';
import { openDialog, useUi } from '../state/ui';
import { Icon } from './Icon';
import { Bocina, Meter, Seg } from './controls';
import { Menu } from './Menu';

function useAgo(t: number): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (t < 0) return 'sin guardar';
  if (!t) return 'guardado';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 5) return 'guardado ahora';
  if (s < 60) return `guardado hace ${s - (s % 5)} s`;
  const m = Math.round(s / 60);
  return `guardado hace ${m} min`;
}

export function Barra() {
  const p = useStudio((s) => s.project);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const { pro, set, savedAt, recArmed } = useUi();
  const playing = useLive((s) => s[ST.PLAYING] > 0.5);
  const ago = useAgo(savedAt);
  return (
    <header className="top surco-b">
      <button className="logo" onClick={() => set({ screen: 'inicio' })} title="Ir a Inicio">
        HOUSE
      </button>
      <button className="proyecto" onClick={() => openDialog('proyectos')} title="Tus proyectos">
        <b>{p.name}</b>
        <span>
          {genreById(p.genre).name}, {ago}
        </span>
      </button>
      <div className="sep" />
      <div className="transporte">
        <button className="btn icono" onClick={() => stop()} aria-label="Parar" title="Parar (Espacio)">
          <Icon name="stop" size={16} />
        </button>
        <button
          className={`btn icono${playing ? ' on' : ''}`}
          onClick={() => {
            if (playing) stop();
            else {
              set({ follow: true });
              void play();
            }
          }}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          aria-pressed={playing}
          title="Reproducir o parar (Espacio)"
        >
          <Icon name="play" size={18} />
        </button>
        <button
          className={`btn icono${recArmed ? ' grabando' : ''}`}
          onClick={() => {
            set({ recArmed: !recArmed });
            void startAudio();
          }}
          aria-pressed={recArmed}
          aria-label="Grabar lo que tocas"
          title="Grabar lo que tocas en los pads mientras suena"
        >
          <Icon name="rec" size={18} />
        </button>
      </div>
      <Posicion />
      <Tempo bpm={p.bpm} />
      <Tonalidad />
      <Swing swing={p.swing} />
      <button className={`btn icono${p.metronome ? ' on' : ''}`} onClick={() => setMetronome(!p.metronome)} aria-pressed={p.metronome} aria-label="Metrónomo" title="Metrónomo">
        <Icon name="metronomo" />
      </button>
      <div className="espacio" />
      <button className="btn icono" onClick={() => undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
        <Icon name="deshacer" />
      </button>
      <button className="btn icono" onClick={() => redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)">
        <Icon name="rehacer" />
      </button>
      <Seg
        label="Modo"
        value={pro ? 'pro' : 'facil'}
        onChange={(v) => set({ pro: v === 'pro' })}
        options={[
          { id: 'facil', text: 'Fácil' },
          { id: 'pro', text: 'Pro' },
        ]}
      />
      <Salidas />
      <div className="bocina" aria-label="Nivel maestro">
        <Bocina />
        <div className="vu" aria-hidden="true">
          <Meter read={(s) => s[ST.PEAK_L]} />
          <Meter read={(s) => s[ST.PEAK_R]} />
        </div>
      </div>
    </header>
  );
}

function Posicion() {
  const step = useLive((s) => (s[ST.PLAYING] > 0.5 ? s[ST.STEP] : 0));
  const bar = Math.floor(step / 16) + 1;
  const beat = Math.floor((step % 16) / 4) + 1;
  const sub = (step % 4) + 1;
  return (
    <div className="lcd" aria-label={`Compás ${bar}, tiempo ${beat}`}>
      <div>
        <small>Compás</small>
        <span className="n" style={{ minWidth: '2.4ch' }}>
          {bar}
        </span>
      </div>
      <div>
        <small>Tiempo</small>
        <span className="n">{beat}</span>
      </div>
      <div>
        <small>Paso</small>
        <span className="n">{sub}</span>
      </div>
    </div>
  );
}

/** Drag up or down, use the wheel, or double click to type. */
function useNumberDrag(value: number, onChange: (v: number) => void, perPixel: number) {
  const start = useRef<{ y: number; v: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { y: e.clientY, v: value };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (s) onChange(s.v + (s.y - e.clientY) * perPixel * (e.shiftKey ? 0.2 : 1));
    },
    onPointerUp: () => {
      start.current = null;
    },
  };
}

function Tempo({ bpm }: { bpm: number }) {
  const [typing, setTyping] = useState(false);
  const drag = useNumberDrag(bpm, (v) => setBpm(Math.round(v)), 0.25);
  const digits = String(Math.round(bpm)).padStart(3, ' ').split('');
  return (
    <div className="lcd" title="Arrastra para cambiar el tempo, doble clic para escribirlo">
      {typing ? (
        <input
          className="bpm-campo"
          autoFocus
          defaultValue={bpm}
          inputMode="numeric"
          aria-label="Tempo en BPM"
          onBlur={(e) => {
            const v = Number(e.currentTarget.value.replace(',', '.'));
            if (Number.isFinite(v)) setBpm(v);
            setTyping(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setTyping(false);
          }}
        />
      ) : (
        <div
          className="bpm"
          role="slider"
          tabIndex={0}
          aria-label="Tempo"
          aria-valuemin={60}
          aria-valuemax={200}
          aria-valuenow={bpm}
          aria-valuetext={`${bpm} BPM`}
          onDoubleClick={() => setTyping(true)}
          onWheel={(e) => setBpm(bpm + (e.deltaY < 0 ? 1 : -1))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setBpm(bpm + (e.shiftKey ? 5 : 1));
            else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setBpm(bpm - (e.shiftKey ? 5 : 1));
            else if (e.key === 'Enter') setTyping(true);
            else return;
            e.preventDefault();
            e.stopPropagation();
          }}
          {...drag}
        >
          {digits.map((d, i) => (
            <i key={i}>{d.trim()}</i>
          ))}
        </div>
      )}
      <small>BPM</small>
    </div>
  );
}

function Tonalidad() {
  const key = useStudio((s) => s.project.key);
  return (
    <Menu
      className="campo"
      width={280}
      title="Tonalidad de la canción"
      label={
        <>
          <small>Tonalidad</small>
          <b>{keyName(key)}</b>
        </>
      }
    >
      {() => (
        <>
          <Seg
            small
            label="Escala"
            value={key.scale}
            onChange={(scale) => setKey(key.root, scale)}
            options={[
              { id: 'menor', text: 'Menor (más oscura)' },
              { id: 'mayor', text: 'Mayor (más alegre)' },
            ]}
          />
          <div className="menu-rejilla" style={{ marginTop: 6 }}>
            {NOTE_NAMES.map((n, i) => (
              <button key={n} role="menuitemradio" aria-checked={key.root === i} className={key.root === i ? 'on' : ''} onClick={() => setKey(i, key.scale)}>
                {n}
              </button>
            ))}
          </div>
          <hr />
          <span style={{ fontSize: 12, color: 'var(--tinta-3)', padding: '2px 6px 4px' }}>Las notas de tus pistas se mueven solas a la nueva tonalidad.</span>
        </>
      )}
    </Menu>
  );
}

function Swing({ swing }: { swing: number }) {
  const drag = useNumberDrag(swing, (v) => setSwing(v), 0.002);
  const pct = Math.round(swing * 100);
  return (
    <button
      className="campo arrastre"
      role="slider"
      aria-label="Swing"
      aria-valuemin={50}
      aria-valuemax={75}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      title="Swing: arrastra para darle más o menos balanceo. Doble clic para recto."
      onDoubleClick={() => setSwing(0.5)}
      onWheel={(e) => setSwing(swing + (e.deltaY < 0 ? 0.01 : -0.01))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setSwing(swing + 0.01);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setSwing(swing - 0.01);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      {...drag}
    >
      <small>Swing</small>
      <b className="num">{pct}%</b>
    </button>
  );
}

function Salidas() {
  const outputs = useUi((s) => s.outputs);
  const two = !!outputs.cue;
  return (
    <button className="salidas" onClick={() => openDialog('salidas')} aria-label="Salidas de audio" title="Elige por dónde suena">
      <span>
        <Icon name="bocina" size={16} />
        Bocina
      </span>
      {two && (
        <>
          <span style={{ color: 'var(--tinta-3)' }}>+</span>
          <span>
            <Icon name="audifonos" size={16} />
            Audífonos
          </span>
        </>
      )}
    </button>
  );
}
