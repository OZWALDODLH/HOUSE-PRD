// The menu bar of a real program: Archivo, Editar, Agregar, Ver, Ayuda.
// Click to open; with one open, pointing at another switches; arrows move,
// Enter picks, Esc closes.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { redo, undo, useStudio, trackById, duplicateTrack, removeTrack, clearTrack, getProject } from '../state/store';
import { openDialog, toast, useUi, TAB_KEY, TAB_NAME, type Tab } from '../state/ui';
import { goHome, newBlankProject, openProjectFromDisk, saveProjectFile, setView, toggleDock, toggleNav } from '../state/actions';
import { saveNow } from '../state/persist';
import { openVisuals } from '../visuals/link';
import { importAudio, openAudioEditorForTrack } from '../state/audioEdit';
import { startTutorial } from '../tutorial/tourState';
import { genreById } from '../state/templates';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** "Ctrl+S" or "⌘S", as the computer writes it. */
export const shortcut = (keys: string): string => (MAC ? keys.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥') : keys);

type Item =
  | { sep: true }
  | {
      sep?: false;
      label: string;
      keys?: string;
      disabled?: boolean;
      checked?: boolean;
      run: () => void;
    };

interface MenuDef {
  id: string;
  label: string;
  items: () => Item[];
}

function useMenus(): MenuDef[] {
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const ui = useUi();
  const views: Tab[] = ['patron', 'arreglo', 'mezcla', 'piano'];
  return [
    {
      id: 'archivo',
      label: 'Archivo',
      items: () => [
        { label: 'Proyecto en blanco', keys: 'Ctrl+N', run: newBlankProject },
        { label: 'Nuevo desde plantilla…', run: () => openDialog('plantillas') },
        { sep: true },
        { label: 'Abrir de tus proyectos…', keys: 'Ctrl+O', run: () => openDialog('proyectos') },
        { label: 'Abrir archivo .house…', run: () => void openProjectFromDisk() },
        { sep: true },
        {
          label: 'Guardar',
          keys: 'Ctrl+S',
          run: () => {
            const ok = saveNow();
            toast(ok ? 'Proyecto guardado.' : 'No pude guardar: tu navegador no deja usar el almacenamiento.', ok ? 'bien' : 'error');
          },
        },
        { label: 'Guardar como archivo…', keys: 'Ctrl+Shift+S', run: () => void saveProjectFile(getProject()) },
        { sep: true },
        { label: 'Importar audio…', keys: 'Ctrl+I', run: () => void importAudio() },
        { label: 'Exportar canción…', keys: 'Ctrl+E', run: () => openDialog('exportar') },
        { sep: true },
        { label: 'Ir al inicio', run: goHome },
      ],
    },
    {
      id: 'editar',
      label: 'Editar',
      items: () => {
        const t = trackById(getProject(), ui.selected);
        return [
          { label: 'Deshacer', keys: 'Ctrl+Z', disabled: !canUndo, run: () => void undo() },
          { label: 'Rehacer', keys: 'Ctrl+Shift+Z', disabled: !canRedo, run: () => void redo() },
          { sep: true },
          {
            label: t ? `Duplicar “${t.name}”` : 'Duplicar pista',
            keys: 'Ctrl+D',
            disabled: !t,
            run: () => {
              if (!t) return;
              const id = duplicateTrack(t.id);
              if (id) useUi.getState().set({ selected: id });
              else toast('Ya tienes 32 pistas. Borra una para duplicar.', 'error');
            },
          },
          { label: t ? `Limpiar pasos de “${t.name}”` : 'Limpiar pasos', disabled: !t, run: () => t && clearTrack(t.id) },
          {
            label: t ? `Borrar “${t.name}”` : 'Borrar pista',
            disabled: !t,
            run: () => {
              if (!t) return;
              removeTrack(t.id);
              useUi.getState().set({ selected: getProject().tracks[0]?.id ?? null });
              toast(`Borraste ${t.name}. Ctrl+Z para regresarla.`, 'info');
            },
          },
          { sep: true },
          { label: 'Editar el audio de la pista…', disabled: !t || t.kind !== 'sampler', run: () => t && openAudioEditorForTrack(t.id) },
        ];
      },
    },
    {
      id: 'agregar',
      label: 'Agregar',
      items: () => [
        {
          label: 'Sonido del navegador',
          run: () => {
            useUi.getState().set({ nav: true, navTab: 'sonidos' });
            requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.navegador input[type="search"]')?.focus());
          },
        },
        { label: 'Grabar voz o sonido…', keys: 'Ctrl+R', run: () => openDialog('grabar') },
        { label: 'Importar audio…', keys: 'Ctrl+I', run: () => void importAudio() },
        { sep: true },
        { label: 'Sección en la canción', run: () => setView('arreglo') },
        { label: 'Acordes (piano roll)', run: () => setView('piano') },
        { label: 'Efecto para la pista', run: () => useUi.getState().set({ nav: true, navTab: 'efectos' }) },
      ],
    },
    {
      id: 'ver',
      label: 'Ver',
      items: () => [
        ...views.map((v): Item => ({ label: TAB_NAME[v], keys: TAB_KEY[v], checked: ui.tab === v, run: () => setView(v) })),
        { sep: true },
        { label: 'Navegador', checked: ui.nav, run: toggleNav },
        { label: 'Instrumento y teclado', checked: ui.dock, run: toggleDock },
        { sep: true },
        { label: 'Visuales en otra ventana', keys: 'F6', run: () => openVisuals() },
        { label: 'Ajustes de visuales…', run: () => openDialog('visuales') },
        { sep: true },
        { label: 'Modo Pro (todas las perillas)', checked: ui.pro, run: () => ui.set({ pro: !ui.pro }) },
        { label: 'Menos movimiento', checked: ui.lessMotion, run: () => ui.set({ lessMotion: !ui.lessMotion }) },
      ],
    },
    {
      id: 'ayuda',
      label: 'Ayuda',
      items: () => [
        { label: 'Tutorial: aprende paso a paso', run: () => startTutorial() },
        { label: 'Atajos de teclado', keys: 'F12', run: () => openDialog('atajos') },
        { label: 'Salidas de audio…', run: () => openDialog('salidas') },
        { sep: true },
        { label: 'Acerca de HOUSE', run: () => openDialog('acerca') },
      ],
    },
  ];
}

export function MenuBar({ right }: { right?: ReactNode }) {
  const menus = useMenus();
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const p = useStudio((s) => s.project);
  const savedAt = useUi((s) => s.savedAt);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [open]);

  const focusItem = (dir: 1 | -1 | 0) => {
    const items = Array.from(bar.current?.querySelectorAll<HTMLButtonElement>('.menu-pop button:not(:disabled)') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = dir === 0 ? 0 : (i + dir + items.length) % items.length;
    items[next].focus();
  };

  const move = (dir: 1 | -1) => {
    const i = menus.findIndex((m) => m.id === open);
    const next = menus[(i + dir + menus.length) % menus.length];
    setOpen(next.id);
    requestAnimationFrame(() => focusItem(0));
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      const id = open;
      setOpen(null);
      bar.current?.querySelector<HTMLButtonElement>(`[data-menu="${id}"]`)?.focus();
    } else if (e.key === 'ArrowDown') focusItem(1);
    else if (e.key === 'ArrowUp') focusItem(-1);
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="barra-menus" ref={bar} onKeyDown={onKey}>
      <span className="marca" aria-hidden="true">
        HOUSE
      </span>
      <div role="menubar" aria-label="Menú de HOUSE" className="menus">
        {menus.map((m) => (
          <div key={m.id} className="menu-raiz">
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open === m.id}
              data-menu={m.id}
              data-tour={`menu-${m.id}`}
              className={open === m.id ? 'on' : ''}
              onClick={() => setOpen(open === m.id ? null : m.id)}
              onPointerEnter={() => open && open !== m.id && setOpen(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen(m.id);
                  requestAnimationFrame(() => focusItem(0));
                }
              }}
            >
              {m.label}
            </button>
            {open === m.id && (
              <div className="menu-pop" role="menu" aria-label={m.label}>
                {m.items().map((it, i) =>
                  it.sep ? (
                    <hr key={i} />
                  ) : (
                    <button
                      key={i}
                      role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                      aria-checked={it.checked}
                      disabled={it.disabled}
                      onClick={() => {
                        setOpen(null);
                        it.run();
                      }}
                    >
                      <span className="check" aria-hidden="true">
                        {it.checked ? '✓' : ''}
                      </span>
                      <span className="txt">{it.label}</span>
                      {it.keys && <kbd>{shortcut(it.keys)}</kbd>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="proyecto-nombre" onClick={() => openDialog('proyectos')} title="Tus proyectos">
        <b>{p.name}</b>
        <span>
          {genreById(p.genre).name}, <Guardado at={savedAt} />
        </span>
      </button>
      <div className="espacio" />
      {right}
    </div>
  );
}

function Guardado({ at }: { at: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (at < 0) return <>sin guardar</>;
  if (!at) return <>guardado</>;
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 5) return <>guardado ahora</>;
  if (s < 60) return <>guardado hace {s - (s % 5)} s</>;
  return <>guardado hace {Math.round(s / 60)} min</>;
}
