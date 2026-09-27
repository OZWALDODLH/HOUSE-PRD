// Physical controls: knob, faders, switch, segmented buttons, meter, speaker.
import { useCallback, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { ST } from '../engine/protocol';
import { toDb, useFrame } from './frame';
import { useUi } from '../state/ui';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Vertical drag, Shift for fine, double click for default, wheel and arrows. */
function useDrag(value: number, onChange: (v: number) => void, def: number, onStart?: () => void, pixels = 200) {
  const start = useRef<{ y: number; x: number; v: number } | null>(null);
  const onPointerDown = useCallback(
    (e: PointerEvent<Element>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      start.current = { y: e.clientY, x: e.clientX, v: value };
      onStart?.();
    },
    [value, onStart],
  );
  const onPointerMove = useCallback(
    (e: PointerEvent<Element>) => {
      const s = start.current;
      if (!s) return;
      const scale = e.shiftKey ? pixels * 5 : pixels;
      const d = (s.y - e.clientY + (e.clientX - s.x) * 0.5) / scale;
      onChange(clamp01(s.v + d));
    },
    [onChange, pixels],
  );
  const onPointerUp = useCallback(() => {
    start.current = null;
  }, []);
  const onDoubleClick = useCallback(() => onChange(def), [onChange, def]);
  const onKeyDown = useCallback(
    (e: KeyboardEvent<Element>) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp01(value + step));
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp01(value - step));
      else if (e.key === 'Home') onChange(0);
      else if (e.key === 'End') onChange(1);
      else if (e.key === 'Enter' || e.key === 'Delete' || e.key === 'Backspace') onChange(def);
      else return;
      e.preventDefault();
      e.stopPropagation();
    },
    [value, onChange, def],
  );
  const onWheel = useCallback(
    (e: WheelEvent<Element>) => {
      onChange(clamp01(value + (e.deltaY < 0 ? 0.02 : -0.02) * (e.shiftKey ? 0.25 : 1)));
    },
    [value, onChange],
  );
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick, onKeyDown, onWheel };
}

interface KnobProps {
  label: string;
  pro?: string;
  value: number;
  onChange: (v: number) => void;
  onStart?: () => void;
  text: string;
  ink?: string;
  def?: number;
  size?: 'l' | 'm' | 's';
  /** Arc grows from the middle (pan, filter). */
  bipolar?: boolean;
  showPro?: boolean;
  /** Only the dial: the name goes to screen readers and the tooltip. */
  compact?: boolean;
}

const A0 = 135;
const A1 = 405;

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const pol = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = pol(from);
  const [x1, y1] = pol(to);
  const big = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${big} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function Knob({ label, pro, value, onChange, onStart, text, ink = 'var(--tinta)', def = 0.5, size = 'm', bipolar, showPro, compact }: KnobProps) {
  const drag = useDrag(value, onChange, def, onStart);
  const px = compact ? 30 : size === 'l' ? 80 : size === 'm' ? 64 : 48;
  const c = 40;
  const r = 30;
  const av = A0 + (A1 - A0) * clamp01(value);
  const mid = (A0 + A1) / 2;
  const rad = (av * Math.PI) / 180;
  return (
    <div className={`perilla perilla-${size}${compact ? ' perilla-c' : ''}`} title={compact ? `${label}: ${text}` : undefined}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 80 80"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={text}
        className="perilla-svg"
        {...drag}
      >
        <path d={arcPath(c, c, r, A0, A1)} fill="none" stroke="var(--pantalla)" strokeWidth="5" />
        {bipolar ? (
          Math.abs(av - mid) > 0.5 && <path d={arcPath(c, c, r, Math.min(mid, av), Math.max(mid, av))} fill="none" stroke={ink} strokeWidth="5" />
        ) : (
          value > 0.002 && <path d={arcPath(c, c, r, A0, av)} fill="none" stroke={ink} strokeWidth="5" />
        )}
        <circle cx={c} cy={c} r="22" fill="var(--chasis-alto)" />
        <circle cx={c} cy={c} r="21.5" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
        <line x1={c + (r - 15) * Math.cos(rad)} y1={c + (r - 15) * Math.sin(rad)} x2={c + (r - 8) * Math.cos(rad)} y2={c + (r - 8) * Math.sin(rad)} stroke="var(--tinta)" strokeWidth="3" />
      </svg>
      {!compact && (
        <>
          <label>{label}</label>
          {pro && showPro && <small>{pro}</small>}
          <output className="num">{text}</output>
        </>
      )}
    </div>
  );
}

/** Fader position (0..1) to dB: 0.75 is 0 dB, the top is +6 dB. */
export const faderToDb = (p: number): number => (p <= 0.004 ? -90 : Math.max(-90, Math.min(6, 60 * Math.log10(p / 0.75))));
export const dbToFader = (db: number): number => (db <= -89.9 ? 0 : Math.min(1, 0.75 * 10 ** (db / 60)));
export const dbText = (db: number): string => (db <= -89.9 ? '−∞ dB' : `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`);

interface FaderProps {
  label: string;
  db: number;
  onChange: (db: number) => void;
  onStart?: () => void;
  ink: string;
  vertical?: boolean;
}

export function Fader({ label, db, onChange, onStart, ink, vertical }: FaderProps) {
  const pos = dbToFader(db);
  const set = useCallback((p: number) => onChange(Math.round(faderToDb(p) * 10) / 10), [onChange]);
  const drag = useDrag(pos, set, 0.75, onStart, vertical ? 180 : 90);
  return (
    <div
      className={vertical ? 'fader-v' : 'fader-h'}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuemin={-90}
      aria-valuemax={6}
      aria-valuenow={Math.round(db)}
      aria-valuetext={dbText(db)}
      style={{ '--p': pos, '--c': ink } as CSSProperties}
      {...drag}
    >
      <b />
      <i />
    </div>
  );
}

export function Switch({ on, onChange, label, ink = 'var(--verde)' }: { on: boolean; onChange: (v: boolean) => void; label: string; ink?: string }) {
  return (
    <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} style={{ '--c': ink } as CSSProperties} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange, label, small }: { value: T; options: { id: T; text: ReactNode; title?: string }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div className={`seg${small ? ' seg-s' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} title={o.title} onClick={() => onChange(o.id)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- meters --

/** Segment color by level: verde up to −12 dBFS, amarillo up to −3, rosa above. */
const segClass = (db: number) => (db > -3 ? 'r' : db > -12 ? 'a' : 'v');

interface MeterProps {
  /** Reads a linear peak (0..1+) from the status array. */
  read: (s: Float32Array) => number;
  segments?: number;
  vertical?: boolean;
  label?: string;
}

export function Meter({ read, segments = 14, vertical, label }: MeterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const level = useRef(-60);
  const lit = useRef(-1);
  const floor = -48;
  const step = -floor / segments;
  // Top of each segment, from the quietest to the loudest.
  const dbs = Array.from({ length: segments }, (_, i) => floor + (i + 1) * step);
  useFrame((s, dt) => {
    const el = ref.current;
    if (!el) return;
    const db = toDb(read(s));
    // Fast rise, slow fall (about 20 dB per second).
    level.current = db > level.current ? db : Math.max(db, level.current - 20 * dt);
    const n = dbs.filter((top) => level.current >= top - step).length;
    if (n === lit.current) return;
    lit.current = n;
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) (kids[i] as HTMLElement).className = i < n ? segClass(dbs[i]) : '';
  });
  return (
    <div ref={ref} className={vertical ? 'medidor-v' : 'medidor-h'} role="img" aria-label={label ?? 'Nivel'}>
      {dbs.map((_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

/** The speaker cone: the master meter, moving with the bass (DESIGN.md 4.3). */
export function Bocina({ size = 46 }: { size?: number }) {
  const memb = useRef<SVGGElement>(null);
  const cap = useRef<SVGCircleElement>(null);
  const lessMotion = useUi((s) => s.lessMotion);
  const env = useRef(0);
  useFrame((s, dt) => {
    const kick = s[ST.KICK];
    const low = (s[ST.BANDS] + s[ST.BANDS + 1] + s[ST.BANDS + 2]) / 3;
    const target = Math.max(kick, low * 0.6);
    env.current = target > env.current ? target : Math.max(target, env.current - 3.2 * dt);
    const reduce = lessMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (memb.current) memb.current.style.transform = reduce ? '' : `scale(${1 + env.current * 0.08})`;
    if (cap.current) cap.current.setAttribute('fill', env.current > 0.35 ? 'var(--tinta)' : 'var(--tinta-3)');
  });
  return (
    <svg className="cono" width={size} height={size} viewBox="0 0 46 46" aria-hidden="true">
      <circle cx="23" cy="23" r="22" fill="var(--pantalla)" />
      <circle cx="23" cy="23" r="19.5" fill="none" stroke="var(--bisel)" strokeWidth="3" />
      <g ref={memb} style={{ transformOrigin: '23px 23px' }}>
        <circle cx="23" cy="23" r="16" fill="var(--chasis)" />
        <circle cx="23" cy="23" r="12.5" fill="none" stroke="var(--chasis-alto)" strokeWidth="1.5" />
        <circle cx="23" cy="23" r="9" fill="none" stroke="var(--chasis-alto)" strokeWidth="1.5" />
        <circle ref={cap} cx="23" cy="23" r="5.5" fill="var(--tinta-3)" />
      </g>
    </svg>
  );
}
