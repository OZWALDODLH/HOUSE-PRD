// The browser: catalog sounds, your own samples and the effects. Click to
// listen, double click or + to add, or drag onto the tracks, a pad or a key.
import { useEffect, useMemo, useState } from 'react';
import { FAMILY_NAME, SOUNDS, type Sound } from '../state/instruments';
import type { Family } from '../state/model';
import { addEffect, addSamplerTrack, addTrack, assignSoundboard, getProject, trackById } from '../state/store';
import { openDialog, toast, useUi, type NavTab } from '../state/ui';
import { EFFECTS } from '../state/effects';
import { libraryAudio, refreshLibrary, removeFromLibrary, renameLibraryItem, useLibrary, type LibraryItem } from '../state/library';
import { importAudio, previewAudio, stopPreview, openAudioEditor } from '../state/audioEdit';
import { freeSlot, putSample } from '../state/samples';
import { previewSound, startAudio } from '../engine/audio';
import { INK, Pict } from './Pict';
import { Icon } from './Icon';
import { Menu } from './Menu';

const FAMILIES: Family[] = ['bateria', 'bajo', 'sintes', 'voz', 'samples', 'efectos'];

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const matches = (q: string, text: string) => {
  const words = plain(q).split(/\s+/).filter(Boolean);
  const t = plain(text);
  return words.every((w) => t.includes(w));
};

export function Navegador() {
  const navTab = useUi((s) => s.navTab);
  const set = useUi((s) => s.set);
  const tabs: { id: NavTab; text: string }[] = [
    { id: 'sonidos', text: 'Sonidos' },
    { id: 'samples', text: 'Mis samples' },
    { id: 'efectos', text: 'Efectos' },
  ];
  return (
    <aside className="navegador" aria-label="Navegador" data-tour="navegador">
      <div className="nav-pestanas" role="tablist" aria-label="Qué buscas">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={navTab === t.id} className={navTab === t.id ? 'on' : ''} onClick={() => set({ navTab: t.id })} data-tour={`nav-${t.id}`}>
            {t.text}
          </button>
        ))}
      </div>
      {navTab === 'sonidos' && <ListaSonidos />}
      {navTab === 'samples' && <ListaSamples />}
      {navTab === 'efectos' && <ListaEfectos />}
    </aside>
  );
}

function Buscar({ q, setQ, placeholder }: { q: string; setQ: (q: string) => void; placeholder: string }) {
  return (
    <label className="buscar">
      <Icon name="buscar" size={14} />
      <span className="oculto">{placeholder}</span>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Escape' && (setQ(''), e.currentTarget.blur())} />
    </label>
  );
}

// ---------------------------------------------------------------- sonidos --

function ListaSonidos() {
  const set = useUi((s) => s.set);
  const [q, setQ] = useState('');
  const [fam, setFam] = useState<Family | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const list = useMemo(() => SOUNDS.filter((s) => (!fam || s.family === fam) && matches(q, `${s.name} ${s.desc} ${FAMILY_NAME[s.family]}`)), [q, fam]);

  const add = (s: Sound) => {
    const id = addTrack(s);
    if (!id) {
      toast('Ya tienes 32 pistas. Borra una para agregar otra.', 'error');
      return;
    }
    set({ selected: id });
    toast(`Agregaste ${s.name}. Prende sus pasos para que suene.`, 'bien', 2600);
  };

  return (
    <>
      <Buscar q={q} setQ={setQ} placeholder="Buscar sonidos" />
      <div className="chips" role="group" aria-label="Familias">
        {FAMILIES.map((f) => (
          <button key={f} className={`chip${fam === f ? ' on' : ''}`} aria-pressed={fam === f} onClick={() => setFam(fam === f ? null : f)}>
            <span className="dot" style={{ background: INK[f] }} />
            {FAMILY_NAME[f]}
          </button>
        ))}
      </div>
      <div className="lista" role="list" data-tour="lista-sonidos">
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
            <Pict pict={s.pict} family={s.family} size={20} />
            <div className="nom-desc">
              <span className="nom">{s.name}</span>
              <span className="desc">{s.desc}</span>
            </div>
            <button
              className="agregar"
              aria-label={`Agregar ${s.name}`}
              title="Agregar como pista"
              onClick={(e) => {
                e.stopPropagation();
                add(s);
              }}
            >
              <Icon name="mas" size={14} />
            </button>
          </div>
        ))}
        {!list.length && <p className="vacio">No encontré sonidos con “{q}”. Prueba con otra palabra.</p>}
      </div>
      <div className="nav-pie">
        <button className="btn rosa" onClick={() => openDialog('grabar')} data-tour="grabar">
          <Icon name="micro" size={14} />
          Grabar voz o sonido
        </button>
      </div>
    </>
  );
}

// -------------------------------------------------------------- samples --

/** Puts a sample of the library in the project as a new pad. */
export async function librarySampleToTrack(id: string): Promise<string | null> {
  const got = await libraryAudio(id);
  if (!got) return null;
  const p = getProject();
  const slot = freeSlot(p);
  if (slot < 0) {
    toast('Ya usas todos los espacios de audio del proyecto.', 'error');
    return null;
  }
  await startAudio();
  const tid = addSamplerTrack(got.item.name, slot, got.item.family);
  if (!tid) {
    toast('Ya tienes 32 pistas. Borra una para agregar otra.', 'error');
    return null;
  }
  await putSample(p.id, slot, { data: got.data, sr: got.sr, name: got.item.name });
  useUi.getState().set({ selected: tid });
  return tid;
}

/** Puts a sample of the library on a Soundboard key. */
export async function librarySampleToKey(id: string, code: string): Promise<boolean> {
  const got = await libraryAudio(id);
  if (!got) return false;
  const p = getProject();
  const slot = freeSlot(p);
  if (slot < 0) {
    toast('Ya usas todos los espacios de audio del proyecto.', 'error');
    return false;
  }
  await startAudio();
  await putSample(p.id, slot, { data: got.data, sr: got.sr, name: got.item.name });
  assignSoundboard(code, { slot, name: got.item.name, family: got.item.family });
  toast(`“${got.item.name}” quedó en la tecla del Soundboard.`, 'bien');
  return true;
}

function ListaSamples() {
  const { items, ready } = useLibrary();
  const [q, setQ] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  useEffect(() => {
    void refreshLibrary();
    return () => stopPreview();
  }, []);
  const list = items.filter((i) => matches(q, i.name));
  const listen = async (i: LibraryItem) => {
    const got = await libraryAudio(i.id);
    if (got) previewAudio(got.data, got.sr);
  };
  const add = async (i: LibraryItem) => {
    if (await librarySampleToTrack(i.id)) toast(`Agregaste ${i.name} como pad.`, 'bien');
  };
  return (
    <>
      <Buscar q={q} setQ={setQ} placeholder="Buscar en Mis samples" />
      <div className="lista" role="list">
        {list.map((i) => (
          <div
            key={i.id}
            role="listitem"
            className="item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/house-sample', i.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => void listen(i)}
            onDoubleClick={() => void add(i)}
            title="Clic para escuchar, doble clic para agregar"
          >
            <Pict pict={i.family === 'voz' ? 'voz' : 'sample'} family={i.family} size={20} />
            <div className="nom-desc">
              {renaming === i.id ? (
                <input
                  className="campo-texto"
                  autoFocus
                  defaultValue={i.name}
                  maxLength={40}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    void renameLibraryItem(i.id, e.currentTarget.value);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="nom">{i.name}</span>
              )}
              <span className="desc num">{(i.length / i.sr).toFixed(1)} s</span>
            </div>
            <Menu className="agregar" label={<Icon name="abajo" size={12} />} title="Más opciones" align="right">
              {(close) => (
                <>
                  <button role="menuitem" onClick={() => (close(), void add(i))}>
                    Agregar como pad
                  </button>
                  <button
                    role="menuitem"
                    onClick={async () => {
                      close();
                      const got = await libraryAudio(i.id);
                      if (got) openAudioEditor({ data: got.data, sr: got.sr, name: got.item.name, family: got.item.family }, { kind: 'nuevo' }, { start: 0, end: 1 });
                    }}
                  >
                    Abrir en el editor…
                  </button>
                  <button role="menuitem" onClick={() => (close(), setRenaming(i.id))}>
                    Cambiar nombre
                  </button>
                  <hr />
                  <button role="menuitem" onClick={() => (close(), void removeFromLibrary(i.id), toast(`Borraste ${i.name} de Mis samples.`, 'info'))}>
                    Borrar de Mis samples
                  </button>
                </>
              )}
            </Menu>
          </div>
        ))}
        {ready && !items.length && <p className="vacio">Aquí se guardan los samples que hagas: graba tu voz o importa un audio, elige tu parte favorita y dale “Guardar en Mis samples”.</p>}
        {ready && !!items.length && !list.length && <p className="vacio">No encontré samples con “{q}”.</p>}
      </div>
      <div className="nav-pie">
        <button className="btn" onClick={() => void importAudio()}>
          <Icon name="carpeta" size={14} />
          Importar audio
        </button>
        <button className="btn rosa" onClick={() => openDialog('grabar')}>
          <Icon name="micro" size={14} />
          Grabar
        </button>
      </div>
    </>
  );
}

// -------------------------------------------------------------- efectos --

function ListaEfectos() {
  const selected = useUi((s) => s.selected);
  const [q, setQ] = useState('');
  const t = trackById(getProject(), selected);
  const list = EFFECTS.filter((f) => matches(q, `${f.name} ${f.desc}`));
  const add = (kind: number) => {
    if (!t) {
      toast('Primero elige una pista (clic en su nombre).', 'info');
      return;
    }
    const slot = addEffect(t.id, kind);
    if (slot < 0) toast(`${t.name} ya tiene dos efectos. Quita uno en la Mezcla o en el instrumento.`, 'error', 4000);
    else {
      toast(`Agregaste ${EFFECTS.find((e) => e.id === kind)?.name} a ${t.name}.`, 'bien');
      if (!useUi.getState().pro) useUi.getState().set({ pro: true });
    }
  };
  return (
    <>
      <Buscar q={q} setQ={setQ} placeholder="Buscar efectos" />
      <p className="nav-nota">{t ? <>Se agregan a <b>{t.name}</b>. También puedes arrastrarlos a cualquier pista.</> : 'Elige una pista y agrega un efecto, o arrástralo a una pista.'}</p>
      <div className="lista" role="list" data-tour="lista-efectos">
        {list.map((f) => (
          <div
            key={f.id}
            role="listitem"
            className="item efecto"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/house-fx', String(f.id));
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDoubleClick={() => add(f.id)}
            title="Doble clic o + para agregarlo a la pista elegida"
          >
            <span className="fx-ico" aria-hidden="true">
              <Icon name="ajustes" size={14} />
            </span>
            <div className="nom-desc">
              <span className="nom">{f.name}</span>
              <span className="desc">{f.desc}</span>
            </div>
            <button className="agregar" aria-label={`Agregar ${f.name}`} onClick={() => add(f.id)}>
              <Icon name="mas" size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/** Drop handler for a track row: sounds replace nothing, effects go in. */
export function dropOnTrack(trackId: string, data: DataTransfer): boolean {
  const fx = data.getData('text/house-fx');
  if (fx) {
    const slot = addEffect(trackId, Number(fx));
    const t = trackById(getProject(), trackId);
    if (slot < 0) toast(`${t?.name ?? 'La pista'} ya tiene dos efectos.`, 'error');
    else toast(`Efecto agregado a ${t?.name}.`, 'bien');
    return true;
  }
  if (data.files.length) {
    const t = trackById(getProject(), trackId);
    void importAudio(Array.from(data.files), t?.kind === 'sampler' ? { kind: 'pista', trackId } : { kind: 'nuevo' });
    return true;
  }
  return false;
}

