// The instrument of the selected track: preset, big knobs, pump switch, a
// small screen that draws what the knobs do, and (in Pro) the track effects.
import { useMemo, useState } from 'react';
import { EASY_COUNT, INSTRUMENT_NAME, MACROS, PRESETS, SOUNDS } from '../state/instruments';
import { applyPreset, clearTrack, duplicateTrack, moveTrack, removeTrack, setLength, setParam, setSidechain, setTrack, togglePump, trackById, useStudio } from '../state/store';
import { rollDice } from '../state/dice';
import { toast, useUi } from '../state/ui';
import { getSample } from '../state/samples';
import type { Track } from '../state/model';
import { INK, Pict } from './Pict';
import { Menu } from './Menu';
import { Icon } from './Icon';
import { Knob, Seg, Switch } from './controls';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const eqToKnob = (db: number) => (db <= 0 ? 0.5 + db / 48 : 0.5 + db / 24);
export const knobToEq = (v: number) => Math.round((v <= 0.5 ? (v - 0.5) * 48 : (v - 0.5) * 24) * 2) / 2;
export const eqText = (db: number) => (Math.abs(db) < 0.25 ? '0 dB' : `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`);
export const filterText = (v: number) => (Math.abs(v - 0.5) < 0.015 ? 'Abierto' : v < 0.5 ? `Opaco ${Math.round((0.5 - v) * 200)}%` : `Delgado ${Math.round((v - 0.5) * 200)}%`);
export const panText = (p: number) => (Math.abs(p) < 0.02 ? 'Centro' : p < 0 ? `Izq ${Math.round(-p * 100)}` : `Der ${Math.round(p * 100)}`);

/** Presets for a track: sound variations for drums, synth presets for the rest. */
function presetNames(t: Track): string[] {
  if (t.kind === 'drum') return SOUNDS.filter((s) => s.kind === 'drum' && s.pict === t.pict).map((s) => s.name);
  return PRESETS[t.kind].map((p) => p.name);
}

function choosePreset(t: Track, name: string): void {
  if (t.kind !== 'drum') {
    applyPreset(t.id, name);
    return;
  }
  const s = SOUNDS.find((x) => x.kind === 'drum' && x.name === name);
  if (s) setTrack(t.id, { params: [...s.params], model: s.model, preset: s.name, desc: s.name === t.name ? s.desc : s.name }, null);
}

export function Instrumento() {
  const p = useStudio((s) => s.project);
  const { selected, pro, set } = useUi();
  const t = trackById(p, selected) ?? p.tracks[0];
  const [side, setSide] = useState<'sonido' | 'efectos'>('sonido');
  if (!t) {
    return (
      <div className="instrumento surco-r">
        <p style={{ color: 'var(--tinta-2)', margin: 0 }}>Agrega un sonido de la lista para empezar.</p>
      </div>
    );
  }
  const names = presetNames(t);
  const current = Math.max(0, names.indexOf(t.preset));
  const step = (d: number) => names.length > 1 && choosePreset(t, names[(current + d + names.length) % names.length]);
  const macros = MACROS[t.kind];
  const shown = pro ? macros : macros.slice(0, EASY_COUNT[t.kind]);
  const ink = INK[t.family];
  const isSource = p.sidechainTrack === t.id;
  const index = p.tracks.findIndex((x) => x.id === t.id);

  return (
    <div className="instrumento surco-r">
      <div className="cab-inst">
        <Pict pict={t.pict} family={t.family} size={34} />
        <h3>{t.kind === 'drum' ? t.name : INSTRUMENT_NAME[t.kind]}</h3>
        <div className="preset" aria-label="Preset">
          <button onClick={() => step(-1)} aria-label="Preset anterior" disabled={names.length < 2}>
            <Icon name="izq" size={12} />
          </button>
          <span>{t.preset}</span>
          <button onClick={() => step(1)} aria-label="Preset siguiente" disabled={names.length < 2}>
            <Icon name="der" size={12} />
          </button>
        </div>
        <button
          className="btn chico"
          onClick={() => {
            rollDice(t.id);
            toast(`Nuevo patrón para ${t.name}. Ctrl+Z para regresar.`, 'info', 2400);
          }}
          title="Genera un patrón nuevo dentro del estilo y la escala"
        >
          <Icon name="dados" size={14} />
          Dados
        </button>
        <LargoPista t={t} />
        <Menu label={<>Pista <Icon name="abajo" size={12} /></>} title="Mover, duplicar o borrar esta pista" align="right" wrap="empuja">
          {(close) => (
            <>
              <button role="menuitem" disabled={index <= 0} onClick={() => (moveTrack(t.id, -1), close())}>
                <Icon name="arriba" size={14} />
                Subir
              </button>
              <button role="menuitem" disabled={index >= p.tracks.length - 1} onClick={() => (moveTrack(t.id, 1), close())}>
                <Icon name="abajo" size={14} />
                Bajar
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  close();
                  const id = duplicateTrack(t.id);
                  if (id) set({ selected: id });
                  else toast('Ya tienes 32 pistas. Borra una para duplicar.', 'error');
                }}
              >
                <Icon name="duplicar" size={14} />
                Duplicar
              </button>
              <button role="menuitem" onClick={() => (clearTrack(t.id), close())}>
                <Icon name="limpiar" size={14} />
                Limpiar pasos
              </button>
              <hr />
              <button
                role="menuitem"
                onClick={() => {
                  close();
                  const next = p.tracks[index + 1] ?? p.tracks[index - 1];
                  removeTrack(t.id);
                  set({ selected: next?.id ?? null });
                  toast(`Borraste ${t.name}. Ctrl+Z para regresarla.`, 'info');
                }}
              >
                <Icon name="basura" size={14} />
                Borrar pista
              </button>
            </>
          )}
        </Menu>
        {pro && (
          <Seg
            small
            label="Qué ajustas"
            value={side}
            onChange={setSide}
            options={[
              { id: 'sonido', text: 'Sonido' },
              { id: 'efectos', text: 'Efectos' },
            ]}
          />
        )}
      </div>
      <div className="cuerpo-inst">
        <div className="col-perillas">
          {pro && side === 'efectos' ? (
            <Efectos t={t} />
          ) : (
            <div className="perillas">
              {shown.map((m, i) => {
                const k = m.idx ?? i;
                return (
                  <Knob
                    key={m.pro}
                    label={m.name}
                    pro={m.pro}
                    showPro
                    size={pro ? 'm' : 'l'}
                    value={t.params[k] ?? 0.5}
                    def={0.5}
                    ink={ink}
                    text={pct(t.params[k] ?? 0.5)}
                    onChange={(v) => setParam(t.id, k, v)}
                  />
                );
              })}
            </div>
          )}
          {!(pro && side === 'efectos') && (
            <div className="bombeo">
              <svg width="46" height="22" viewBox="0 0 46 22" aria-hidden="true">
                <path d="M1 20 L1 4 Q4 20 11 20 L12 4 Q15 20 22 20 L23 4 Q26 20 33 20 L34 4 Q37 20 44 20" fill="none" stroke={ink} strokeWidth="2" />
              </svg>
              {isSource ? (
                <>
                  <div>
                    <b>Este sonido marca el bombeo</b>
                    <small>Las pistas con bombeo se apartan cuando suena</small>
                  </div>
                  <Switch on label="Fuente del bombeo" ink={ink} onChange={() => setSidechain(null)} />
                </>
              ) : (
                <>
                  <div>
                    <b>Bombeo con el bombo</b>
                    <small>{t.duck > 0 ? 'Se aparta cada vez que pega el bombo (sidechain)' : 'Actívalo para que respire con el bombo (sidechain)'}</small>
                  </div>
                  <Switch on={t.duck > 0} label="Bombeo con el bombo" ink={ink} onChange={() => togglePump(t.id)} />
                </>
              )}
            </div>
          )}
        </div>
        <Visor t={t} ink={ink} />
      </div>
    </div>
  );
}

function LargoPista({ t }: { t: Track }) {
  return (
    <Menu label={`${t.length} pasos`} title="Largo del patrón de esta pista">
      {(close) =>
        [8, 16, 32, 64].map((n) => (
          <button
            key={n}
            role="menuitemradio"
            aria-checked={t.length === n}
            className={t.length === n ? 'on' : ''}
            onClick={() => {
              setLength(t.id, n);
              close();
            }}
          >
            {n} pasos ({n === 8 ? 'medio compás' : n === 16 ? '1 compás' : `${n / 16} compases`})
          </button>
        ))
      }
    </Menu>
  );
}

function Efectos({ t }: { t: Track }) {
  const ink = INK[t.family];
  const setEq = (band: number, v: number) => {
    const eq = [...t.eq] as Track['eq'];
    eq[band] = knobToEq(v);
    setTrack(t.id, { eq }, `eq:${t.id}:${band}`);
  };
  return (
    <div className="perillas" style={{ maxWidth: 560 }}>
      <Knob label="Filtro" pro="DJ filter" showPro size="m" bipolar value={t.filter} def={0.5} ink={ink} text={filterText(t.filter)} onChange={(v) => setTrack(t.id, { filter: Math.abs(v - 0.5) < 0.015 ? 0.5 : v })} />
      <Knob label="Graves" pro="low shelf" showPro size="m" bipolar value={eqToKnob(t.eq[0])} def={0.5} ink={ink} text={eqText(t.eq[0])} onChange={(v) => setEq(0, v)} />
      <Knob label="Medios" pro="mid bell" showPro size="m" bipolar value={eqToKnob(t.eq[1])} def={0.5} ink={ink} text={eqText(t.eq[1])} onChange={(v) => setEq(1, v)} />
      <Knob label="Agudos" pro="high shelf" showPro size="m" bipolar value={eqToKnob(t.eq[2])} def={0.5} ink={ink} text={eqText(t.eq[2])} onChange={(v) => setEq(2, v)} />
      <Knob label="Saturación" pro="drive" showPro size="m" value={t.drive} def={0} ink={ink} text={pct(t.drive)} onChange={(drive) => setTrack(t.id, { drive })} />
      <Knob label="Espacio" pro="reverb" showPro size="m" value={t.sendRev} def={0} ink={ink} text={pct(t.sendRev)} onChange={(sendRev) => setTrack(t.id, { sendRev })} />
      <Knob label="Eco" pro="delay" showPro size="m" value={t.sendDel} def={0} ink={ink} text={pct(t.sendDel)} onChange={(sendDel) => setTrack(t.id, { sendDel })} />
      <Knob label="Paneo" pro="pan" showPro size="m" bipolar value={(t.pan + 1) / 2} def={0.5} ink={ink} text={panText(t.pan)} onChange={(v) => setTrack(t.id, { pan: Math.round((v * 2 - 1) * 100) / 100 })} />
    </div>
  );
}

// -------------------------------------------------------------- visor --

function Visor({ t, ink }: { t: Track; ink: string }) {
  const { label, path } = useMemo(() => drawFor(t), [t]);
  return (
    <div className="visor" aria-label={label}>
      <span className="et">{label}</span>
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        <path d={`${path} L300 120 L0 120Z`} fill={ink} opacity=".12" />
        <path d={path} fill="none" stroke={ink} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function drawFor(t: Track): { label: string; path: string } {
  const p = t.params;
  const pts: [number, number][] = [];
  if (t.kind === 'acid') {
    // Resonant low-pass response on a log frequency axis.
    const fc = 60 * 2 ** (p[0] * 8.2);
    const q = 0.7 + p[1] * 9;
    for (let x = 0; x <= 300; x += 3) {
      const f = 20 * 1000 ** (x / 300);
      const r = f / fc;
      const h = 1 / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2);
      const db = Math.max(-40, Math.min(18, 20 * Math.log10(h)));
      pts.push([x, 60 - db * 2.6]);
    }
    return { label: 'Filtro', path: toPath(pts) };
  }
  if (t.kind === 'poly' || t.kind === 'super' || t.kind === 'fm') {
    const a = 0.005 + p[1] * 1.2;
    const d = 0.25;
    const s = p[7];
    const r = 0.05 + p[2] * 1.8;
    const total = a + d + 0.5 + r;
    const X = (sec: number) => (sec / total) * 300;
    pts.push([0, 116], [X(a), 8], [X(a + d), 116 - s * 108], [X(a + d + 0.5), 116 - s * 108], [300, 116]);
    return { label: 'Envolvente', path: toPath(pts) };
  }
  if (t.kind === 'sampler') {
    const smp = t.sampleSlot !== undefined ? getSample(t.sampleSlot) : undefined;
    if (!smp) return { label: 'Sin audio todavía', path: 'M0 60 L300 60' };
    const cols = 150;
    const per = Math.max(1, Math.floor(smp.data.length / cols));
    const top: [number, number][] = [];
    for (let c = 0; c < cols; c++) {
      let m = 0;
      for (let i = c * per; i < (c + 1) * per && i < smp.data.length; i += 4) m = Math.max(m, Math.abs(smp.data[i]));
      top.push([(c / (cols - 1)) * 300, 60 - m * 54]);
    }
    return { label: `Audio: ${smp.name}`, path: toPath(top) };
  }
  // Drums and 808: loudness over time (tail length and punch).
  const tail = t.kind === 'bass808' ? 0.15 + p[0] * 1.6 : 0.05 + p[1] * 0.9;
  const punch = t.kind === 'bass808' ? p[1] : p[3];
  for (let x = 0; x <= 300; x += 4) {
    const sec = (x / 300) * 1.2;
    const env = Math.exp(-sec / (tail / 3)) * (1 + punch * 0.5 * Math.exp(-sec / 0.015));
    pts.push([x, 116 - Math.min(1.1, env) * 100]);
  }
  return { label: t.kind === 'bass808' ? 'Cola del 808' : 'Cola del golpe', path: toPath(pts) };
}

const toPath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
