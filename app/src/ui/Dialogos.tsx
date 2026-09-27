// Floating windows: outputs, export, record, projects and shortcuts.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { bridgeIfReady, looksBluetooth, type OutputDevice } from '../engine/bridge';
import { MASTER, cmd } from '../engine/protocol';
import { resync, send, startAudio } from '../engine/audio';
import { encodeWav, measure, renderBars, renderProject } from '../engine/render';
import { Mic, listInputs, micError, type Input } from '../engine/mic';
import { addSamplerTrack, barsToSeconds, formatDuration, patternBars, rename, songBars, useStudio } from '../state/store';
import { closeDialog, toast, useUi } from '../state/ui';
import { decodeFile, freeSlot, prepareAudio, putSample } from '../state/samples';
import { deleteProject, listProjects, openProjectFile, openSaved, projectFile, safeFileName, saveNow } from '../state/persist';
import { canSaveFiles, saveFile, viewerDownloads } from '../state/files';
import { genreById } from '../state/templates';
import { markExported } from '../state/retos';
import { Icon } from './Icon';
import { Seg } from './controls';
import { MiniMarquesina } from './MiniMarquesina';

export function Dialogo({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, button:not([data-cerrar])')?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="velo" onPointerDown={(e) => e.target === e.currentTarget && closeDialog()}>
      <div className={`dialogo${wide ? ' ancho' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="surco-b">
          <h2>{title}</h2>
          <button className="btn icono" data-cerrar onClick={closeDialog} aria-label="Cerrar">
            <Icon name="cerrar" />
          </button>
        </header>
        <div className="contenido">{children}</div>
      </div>
    </div>
  );
}

/** The project as a file (.house; .house.json where only JSON can be saved). */
async function saveProjectFile(p: Parameters<typeof projectFile>[0]): Promise<void> {
  const inViewer = !!(await viewerDownloads());
  const res = await saveFile(projectFile(p), `${safeFileName(p.name)}${inViewer ? '.house.json' : '.house'}`);
  if (res === 'saved') toast('Proyecto guardado en un archivo.', 'bien');
  else if (res === 'unavailable') toast('Esta vista no deja guardar archivos. Usa la app de escritorio de HOUSE.', 'error', 6000);
}

export function Dialogos() {
  const d = useUi((s) => s.dialog);
  if (d === 'salidas') return <Salidas />;
  if (d === 'exportar') return <Exportar />;
  if (d === 'grabar') return <Grabar />;
  if (d === 'proyectos') return <Proyectos />;
  if (d === 'atajos') return <Atajos />;
  return null;
}

// -------------------------------------------------------------- salidas --

function Salidas() {
  const { outputs, set } = useUi();
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const b = bridgeIfReady();
  const second = b?.supportsSecondOutput() ?? false;

  useEffect(() => {
    void startAudio().then(async (br) => {
      if (!br) return;
      setDevices(await br.listOutputs());
      setLatency(br.latencyMs());
    });
  }, []);

  const master = devices.find((d) => d.id === outputs.master);
  const cue = devices.find((d) => d.id === outputs.cue);
  const bt = (master && looksBluetooth(master.name)) || (cue && looksBluetooth(cue.name));

  const apply = async (next: typeof outputs) => {
    set({ outputs: next });
    const br = await startAudio();
    if (!br) return;
    const err = await br.setRouting(next);
    setError(err);
    const cueApart = !err && !!next.cue && second;
    // The desktop engine restarts on new devices: give it the project again.
    if (br.kind === 'native') resync(cueApart);
    else send([cmd.master(MASTER.CUE_TO_MASTER, cueApart ? 0 : 1)]);
    setLatency(br.latencyMs());
    if (!err) toast('Salidas listas.', 'bien', 1800);
  };

  return (
    <Dialogo title="Salidas de audio">
      <p>
        <b>Master</b> es lo que oye todo mundo (la bocina). <b>Pre-escucha</b> es lo que oyes tú (audífonos): el metrónomo y los sonidos que pruebas en la lista.
      </p>
      <label className="etiqueta" htmlFor="sal-master">
        Master (bocina)
      </label>
      <select id="sal-master" className="campo-texto" value={outputs.master ?? 'default'} onChange={(e) => apply({ ...outputs, master: e.target.value })}>
        <option value="default">La salida del sistema</option>
        {devices
          .filter((d) => d.id !== 'default')
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
      </select>
      <label className="etiqueta" htmlFor="sal-cue">
        Pre-escucha (audífonos)
      </label>
      <select
        id="sal-cue"
        className="campo-texto"
        value={outputs.cue ?? ''}
        disabled={!second}
        onChange={(e) => apply({ ...outputs, cue: e.target.value || null })}
      >
        <option value="">Igual que el master</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {!second && <p>Para mandar la pre-escucha a otro aparato (bocina y audífonos por separado) usa la app de escritorio de HOUSE.</p>}
      {second && outputs.cue && (
        <>
          <label className="etiqueta" htmlFor="sal-alinear">
            Alinear salidas: {outputs.alignMs} ms
          </label>
          <input
            id="sal-alinear"
            type="range"
            min={0}
            max={300}
            step={5}
            value={outputs.alignMs}
            onChange={(e) => apply({ ...outputs, alignMs: Number(e.target.value) })}
          />
        </>
      )}
      {bt && (
        <div className="aviso" role="status">
          Parece una bocina o audífonos Bluetooth: tardan de 150 a 300 ms en sonar. Para escuchar está bien; para tocar pads o grabar, usa cable.
        </div>
      )}
      {error && (
        <div className="aviso error" role="alert">
          {error}
        </div>
      )}
      <p className="num">Retraso de salida: {latency ? `${Math.round(latency)} ms` : 'midiendo…'}</p>
    </Dialogo>
  );
}

// ------------------------------------------------------------- exportar --

function Exportar() {
  const p = useStudio((s) => s.project);
  const hasSong = p.sections.length > 0;
  const [what, setWhat] = useState<'cancion' | 'loop'>(hasSong && p.mode === 'cancion' ? 'cancion' : hasSong ? 'cancion' : 'loop');
  const [loopBars, setLoopBars] = useState(Math.max(4, patternBars(p)));
  const [bits, setBits] = useState<16 | 24>(16);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const bars = renderBars(p, { what, loopBars });
  const secs = barsToSeconds(bars, p.bpm);
  const [blocked, setBlocked] = useState(false);
  const [inViewer, setInViewer] = useState(false);
  useEffect(() => {
    void canSaveFiles().then((ok) => setBlocked(!ok));
    void viewerDownloads().then((d) => setInViewer(!!d));
  }, []);

  const go = async () => {
    setProgress(0);
    setDone(null);
    try {
      const r = await renderProject(p, { what, loopBars, onProgress: setProgress });
      const m = measure(r);
      const name = `${safeFileName(p.name)}${what === 'loop' ? '-loop' : ''}.wav`;
      const res = await saveFile(encodeWav(r, bits), name);
      const label = what === 'cancion' ? 'Canción exportada' : 'Loop exportado';
      if (res === 'saved') {
        setDone(`${label}: ${inViewer ? name.replace(/\.wav$/, '.zip') : name}. Pico ${m.peakDb.toFixed(1)} dB, volumen promedio ${m.rmsDb.toFixed(1)} dB.`);
        toast(`${label}.`, 'bien');
        markExported();
      } else if (res === 'declined') {
        toast('No se guardó el archivo.', 'info');
      } else {
        toast('Esta vista no deja guardar archivos. Usa la app de escritorio de HOUSE.', 'error', 6000);
      }
    } catch (e) {
      console.error(e);
      toast('No pude exportar. Vuelve a intentar; si sigue fallando, guarda el proyecto y reinicia la app.', 'error', 6000);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialogo title={what === 'cancion' ? 'Exportar canción' : 'Exportar loop'}>
      {hasSong && (
        <button className={`opcion${what === 'cancion' ? ' sel' : ''}`} onClick={() => setWhat('cancion')} aria-pressed={what === 'cancion'}>
          <Icon name="exportar" />
          <div>
            <b>Canción completa</b>
            <small className="num">
              {songBars(p)} compases, {formatDuration(barsToSeconds(songBars(p), p.bpm))}, con todas las secciones
            </small>
          </div>
        </button>
      )}
      <button className={`opcion${what === 'loop' ? ' sel' : ''}`} onClick={() => setWhat('loop')} aria-pressed={what === 'loop'}>
        <Icon name="bucle" />
        <div>
          <b>Loop</b>
          <small>El patrón repetido, para usarlo en otra app o en tu set</small>
        </div>
        {what === 'loop' && (
          <Seg
            small
            label="Compases del loop"
            value={String(loopBars)}
            onChange={(v) => setLoopBars(Number(v))}
            options={[4, 8, 16].map((n) => ({ id: String(n), text: `${n}` }))}
          />
        )}
      </button>
      <Seg
        label="Calidad"
        value={String(bits)}
        onChange={(v) => setBits(Number(v) as 16 | 24)}
        options={[
          { id: '16', text: 'WAV 16 bits (para compartir)' },
          { id: '24', text: 'WAV 24 bits (para mezclar)' },
        ]}
      />
      {progress !== null && (
        <div className="barra-progreso" role="progressbar" aria-valuenow={Math.round(progress * 100)} style={{ '--p': progress } as CSSProperties}>
          <i />
        </div>
      )}
      {done && <div className="aviso" style={{ background: 'var(--verde)' }}>{done}</div>}
      {blocked && (
        <div className="aviso" role="status">
          En esta vista no se pueden bajar archivos. Para exportar tu canción usa la app de escritorio de HOUSE.
        </div>
      )}
      {inViewer && !blocked && <p>Aquí el WAV llega dentro de un archivo .zip; ábrelo y ahí está tu canción.</p>}
      <div className="acciones">
        <button className="btn" disabled={blocked} onClick={() => void saveProjectFile(p)}>
          <Icon name="guardar" size={16} />
          Guardar proyecto (.house)
        </button>
        <button className="btn rosa" onClick={go} disabled={progress !== null || blocked}>
          <Icon name="exportar" size={16} />
          {progress !== null ? `Exportando ${Math.round(progress * 100)}%` : what === 'cancion' ? `Exportar canción (${formatDuration(secs)})` : `Exportar loop (${formatDuration(secs)})`}
        </button>
      </div>
    </Dialogo>
  );
}

// --------------------------------------------------------------- grabar --

function Grabar() {
  const p = useStudio((s) => s.project);
  const { micId, set } = useUi();
  const [inputs, setInputs] = useState<Input[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'abriendo' | 'listo' | 'grabando' | 'toma'>('abriendo');
  const [take, setTake] = useState<{ data: Float32Array; sr: number } | null>(null);
  const [secs, setSecs] = useState(0);
  const mic = useRef<Mic | null>(null);
  const level = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const m = new Mic();
    mic.current = m;
    let raf = 0;
    const tick = () => {
      const el = level.current;
      if (el) {
        const v = Math.min(1, m.level * 1.1);
        el.style.setProperty('--p', String(v));
        el.className = v > 0.95 ? 'satura' : v > 0.7 ? 'fuerte' : '';
      }
      m.level *= 0.92;
      raf = requestAnimationFrame(tick);
    };
    m.open(micId)
      .then(async () => {
        setInputs(await listInputs());
        setState('listo');
        tick();
      })
      .catch((e) => {
        setError(micError(e));
        setState('listo');
      });
    return () => {
      cancelAnimationFrame(raf);
      m.close();
    };
  }, [micId]);

  useEffect(() => {
    if (state !== 'grabando') return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setSecs(s);
      if (s >= 20) void stopRec();
    }, 100);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !take) return;
    const g = c.getContext('2d')!;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, w, h);
    g.fillStyle = getComputedStyle(c).getPropertyValue('--rosa') || '#F0168A';
    const per = Math.max(1, Math.floor(take.data.length / w));
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = x * per; i < (x + 1) * per && i < take.data.length; i += 2) m = Math.max(m, Math.abs(take.data[i]));
      const bh = Math.max(1, m * h * 0.9);
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }, [take]);

  const startRec = () => {
    setTake(null);
    setSecs(0);
    mic.current?.start();
    setState('grabando');
  };
  const stopRec = async () => {
    const m = mic.current;
    if (!m) return;
    const raw = await m.stop();
    const data = prepareAudio([raw], m.sampleRate);
    if (data.length < m.sampleRate * 0.05) {
      setError('No se oyó nada. Acércate al micrófono o súbele el volumen de entrada en tu sistema.');
      setState('listo');
      return;
    }
    setError(null);
    setTake({ data, sr: m.sampleRate });
    setState('toma');
  };
  const listen = async () => {
    if (!take) return;
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, take.data.length, take.sr);
    buf.copyToChannel(new Float32Array(take.data), 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => void ctx.close();
    src.start();
  };
  const keepTake = async (data: Float32Array, sr: number, name: string, family: 'voz' | 'samples') => {
    const slot = freeSlot(p);
    if (slot < 0 || p.tracks.length >= 16) {
      toast('Ya tienes 16 pistas. Borra una para agregar tu audio.', 'error');
      return;
    }
    await startAudio();
    const id = addSamplerTrack(name, slot, family);
    if (!id) return;
    await putSample(p.id, slot, { data, sr, name });
    set({ selected: id, dialog: null });
    toast(`Listo: “${name}” está en un pad. Prende sus pasos o tócalo con tu teclado.`, 'bien', 4000);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { data, sr } = await decodeFile(f);
      await keepTake(data, sr, f.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Sample', 'samples');
    } catch {
      setError('No pude abrir ese archivo. Prueba con WAV, MP3, OGG o M4A.');
    }
  };

  const voices = p.tracks.filter((t) => t.family === 'voz').length;

  return (
    <Dialogo title="Grabar voz o sonido">
      <div
        style={{ display: 'contents' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        <label className="etiqueta" htmlFor="mic">
          Micrófono
        </label>
        <select id="mic" className="campo-texto" value={micId ?? ''} onChange={(e) => set({ micId: e.target.value || null })}>
          <option value="">El micrófono del sistema</option>
          {inputs
            .filter((i) => i.id !== 'default')
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </select>
        <div className="nivel-grande" aria-label="Nivel del micrófono" role="img">
          <span className="zona" title="Zona buena" />
          <i ref={level} />
        </div>
        <p>Habla o canta y mira la barra: lo ideal es que llegue al recuadro sin pasarse al final.</p>
        {error && (
          <div className="aviso error" role="alert">
            {error}
          </div>
        )}
        {take && <canvas ref={canvas} className="onda-toma" aria-label="Forma de onda de la toma" />}
        <div className="acciones" style={{ justifyContent: 'flex-start' }}>
          {state === 'grabando' ? (
            <button className="btn rosa grande" onClick={() => void stopRec()}>
              <Icon name="stop" size={16} />
              Parar ({secs.toFixed(1)} s)
            </button>
          ) : (
            <button className="btn rosa grande" onClick={startRec} disabled={state === 'abriendo' || !!(error && !take && state !== 'listo')}>
              <Icon name="rec" size={18} />
              {take ? 'Grabar otra toma' : 'Grabar toma'}
            </button>
          )}
          {take && state === 'toma' && (
            <>
              <button className="btn grande" onClick={() => void listen()}>
                <Icon name="play" size={16} />
                Escuchar
              </button>
              <button className="btn claro grande" onClick={() => void keepTake(take.data, take.sr, `Voz ${voices + 1}`, 'voz')}>
                <Icon name="listo" size={16} />
                Usar en un pad
              </button>
            </>
          )}
        </div>
        <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--tinta-3)' }}>¿Ya tienes el audio? Arrástralo aquí o</span>
          <button className="btn" onClick={() => file.current?.click()}>
            <Icon name="carpeta" size={16} />
            Importar audio
          </button>
          <input ref={file} type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>
    </Dialogo>
  );
}

// ------------------------------------------------------------ proyectos --

function Proyectos() {
  const p = useStudio((s) => s.project);
  const set = useUi((s) => s.set);
  const [list, setList] = useState(() => listProjects());
  const [confirming, setConfirming] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <Dialogo title="Tus proyectos" wide>
      <label className="etiqueta" htmlFor="nombre">
        Nombre de este proyecto
      </label>
      <input id="nombre" className="campo-texto" defaultValue={p.name} maxLength={48} onBlur={(e) => rename(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      <div className="acciones" style={{ justifyContent: 'flex-start' }}>
        <button
          className="btn"
          onClick={() => {
            saveNow();
            set({ screen: 'inicio', dialog: null });
          }}
        >
          <Icon name="mas" size={16} />
          Nuevo proyecto
        </button>
        <button className="btn" onClick={() => file.current?.click()}>
          <Icon name="carpeta" size={16} />
          Abrir archivo
        </button>
        <button className="btn" onClick={() => void saveProjectFile(p)}>
          <Icon name="guardar" size={16} />
          Guardar archivo
        </button>
        <input
          ref={file}
          type="file"
          accept=".house,.json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const err = await openProjectFile(f);
            if (err) toast(err, 'error');
            else {
              set({ dialog: null, selected: null, selectedSection: null });
              toast('Proyecto abierto.', 'bien');
            }
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {list.map((m) => (
          <div key={m.id} className="proy" style={{ outline: m.id === p.id ? '2px solid var(--tinta)' : undefined, outlineOffset: 2 }}>
            <MiniMarquesina sections={m.sections} />
            <b>{m.name}</b>
            <small>
              {genreById(m.genre).name}, {m.bpm} BPM
            </small>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn chico"
                disabled={m.id === p.id}
                onClick={async () => {
                  saveNow();
                  if (await openSaved(m.id)) {
                    set({ dialog: null, selected: null, selectedSection: null });
                    toast(`Abriste ${m.name}.`, 'bien');
                  }
                }}
              >
                {m.id === p.id ? 'Abierto' : 'Abrir'}
              </button>
              {m.id !== p.id &&
                (confirming === m.id ? (
                  <button
                    className="btn chico rosa"
                    onClick={() => {
                      deleteProject(m.id);
                      setConfirming(null);
                      setList(listProjects());
                      toast(`Borraste ${m.name}.`, 'info');
                    }}
                    onBlur={() => setConfirming(null)}
                    autoFocus
                  >
                    Sí, borrar
                  </button>
                ) : (
                  <button className="btn chico icono" aria-label={`Borrar ${m.name}`} title="Borrar proyecto (no se puede deshacer)" onClick={() => setConfirming(m.id)}>
                    <Icon name="basura" size={14} />
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Dialogo>
  );
}

// --------------------------------------------------------------- atajos --

function Atajos() {
  const rows: [string, string][] = [
    ['Espacio', 'Reproducir o parar'],
    ['Tab', 'Prender o apagar el teclado musical'],
    ['1 a V', 'Tus pistas (pads del banco A)'],
    ['7 a -', 'Notas del bajo o sinte elegido (banco B)'],
    ['Shift + tecla', 'Golpe con acento'],
    ['Ctrl + Z', 'Deshacer'],
    ['Ctrl + Shift + Z', 'Rehacer'],
    ['Ctrl + S', 'Guardar ahora (también se guarda solo)'],
    ['Ctrl + E', 'Exportar canción'],
    ['F1 / F3', 'Patrón / Mezcla'],
    ['F6', 'Visuales'],
    ['Esc', 'Cerrar ventanas y soltar el foco'],
  ];
  return (
    <Dialogo title="Atajos de teclado">
      <div className="atajos">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <kbd>{k}</kbd>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </Dialogo>
  );
}
