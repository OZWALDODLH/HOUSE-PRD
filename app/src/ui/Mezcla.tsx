// Mixer: one strip per track and the master with its volume target.
import type { CSSProperties } from 'react';
import { ST } from '../engine/protocol';
import { useLive } from '../engine/live';
import { setMaster, setTarget, setTrack, togglePump, useStudio } from '../state/store';
import { useUi } from '../state/ui';
import type { Master, Track } from '../state/model';
import { INK, Pict } from './Pict';
import { Fader, Knob, Meter, Seg, Switch, dbText } from './controls';
import { filterText, panText } from './Instrumento';
import { EfectosMini } from './Efectos';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function Mezcla() {
  const p = useStudio((s) => s.project);
  const { selected, set } = useUi();
  return (
    <section className="mezcla" aria-label="Mezcla" data-tour="mezcla">
      <div className="canales">
        {!p.tracks.length && <p className="vacio-pistas">Aquí aparece un canal por cada pista, con su volumen, efectos y nivel.</p>}
        {p.tracks.map((t, i) => (
          <Canal key={t.id} t={t} index={i} sel={selected === t.id} onSelect={() => set({ selected: t.id })} source={p.sidechainTrack === t.id} />
        ))}
      </div>
      <MasterStrip m={p.master} />
    </section>
  );
}

function Canal({ t, index, sel, onSelect, source }: { t: Track; index: number; sel: boolean; onSelect: () => void; source: boolean }) {
  const ink = INK[t.family];
  return (
    <div className={`canal${sel ? ' sel' : ''}`} onPointerDown={onSelect} style={{ '--c': ink } as CSSProperties}>
      <div className="cab">
        <Pict pict={t.pict} family={t.family} size={18} />
        <b title={t.name}>{t.name}</b>
      </div>
      <EfectosMini t={t} tour={index === 0 ? 'fx-canal' : undefined} />
      <Knob size="s" label="Filtro" bipolar value={t.filter} def={0.5} ink={ink} text={filterText(t.filter)} onChange={(v) => setTrack(t.id, { filter: Math.abs(v - 0.5) < 0.015 ? 0.5 : v })} />
      <Knob size="s" label="Espacio" value={t.sendRev} def={0} ink={ink} text={pct(t.sendRev)} onChange={(sendRev) => setTrack(t.id, { sendRev })} />
      <Knob size="s" label="Eco" value={t.sendDel} def={0} ink={ink} text={pct(t.sendDel)} onChange={(sendDel) => setTrack(t.id, { sendDel })} />
      <div className="tira">
        <Meter vertical segments={48} read={(s) => s[ST.TRACK_PEAKS + index]} label={`Nivel de ${t.name}`} />
        <Fader vertical label={`Volumen de ${t.name}`} db={t.vol} onChange={(vol) => setTrack(t.id, { vol })} ink={ink} />
      </div>
      <span className="db num">{dbText(t.vol)}</span>
      <div className="fila-ms">
        <button className={`ms${t.mute ? ' on' : ''}`} aria-pressed={t.mute} onClick={() => setTrack(t.id, { mute: !t.mute }, null)} title="Silenciar (mute)">
          M
        </button>
        <button className={`ms${t.solo ? ' on' : ''}`} aria-pressed={t.solo} onClick={() => setTrack(t.id, { solo: !t.solo }, null)} title="Solo">
          S
        </button>
        <Knob compact label={`Paneo de ${t.name}`} value={(t.pan + 1) / 2} def={0.5} bipolar ink={ink} text={panText(t.pan)} onChange={(v) => setTrack(t.id, { pan: Math.round((v * 2 - 1) * 100) / 100 })} />
      </div>
      <div className="bombeo-mini">
        {source ? 'Marca el bombeo' : 'Bombeo'}
        {!source && <Switch on={t.duck > 0} label={`Bombeo de ${t.name}`} ink={ink} onChange={() => togglePump(t.id)} />}
      </div>
    </div>
  );
}

function MasterStrip({ m }: { m: Master }) {
  const gr = useLive((s) => Math.round(s[ST.LIMITER_GR] * 2) / 2);
  return (
    <aside className="master" aria-label="Master" data-tour="master">
      <div className="fila">
        <h3>Master</h3>
      </div>
      <div data-tour="destino">
      <Seg<Master['target']>
        small
        label="Destino del volumen"
        value={m.target}
        onChange={(t) => setTarget(t)}
        options={[
          { id: 'streaming', text: 'Streaming', title: 'Para Spotify, YouTube y redes' },
          { id: 'club', text: 'Club', title: 'Más fuerte, para bocinas grandes' },
          { id: 'maximo', text: 'Al máximo', title: 'Lo más fuerte posible' },
        ]}
      />
      </div>
      <div className="tira">
        <Meter vertical segments={64} read={(s) => s[ST.PEAK_L]} label="Nivel izquierdo" />
        <Meter vertical segments={64} read={(s) => s[ST.PEAK_R]} label="Nivel derecho" />
        <Fader vertical label="Volumen master" db={m.vol} onChange={(vol) => setMaster({ vol })} ink="var(--tinta)" />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Knob size="s" label="Pegamento" value={m.glue} def={0.35} text={pct(m.glue)} onChange={(glue) => setMaster({ glue })} />
          <span className="dato">
            Limitador <b className="num">{gr > 0.05 ? `−${gr.toFixed(1)} dB` : '0 dB'}</b>
          </span>
        </div>
      </div>
      <span className="dato num">
        Volumen <b>{dbText(m.vol)}</b>, techo <b>{dbText(m.ceiling)}</b>
      </span>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <Knob size="s" label="Espacio" value={m.reverbSize} def={0.55} text={pct(m.reverbSize)} onChange={(reverbSize) => setMaster({ reverbSize })} />
        <Knob
          size="s"
          label="Eco"
          value={(m.delaySteps - 1) / 5}
          def={0.4}
          text={m.delaySteps === 3 ? '3/16' : m.delaySteps === 2 ? '1/8' : m.delaySteps === 4 ? '1/4' : `${m.delaySteps}/16`}
          onChange={(v) => setMaster({ delaySteps: Math.round(1 + v * 5) })}
        />
        <Knob size="s" label="Repite" value={m.delayFeedback / 0.9} def={0.42} text={pct(m.delayFeedback / 0.9)} onChange={(v) => setMaster({ delayFeedback: Math.round(v * 0.9 * 100) / 100 })} />
      </div>
      <div className="linea-opcion">
        <div>
          <b>Subida automática</b>
          <small>En las subidas, un filtro abre poco a poco</small>
        </div>
        <Switch on={m.autoBuild} label="Subida automática" onChange={(autoBuild) => setMaster({ autoBuild }, null)} />
      </div>
    </aside>
  );
}
