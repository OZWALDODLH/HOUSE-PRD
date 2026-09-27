// Pads (your tracks), piano and scale keys. Mouse, touch and the computer keyboard.
import { useEffect, useReducer, useRef, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { ST } from '../engine/protocol';
import { BANK_A, PIANO, SCALE_ROWS, keyLabel, onLayout } from '../input/keys';
import { hitNote, hitTrack, noteTrack, releaseNote, releaseTrack, scaleNote } from '../input/play';
import { useHeld } from '../input/pressed';
import { soundById } from '../state/instruments';
import { NOTE_NAMES, SCALES, type Track } from '../state/model';
import { addTrack, useStudio } from '../state/store';
import { toast, useUi, type KbMode } from '../state/ui';
import { INK } from './Pict';
import { Seg } from './controls';
import { useFrame } from './frame';

function useLayoutLabels(): void {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onLayout(force), []);
}

export function Pads() {
  const { kbMode, set, keyboardOn } = useUi();
  const target = noteTrack();
  useLayoutLabels();
  return (
    <div className="pads">
      <div className="cab-pads">
        <h3>{kbMode === 'pads' ? 'Pads' : kbMode === 'piano' ? 'Piano' : 'Escala'}</h3>
        <span className="nota-pads" title={keyboardOn ? 'El teclado de tu computadora toca estos sonidos' : 'Prende el teclado musical con Tab'}>
          {kbMode === 'pads' ? (
            <>
              <b>7 a {keyLabel('Slash')}</b> tocan {target ? target.name : 'un bajo o sinte'}
            </>
          ) : (
            <>
              Tocas <b>{target ? target.name : 'un bajo o sinte'}</b>
              {kbMode === 'piano' ? `, ${keyLabel('KeyZ')} ${keyLabel('KeyX')} octava` : ''}
            </>
          )}
        </span>
        <Seg<KbMode>
          small
          label="Modo del teclado musical"
          value={kbMode}
          onChange={(m) => set({ kbMode: m })}
          options={[
            { id: 'pads', text: 'Pads' },
            { id: 'piano', text: 'Piano' },
            { id: 'escala', text: 'Escala' },
          ]}
        />
      </div>
      {kbMode === 'pads' && <Rejilla />}
      {kbMode === 'piano' && <Piano />}
      {kbMode === 'escala' && <Escala />}
    </div>
  );
}

function Rejilla() {
  const tracks = useStudio((s) => s.project.tracks);
  return (
    <div className="rejilla">
      {BANK_A.map((code, i) => (
        <Pad key={code} code={code} t={tracks[i]} index={i} />
      ))}
    </div>
  );
}

function Pad({ code, t, index }: { code: string; t?: Track; index: number }) {
  const held = useHeld(t ? `pad:${t.id}` : '-');
  const ref = useRef<HTMLButtonElement>(null);
  const flash = useRef(0);
  // Lights up when the sequencer plays it too: what moves is what sounds.
  useFrame((s) => {
    const el = ref.current;
    if (!el || !t) return;
    const now = performance.now();
    if ((s[ST.TRIGGERS] >> index) & 1) flash.current = now + 90;
    el.classList.toggle('golpe', held || now < flash.current);
  });
  const src = (e: PointerEvent) => `ptr:${e.pointerId}:${index}`;
  if (!t) {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const s = soundById(e.dataTransfer.getData('text/house-sound'));
      if (s && !addTrack(s)) toast('Ya tienes 16 pistas.', 'error');
    };
    return (
      <button className="pad vacio" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} aria-label={`Pad vacío, tecla ${keyLabel(code)}`}>
        <span className="snd">Arrastra un sonido</span>
        <span className="tecla">{keyLabel(code)}</span>
      </button>
    );
  }
  return (
    <button
      ref={ref}
      className={`pad${held ? ' golpe' : ''}`}
      style={{ '--c': INK[t.family] } as CSSProperties}
      aria-label={`Pad ${t.name}, tecla ${keyLabel(code)}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        useUi.getState().set({ selected: t.id });
        hitTrack(t.id, 0.9, src(e));
      }}
      onPointerUp={(e) => releaseTrack(t.id, src(e))}
      onPointerCancel={(e) => releaseTrack(t.id, src(e))}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          hitTrack(t.id, 0.9, 'focus');
          setTimeout(() => releaseTrack(t.id, 'focus'), 120);
        }
      }}
    >
      <span className="snd">{t.name}</span>
      <span className="tecla">{keyLabel(code)}</span>
    </button>
  );
}

function NoteKey({ note, className, name, style, children }: { note: number; className: string; name: string; style?: CSSProperties; children: ReactNode }) {
  const held = useHeld(`note:${note}`);
  const src = (e: PointerEvent) => `ptr:${e.pointerId}:n${note}`;
  return (
    <button
      className={`${className}${held ? ' golpe' : ''}`}
      style={style}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        hitNote(note, 0.85, src(e));
      }}
      onPointerUp={(e) => releaseNote(note, src(e))}
      onPointerCancel={(e) => releaseNote(note, src(e))}
      aria-label={name}
    >
      {children}
    </button>
  );
}

function Piano() {
  const { octave } = useUi();
  const key = useStudio((s) => s.project.key);
  const t = noteTrack();
  const shift = t && (t.kind === 'acid' || t.kind === 'bass808') ? -24 : 0;
  const base = octave * 12 + shift;
  const inScale = (n: number) => SCALES[key.scale].includes((((n - key.root) % 12) + 12) % 12);
  const whites = Object.entries(PIANO).filter(([, s]) => [0, 2, 4, 5, 7, 9, 11].includes(s % 12));
  const blacks = Object.entries(PIANO).filter(([, s]) => ![0, 2, 4, 5, 7, 9, 11].includes(s % 12));
  const ink = t ? INK[t.family] : 'var(--tinta)';
  return (
    <div className="piano" style={{ '--c': ink } as CSSProperties}>
      {whites.map(([code, s]) => (
        <NoteKey key={code} note={base + s} className={`blanca${inScale(base + s) ? '' : ' fuera'}`} name={`${NOTE_NAMES[s % 12]}, tecla ${keyLabel(code)}`}>
          {keyLabel(code)}
          <small>{NOTE_NAMES[s % 12]}</small>
        </NoteKey>
      ))}
      {blacks.map(([code, s]) => {
        // Black key sits between the white keys around it.
        const whiteIndex = whites.findIndex(([, w]) => w > s);
        return (
          <NoteKey
            key={code}
            note={base + s}
            className={`negra${inScale(base + s) ? '' : ' fuera'}`}
            name={`${NOTE_NAMES[s % 12]}, tecla ${keyLabel(code)}`}
            style={{ left: `calc(${(whiteIndex / whites.length) * 100}% - ${(100 / whites.length) * 0.31}%)` }}
          >
            {keyLabel(code)}
          </NoteKey>
        );
      })}
    </div>
  );
}

function Escala() {
  const key = useStudio((s) => s.project.key);
  useUi((s) => s.octave);
  const t = noteTrack();
  const ink = t ? INK[t.family] : 'var(--tinta)';
  return (
    <div className="escala" style={{ '--c': ink } as CSSProperties}>
      {[...SCALE_ROWS].reverse().map((row, rr) => {
        const r = SCALE_ROWS.length - 1 - rr;
        return (
          <div className="fila" key={r}>
            {row.map((code, k) => {
              const note = scaleNote(r * 7 + k - 7);
              const root = ((note - key.root) % 12 + 12) % 12 === 0;
              return (
                <NoteKey key={code} note={note} className={root ? 'raiz' : ''} name={`${NOTE_NAMES[note % 12]}, tecla ${keyLabel(code)}`}>
                  <b>{NOTE_NAMES[note % 12]}</b>
                  <small>{keyLabel(code)}</small>
                </NoteKey>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
