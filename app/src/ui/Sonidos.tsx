// Sound browser: search, family chips, listen with a click, add with a double
// click, the + button, or by dragging onto the tracks or a pad.
import { useMemo, useRef, useState } from 'react';
import { FAMILY_NAME, SOUNDS, type Sound } from '../state/instruments';
import { keyName, type Family } from '../state/model';
import { addTrack, useStudio } from '../state/store';
import { genreById } from '../state/templates';
import { openDialog, toast, useUi } from '../state/ui';
import { previewSound } from '../engine/audio';
import { INK, Pict } from './Pict';
import { Icon } from './Icon';

const FAMILIES: Family[] = ['bateria', 'bajo', 'sintes', 'voz', 'samples', 'efectos'];

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function Sonidos() {
  const p = useStudio((s) => s.project);
  const set = useUi((s) => s.set);
  const [q, setQ] = useState('');
  const [fam, setFam] = useState<Family | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const words = plain(q).split(/\s+/).filter(Boolean);
    return SOUNDS.filter((s) => (!fam || s.family === fam) && words.every((w) => plain(`${s.name} ${s.desc} ${FAMILY_NAME[s.family]}`).includes(w)));
  }, [q, fam]);

  const add = (s: Sound) => {
    const id = addTrack(s);
    if (!id) {
      toast('Ya tienes 32 pistas. Borra una para agregar otra.', 'error');
      return;
    }
    set({ selected: id });
    toast(`Agregaste ${s.name}. Prende sus pasos para que suene.`, 'bien', 2600);
  };

  const g = genreById(p.genre);

  return (
    <aside className="sonidos surco-r" aria-label="Sonidos">
      <h2>Sonidos</h2>
      <label className="buscar">
        <Icon name="buscar" size={14} />
        <span className="oculto">Buscar sonidos</span>
        <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar sonidos" onKeyDown={(e) => e.key === 'Escape' && (setQ(''), e.currentTarget.blur())} />
      </label>
      <div className="chips" role="group" aria-label="Familias">
        {FAMILIES.map((f) => (
          <button key={f} className={`chip${fam === f ? ' on' : ''}`} aria-pressed={fam === f} onClick={() => setFam(fam === f ? null : f)}>
            <span className="dot" style={{ background: INK[f] }} />
            {FAMILY_NAME[f]}
          </button>
        ))}
      </div>
      <div className="estilo">
        <span>
          Estilo: <b>{g.name}</b>
        </span>
        <span className="num">
          {p.bpm} BPM, {keyName(p.key)}
        </span>
      </div>
      <div className="lista" role="list">
        {list.map((s) => (
          <div
            key={s.id}
            role="listitem"
            className={`item${sel === s.id ? ' sel' : ''}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/house-sound', s.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              setSel(s.id);
              previewSound(s);
            }}
            onDoubleClick={() => add(s)}
            title="Clic para escuchar, doble clic para agregar"
          >
            <Pict pict={s.pict} family={s.family} />
            <div style={{ minWidth: 0 }}>
              <div className="nom">{s.name}</div>
              <div className="desc">{s.desc}</div>
            </div>
            <button
              className="agregar"
              aria-label={`Agregar ${s.name}`}
              onClick={(e) => {
                e.stopPropagation();
                add(s);
              }}
            >
              <Icon name="mas" size={16} />
            </button>
          </div>
        ))}
        {!list.length && <p style={{ color: 'var(--tinta-2)', margin: '8px 2px' }}>No encontré sonidos con “{q}”. Prueba con otra palabra.</p>}
      </div>
      <div className="pie">
        <button className="btn rosa" onClick={() => openDialog('grabar')}>
          <Icon name="micro" size={16} />
          Grabar mi voz o un sonido
        </button>
        <span>Arrastra un sonido a una pista o a un pad vacío.</span>
      </div>
    </aside>
  );
}
