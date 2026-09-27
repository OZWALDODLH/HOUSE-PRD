// A button that opens a small floating menu. Closes on outside click or Esc.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  title?: string;
  className?: string;
  align?: 'left' | 'right';
  width?: number;
  /** Class for the wrapper (for example to push the menu to the right). */
  wrap?: string;
  children: (close: () => void) => ReactNode;
}

export function Menu({ label, title, className = 'btn chico', align = 'left', width, wrap, children }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  const style: CSSProperties = { width, ...(align === 'right' ? { left: 'auto', right: 0 } : {}) };
  return (
    <div ref={box} className={wrap} style={{ position: 'relative' }}>
      <button className={className} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={title}>
        {label}
      </button>
      {open && (
        <div className="menu" role="menu" style={style}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
