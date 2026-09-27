// A small poster of a project's sections, for the project lists.
import type { SectionKind } from '../engine/protocol';

const SHORT: Partial<Record<SectionKind, string>> = { subida: 'Sub', salida: 'Sal', precoro: 'Pre', pausa: 'Pau', intro: 'Int', verso: 'Ver', coro: 'Coro', puente: 'Pue' };

export function MiniMarquesina({ sections }: { sections: { kind: SectionKind; bars: number; name?: string }[] }) {
  const total = sections.reduce((a, s) => a + s.bars, 0) || 1;
  const peak = sections.findIndex((s) => s.kind === 'drop' || s.kind === 'coro');
  return (
    <div className="mini-marq" aria-hidden="true">
      {sections.map((s, i) => {
        const w = s.bars / total;
        const name = s.kind === 'drop' ? '¡Drop!' : s.kind === 'none' ? '' : (s.name ?? s.kind.charAt(0).toUpperCase() + s.kind.slice(1));
        return (
          <div key={i} className={i === peak ? 'd' : ''} style={{ width: `${w * 100}%` }}>
            {w > 0.13 ? name : w > 0.045 ? (SHORT[s.kind] ?? '') : ''}
          </div>
        );
      })}
    </div>
  );
}
