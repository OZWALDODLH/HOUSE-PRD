// Toolbar: transport, position, tempo, key, swing, loop or song, metronome,
// undo, easy or pro, the musical keyboard and the master level.
import { useRef, useState, type PointerEvent } from 'react';
import { ST } from '../engine/protocol';
import { useLive } from '../engine/live';
import { play, startAudio, stop } from '../engine/audio';
import { NOTE_NAMES, keyName } from '../state/model';
import { redo, setBpm, setKey, setMetronome, setMode, setSwing, undo, useStudio } from '../state/store';
import { KB_MODE_NAME, useUi } from '../state/ui';
import { Icon } from './Icon';
import { Meter, Seg } from './controls';
import { Menu } from './Menu';

export function Barra() {
  const p = useStudio((s) => s.project);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const { pro, set, recArmed, keyboardOn, kbMode } = useUi();
  const playing = useLive((s) => s[ST.PLAYING] > 0.5);
  return (
    <header className="herramientas">
      <div className="grupo-h transporte" data-tour="transporte">
        <button className="btn icono" onClick={() => stop()} aria-label="Parar y regresar al inicio" title="Parar (Espacio)">
          <Icon name="stop" size={14} />
        </button>
        <button
          className={`btn icono play${playing ? ' on' : ''}`}
          onClick={() => {
            if (playing) stop();
            else {
              set({ follow: true });
              void play();
            }
          }}
          aria-label={playing ? 'Parar' : 'Reproducir'}
          aria-pressed={playing}
          title="Reproducir o parar (Espacio)"
        >
          <Icon name="play" size={16} />
        </button>
        <button
          className={`btn icono${recArmed ? ' grabando' : ''}`}
          onClick={() => {
            set({ recArmed: !recArmed });
            void startAudio();
          }}
          aria-pressed={recArmed}
          data-tour="grabar-pads"
          aria-label="Grabar lo que tocas"
          title="Grabar lo que tocas en los pads mientras suena"
        >
          <Icon name="rec" size={16} />
        </button>
      </div>
      <Posicion bpm={p.bpm} />
      <Tempo bpm={p.bpm} />
      <Tonalidad />
      <Swing swing={p.swing} />
      <div data-tour="modo">
        <Seg
          small
          label="Qué suena al reproducir"
          value={p.mode}
          onChange={(m) => setMode(m)}
          options={[
            { id: 'patron', text: 'Loop', title: 'Repite el patrón una y otra vez' },
            { id: 'cancion', text: 'Canción', title: 'Toca las secciones de la línea de tiempo, de principio a fin' },
          ]}
        />
      </div>
      <button className={`btn icono${p.metronome ? ' on' : ''}`} onClick={() => setMetronome(!p.metronome)} aria-pressed={p.metronome} aria-label="Metrónomo" title="Metrónomo">
        <Icon name="metronomo" size={16} />
      </button>
      <div className="espacio" />
      <button
        className={`teclado-musical${keyboardOn ? ' on' : ''}`}
        onClick={() => set({ keyboardOn: !keyboardOn })}
        aria-pressed={keyboardOn}
        title="Tab prende o apaga el teclado musical"
        data-tour="teclado-musical"
      >
        <i aria-hidden="true" />
        {keyboardOn ? `Teclado: ${KB_MODE_NAME[kbMode]}` : 'Teclado apagado'}
      </button>
      <div className="grupo-h">
        <button className="btn icono" onClick={() => undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
          <Icon name="deshacer" size={16} />
        </button>
        <button className="btn icono" onClick={() => redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)">
          <Icon name="rehacer" size={16} />
        </button>
      </div>
      <div data-tour="facil-pro">
        <Seg
          small
          label="Modo"
          value={pro ? 'pro' : 'facil'}
          onChange={(v) => set({ pro: v === 'pro' })}
          options={[
            { id: 'facil', text: 'Fácil', title: 'Solo las perillas principales' },
            { id: 'pro', text: 'Pro', title: 'Todas las perillas y efectos' },
          ]}
        />
      </div>
      <div className="nivel-master" aria-label="Nivel del master" data-tour="nivel">
        <Meter read={(s) => s[ST.PEAK_L]} segments={20} label="Nivel izquierdo" />
        <Meter read={(s) => s[ST.PEAK_R]} segments={20} label="Nivel derecho" />
      </div>
    </header>
  );
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function Posicion({ bpm }: { bpm: number }) {
  const step = useLive((s) => s[ST.STEP]);
  const bar = Math.floor(step / 16) + 1;
  const beat = Math.floor((step % 16) / 4) + 1;
  const sub = (step % 4) + 1;
  const sec = (step * 60) / bpm / 4;
  const cells = String(bar).padStart(3, ' ').split('');
  return (
    <div className="lcd" aria-label={`Compás ${bar}, tiempo ${beat}, paso ${sub}`} data-tour="posicion" title="Compás, tiempo y paso">
      <span className="digitos">
        {cells.map((d, i) => (
          <i key={i}>{d.trim()}</i>
        ))}
        <em>.</em>
        <i>{beat}</i>
        <em>.</em>
        <i>{sub}</i>
      </span>
      <small className="num">{clock(sec)}</small>
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
    <div className="lcd tempo" title="Tempo: arrastra, usa la rueda o doble clic para escribirlo" data-tour="tempo">
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
          className="digitos arrastre"
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
    <div data-tour="tonalidad">
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
            <span className="nota-menu">Las notas de tus pistas se mueven solas a la nueva tonalidad.</span>
          </>
        )}
      </Menu>
    </div>
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
      data-tour="swing"
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
