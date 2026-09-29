// Interface icons drawn for HOUSE: 24 px grid, 2 px stroke, square ends.
import type { JSX } from 'react';

type Name =
  | 'play'
  | 'stop'
  | 'rec'
  | 'metronomo'
  | 'bocina'
  | 'audifonos'
  | 'deshacer'
  | 'rehacer'
  | 'dados'
  | 'mas'
  | 'basura'
  | 'duplicar'
  | 'arriba'
  | 'abajo'
  | 'izq'
  | 'der'
  | 'buscar'
  | 'ajustes'
  | 'teclado'
  | 'pantalla'
  | 'exportar'
  | 'carpeta'
  | 'micro'
  | 'cerrar'
  | 'listo'
  | 'inicio'
  | 'guardar'
  | 'bucle'
  | 'limpiar'
  | 'tijeras'
  | 'acercar'
  | 'alejar'
  | 'libro'
  | 'efecto'
  | 'onda'
  | 'nota';

const P: Record<Name, JSX.Element> = {
  play: <path d="M7 4.5 20 12 7 19.5z" fill="currentColor" stroke="none" />,
  stop: <rect x="5.5" y="5.5" width="13" height="13" fill="currentColor" stroke="none" />,
  rec: <circle cx="12" cy="12" r="6.5" fill="var(--rosa)" stroke="none" />,
  metronomo: (
    <>
      <path d="M8 3h8l4 18H4z" />
      <path d="M12 16 17 7" />
    </>
  ),
  bocina: (
    <>
      <rect x="5" y="2" width="14" height="20" />
      <circle cx="12" cy="14" r="3.5" />
      <path d="M12 6.5v1" />
    </>
  ),
  audifonos: (
    <>
      <path d="M3.5 17v-5a8.5 8.5 0 0 1 17 0v5" />
      <rect x="2.5" y="14" width="4.5" height="7" />
      <rect x="17" y="14" width="4.5" height="7" />
    </>
  ),
  deshacer: (
    <>
      <path d="M8 5 3.5 9.5 8 14" />
      <path d="M4 9.5h10a6 6 0 0 1 0 12h-4" />
    </>
  ),
  rehacer: (
    <>
      <path d="M16 5l4.5 4.5L16 14" />
      <path d="M20 9.5H10a6 6 0 0 0 0 12h4" />
    </>
  ),
  dados: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  mas: <path d="M12 4v16M4 12h16" />,
  basura: (
    <>
      <path d="M4 6.5h16M9.5 6.5V3.5h5v3" />
      <path d="M6 6.5 7 21h10l1-14.5" />
    </>
  ),
  duplicar: (
    <>
      <rect x="8" y="8" width="12.5" height="12.5" />
      <path d="M16 8V3.5H3.5V16H8" />
    </>
  ),
  arriba: <path d="M5 15l7-7 7 7" />,
  abajo: <path d="M5 9l7 7 7-7" />,
  izq: <path d="M15 5l-7 7 7 7" />,
  der: <path d="M9 5l7 7-7 7" />,
  buscar: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  ajustes: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <rect x="6" y="3.5" width="4" height="5" fill="var(--chasis-alto)" />
      <rect x="14" y="9.5" width="4" height="5" fill="var(--chasis-alto)" />
      <rect x="8" y="15.5" width="4" height="5" fill="var(--chasis-alto)" />
    </>
  ),
  teclado: (
    <>
      <rect x="2" y="6" width="20" height="12" />
      <path d="M6 10h1M10 10h1M14 10h1M18 10h0M8 14h8" />
    </>
  ),
  pantalla: (
    <>
      <rect x="2" y="3" width="20" height="14" />
      <path d="M8 21h8M12 17v4" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  exportar: (
    <>
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M4 13v8h16v-8" />
    </>
  ),
  carpeta: <path d="M3 5h7l2 2.5h9V20H3z" />,
  micro: (
    <>
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" />
      <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22" />
    </>
  ),
  cerrar: <path d="M5 5l14 14M19 5 5 19" />,
  listo: <path d="M4 12.5 9.5 18 20 6.5" />,
  inicio: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5.5 9v12h13V9" />
    </>
  ),
  guardar: (
    <>
      <path d="M4 4h13l3 3v13H4z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  bucle: (
    <>
      <path d="M17 4l3 3-3 3" />
      <path d="M20 7H8a4 4 0 0 0-4 4v1M7 20l-3-3 3-3" />
      <path d="M4 17h12a4 4 0 0 0 4-4v-1" />
    </>
  ),
  limpiar: (
    <>
      <path d="M4 20h16" />
      <path d="M14.5 3.5l5 5-9 9h-5v-5z" />
    </>
  ),
  tijeras: (
    <>
      <circle cx="6.5" cy="6.5" r="3" />
      <circle cx="6.5" cy="17.5" r="3" />
      <path d="M9 8.5 20 18M9 15.5 20 6" />
    </>
  ),
  acercar: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  alejar: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M7.5 10.5h6" />
    </>
  ),
  libro: (
    <>
      <path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3z" />
      <path d="M21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" />
    </>
  ),
  efecto: (
    <>
      <path d="M3 12h3l2-6 4 12 3-9 2 3h4" />
    </>
  ),
  onda: <path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h0" />,
  nota: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
};

export function Icon({ name, size = 18, title }: { name: Name; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      style={{ flex: 'none' }}
    >
      {P[name]}
    </svg>
  );
}

export type IconName = Name;
