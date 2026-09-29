// Instrument pictograms: solid geometric figures on the family ink,
// like the Mexico City Metro signage (DESIGN.md 5).
import type { JSX } from 'react';
import type { Family, Pict as PictId } from '../state/model';

export const INK: Record<Family, string> = {
  bateria: 'var(--naranja)',
  bajo: 'var(--amarillo)',
  sintes: 'var(--azul)',
  voz: 'var(--rosa)',
  samples: 'var(--verde)',
  efectos: 'var(--turquesa)',
};

const N = '#161412';

const SHAPES: Record<PictId, JSX.Element> = {
  bombo: (
    <>
      <circle cx="14" cy="14" r="7.5" fill="none" stroke={N} strokeWidth="3" />
      <circle cx="14" cy="14" r="2.5" fill={N} />
    </>
  ),
  caja: (
    <>
      <path d="M5 10h18v9c0 1.9-4 3.2-9 3.2S5 20.9 5 19z" fill={N} />
      <ellipse cx="14" cy="10" rx="9" ry="3.2" fill={N} />
      <ellipse cx="14" cy="10" rx="6.4" ry="1.7" fill="currentColor" />
    </>
  ),
  palmas: (
    <>
      <rect x="7" y="6" width="6" height="15" rx="3" transform="rotate(-18 10 13)" fill={N} />
      <rect x="15" y="6" width="6" height="15" rx="3" transform="rotate(18 18 13)" fill={N} />
    </>
  ),
  hat: (
    <>
      <ellipse cx="14" cy="10" rx="9" ry="2.6" fill={N} />
      <ellipse cx="14" cy="14.5" rx="9" ry="2.6" fill={N} />
      <rect x="13" y="15" width="2" height="8" fill={N} />
    </>
  ),
  hatab: (
    <>
      <ellipse cx="14" cy="7.5" rx="9" ry="2.6" fill={N} />
      <ellipse cx="14" cy="16" rx="9" ry="2.6" fill={N} />
      <rect x="13" y="16" width="2" height="7" fill={N} />
    </>
  ),
  rim: (
    <>
      <circle cx="12" cy="16" r="6.5" fill="none" stroke={N} strokeWidth="3" />
      <rect x="15" y="3" width="3" height="15" transform="rotate(38 16.5 10.5)" fill={N} />
    </>
  ),
  conga: (
    <>
      <path d="M8 7h12l-2.5 15h-7z" fill={N} />
      <rect x="7" y="5" width="14" height="3" fill={N} />
    </>
  ),
  shaker: (
    <>
      <rect x="5" y="9" width="18" height="10" rx="5" fill={N} />
      <circle cx="10.5" cy="14" r="1.4" fill="currentColor" />
      <circle cx="14" cy="14" r="1.4" fill="currentColor" />
      <circle cx="17.5" cy="14" r="1.4" fill="currentColor" />
    </>
  ),
  cencerro: (
    <>
      <path d="M10 5h8l4 16H6z" fill={N} />
      <rect x="9" y="18" width="10" height="2" fill="currentColor" />
    </>
  ),
  platillo: (
    <>
      <ellipse cx="14" cy="10" rx="10" ry="2.8" transform="rotate(-10 14 10)" fill={N} />
      <rect x="13" y="11" width="2" height="12" fill={N} />
      <rect x="9" y="21" width="10" height="2" fill={N} />
    </>
  ),
  timbal: (
    <>
      <path d="M3 11h10v8c0 1.3-2.2 2.2-5 2.2S3 20.3 3 19z" fill={N} />
      <path d="M15 9h10v10c0 1.3-2.2 2.2-5 2.2s-5-.9-5-2.2z" fill={N} />
      <ellipse cx="8" cy="11" rx="3.4" ry="1" fill="currentColor" />
      <ellipse cx="20" cy="9" rx="3.4" ry="1" fill="currentColor" />
    </>
  ),
  subida: <path d="M5 21 L23 7 L23 21 Z" fill={N} />,
  impacto: <path d="M14 3l2.4 6.3L22.5 6l-2.7 6.2L26 14l-6.2 1.8 2.7 6.2-6.1-3.3L14 25l-2.4-6.3L5.5 22l2.7-6.2L2 14l6.2-1.8L5.5 6l6.1 3.3z" fill={N} />,
  bajo: <path d="M4 14c2.5-7 5.5-7 8 0s5.5 7 8 0 3-4 4-4" fill="none" stroke={N} strokeWidth="3.2" strokeLinecap="square" />,
  acordes: (
    <>
      <rect x="6" y="6" width="16" height="4" fill={N} />
      <rect x="6" y="12" width="16" height="4" fill={N} />
      <rect x="6" y="18" width="16" height="4" fill={N} />
    </>
  ),
  sinte: (
    <>
      <rect x="5" y="6" width="18" height="16" fill={N} />
      <rect x="10.6" y="14" width="1.4" height="8" fill="currentColor" />
      <rect x="16" y="14" width="1.4" height="8" fill="currentColor" />
      <rect x="8.4" y="8" width="1.6" height="6" fill="currentColor" />
      <rect x="13.2" y="8" width="1.6" height="6" fill="currentColor" />
      <rect x="18" y="8" width="1.6" height="6" fill="currentColor" />
    </>
  ),
  voz: (
    <>
      <rect x="10" y="4" width="8" height="13" rx="4" fill={N} />
      <path d="M7 13a7 7 0 0 0 14 0" fill="none" stroke={N} strokeWidth="2.2" />
      <rect x="13" y="20" width="2" height="4" fill={N} />
    </>
  ),
  sample: (
    <>
      <rect x="5" y="12" width="2" height="4" fill={N} />
      <rect x="9" y="8" width="2" height="12" fill={N} />
      <rect x="13" y="5" width="2" height="18" fill={N} />
      <rect x="17" y="9" width="2" height="10" fill={N} />
      <rect x="21" y="12" width="2" height="4" fill={N} />
    </>
  ),
  tom: (
    <>
      <path d="M7 8h14v11c0 1.6-3.1 2.8-7 2.8S7 20.6 7 19z" fill={N} />
      <ellipse cx="14" cy="8" rx="7" ry="2.4" fill={N} />
      <ellipse cx="14" cy="8" rx="5" ry="1.2" fill="currentColor" />
      <rect x="8" y="20" width="2" height="5" fill={N} />
      <rect x="18" y="20" width="2" height="5" fill={N} />
    </>
  ),
  chasquido: (
    <>
      <circle cx="11" cy="17" r="5.5" fill={N} />
      <rect x="10.8" y="3" width="2.4" height="6" transform="rotate(-12 12 6)" fill={N} />
      <rect x="17" y="5" width="2.4" height="6" transform="rotate(35 18.2 8)" fill={N} />
      <rect x="19" y="12" width="6" height="2.4" transform="rotate(-8 22 13.2)" fill={N} />
    </>
  ),
  clave: (
    <>
      <rect x="12.3" y="3" width="3.4" height="22" rx="1.7" transform="rotate(-38 14 14)" fill={N} />
      <rect x="12.3" y="3" width="3.4" height="22" rx="1.7" transform="rotate(38 14 14)" fill={N} />
    </>
  ),
  pandero: (
    <>
      <circle cx="14" cy="14" r="8" fill="none" stroke={N} strokeWidth="3" />
      <rect x="12" y="3.5" width="4" height="3" fill={N} />
      <rect x="12" y="21.5" width="4" height="3" fill={N} />
      <rect x="3.5" y="12" width="3" height="4" fill={N} />
      <rect x="21.5" y="12" width="3" height="4" fill={N} />
    </>
  ),
  bongo: (
    <>
      <path d="M3 9h10l-2 13H5z" fill={N} />
      <path d="M15 11h10l-2 11h-6z" fill={N} />
      <rect x="11" y="14" width="6" height="2.5" fill={N} />
    </>
  ),
  bajada: <path d="M5 7 L23 21 L5 21 Z" fill={N} />,
  laser: <path d="M17 3 L8 15.5 H13.5 L11 25 L20.5 12 H15 Z" fill={N} />,
  corneta: (
    <>
      <path d="M4 11h5l13-6.5v19L9 17H4z" fill={N} />
      <rect x="6" y="17" width="3" height="5" fill={N} />
    </>
  ),
  guitarra: (
    <>
      <circle cx="10.5" cy="18.5" r="6" fill={N} />
      <circle cx="14.5" cy="13.5" r="4.3" fill={N} />
      <rect x="16" y="2.5" width="3" height="13" transform="rotate(40 17.5 9)" fill={N} />
      <circle cx="10.5" cy="18.5" r="2" fill="currentColor" />
    </>
  ),
  sierra: <path d="M3 20 L10 8 L10 20 L17 8 L17 20 L24 8 L24 20" fill="none" stroke={N} strokeWidth="3" strokeLinejoin="miter" />,
};

interface Props {
  pict: PictId;
  family: Family;
  size?: number;
  title?: string;
}

export function Pict({ pict, family, size = 28, title }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{ color: INK[family], flex: 'none' }} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="28" height="28" rx="7" fill="currentColor" />
      {SHAPES[pict]}
    </svg>
  );
}
