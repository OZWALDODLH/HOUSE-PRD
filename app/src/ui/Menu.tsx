// A button that opens a small floating menu. Closes on outside click or Esc.
// The menu floats over everything (fixed position), so a panel that clips
// its content never cuts it; it opens upward when there is no room below.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  title?: string;
  className?: string;
  align?: 'left' | 'right';
  width?: number;
  /** Class for the wrapper (for example to push the menu to the right). */
  wrap?: string;
  /** `data-tour` name, so the tutorial can point at it. */
  tour?: string;
  children: (close: () => void) => ReactNode;
}

const GAP = 4;
const EDGE = 8;

export function Menu({ label, title, className = 'btn chico', align = 'left', width, wrap, tour, children }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    // Scrolling the page under a fixed menu would leave it floating alone.
    const scroll = (e: Event) => {
      if (!pop.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', scroll);
    return () => {
      document.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', scroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' });
      return;
    }
    const b = button.current?.getBoundingClientRect();
    const el = pop.current;
    if (!b || !el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.scrollHeight;
    const below = vh - b.bottom - GAP - EDGE;
    const above = b.top - GAP - EDGE;
    const up = h > below && above > below;
    let left = align === 'right' ? b.right - w : b.left;
    left = Math.max(EDGE, Math.min(vw - w - EDGE, left));
    setStyle(
      up
        ? { position: 'fixed', left, bottom: vh - b.top + GAP, top: 'auto', maxHeight: above, width }
        : { position: 'fixed', left, top: b.bottom + GAP, maxHeight: below, width },
    );
  }, [open, align, width]);

  return (
    <div ref={box} className={wrap} style={{ position: 'relative' }} data-tour={tour}>
      <button ref={button} className={className} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={title}>
        {label}
      </button>
      {open && (
        <div ref={pop} className="menu" role="menu" style={{ width, ...style }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
