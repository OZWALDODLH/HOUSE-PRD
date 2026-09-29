// Insert effects of a track: two slots, each with its three knobs.
// Full size in the instrument panel, small buttons in the mixer strips.
import type { CSSProperties } from 'react';
import { EFFECTS, fxById, fxKnobText } from '../state/effects';
import { addEffect, removeEffect, setEffectKnob } from '../state/store';
import type { Track } from '../state/model';
import { INK } from './Pict';
import { Icon } from './Icon';
import { Knob } from './controls';
import { Menu } from './Menu';

function ElegirEfecto({ current, onPick }: { current?: number; onPick: (kind: number) => void }) {
  return (
    <>
      {EFFECTS.map((f) => (
        <button key={f.id} role="menuitemradio" aria-checked={current === f.id} className={`con-desc${current === f.id ? ' on' : ''}`} onClick={() => onPick(f.id)}>
          <b>{f.name}</b>
          <small>{f.desc}</small>
        </button>
      ))}
    </>
  );
}

/** Both slots of a track, as in the instrument panel. */
export function EfectosPista({ t }: { t: Track }) {
  return (
    <div className="fx-ranuras" data-tour="efectos-pista">
      {t.fx.map((_, i) => (
        <Ranura key={i} t={t} slot={i} />
      ))}
    </div>
  );
}

function Ranura({ t, slot }: { t: Track; slot: number }) {
  const f = t.fx[slot];
  const info = fxById(f.kind);
  const ink = INK[t.family];
  if (!info) {
    return (
      <div className="fx-ranura vacia">
        <span className="fx-n num" aria-hidden="true">
          {slot + 1}
        </span>
        <Menu
          className="btn"
          width={300}
          title="Pasa el sonido de esta pista por un efecto"
          label={
            <>
              <Icon name="mas" size={14} />
              Agregar efecto
            </>
          }
        >
          {(close) => (
            <ElegirEfecto
              onPick={(k) => {
                addEffect(t.id, k, slot);
                close();
              }}
            />
          )}
        </Menu>
      </div>
    );
  }
  return (
    <div className="fx-ranura" style={{ '--c': ink } as CSSProperties}>
      <header>
        <span className="fx-n num" aria-hidden="true">
          {slot + 1}
        </span>
        <Menu
          className="btn chico"
          width={300}
          title="Cambiar el efecto"
          label={
            <>
              {info.name}
              <Icon name="abajo" size={12} />
            </>
          }
        >
          {(close) => (
            <ElegirEfecto
              current={f.kind}
              onPick={(k) => {
                if (k !== f.kind) addEffect(t.id, k, slot);
                close();
              }}
            />
          )}
        </Menu>
        <button className="btn chico icono" onClick={() => removeEffect(t.id, slot)} aria-label={`Quitar ${info.name}`} title="Quitar efecto">
          <Icon name="basura" size={12} />
        </button>
      </header>
      <div className="perillas">
        {info.knobs.map((name, k) => (
          <Knob key={name} size="s" label={name} value={f.knobs[k]} def={info.defaults[k]} ink={ink} text={fxKnobText(f.kind, k, f.knobs[k])} onChange={(v) => setEffectKnob(t.id, slot, k, v)} />
        ))}
      </div>
    </div>
  );
}

/** Two small buttons for a mixer strip; each opens its effect's knobs. */
export function EfectosMini({ t, tour }: { t: Track; tour?: string }) {
  const ink = INK[t.family];
  return (
    <div className="fx-mini" data-tour={tour}>
      {t.fx.map((f, slot) => {
        const info = fxById(f.kind);
        return (
          <Menu
            key={slot}
            className={`fx-boton${info ? ' on' : ''}`}
            width={info ? 232 : 300}
            title={info ? `${info.name}: clic para ajustarlo` : 'Agregar un efecto'}
            label={info ? info.name : '+ Efecto'}
          >
            {(close) =>
              info ? (
                <div className="fx-pop" style={{ '--c': ink } as CSSProperties}>
                  <div className="fx-pop-cab">
                    <b>{info.name}</b>
                    <button
                      className="btn chico"
                      onClick={() => {
                        removeEffect(t.id, slot);
                        close();
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="perillas">
                    {info.knobs.map((name, k) => (
                      <Knob key={name} size="s" label={name} value={f.knobs[k]} def={info.defaults[k]} ink={ink} text={fxKnobText(f.kind, k, f.knobs[k])} onChange={(v) => setEffectKnob(t.id, slot, k, v)} />
                    ))}
                  </div>
                </div>
              ) : (
                <ElegirEfecto
                  onPick={(k) => {
                    addEffect(t.id, k, slot);
                    close();
                  }}
                />
              )
            }
          </Menu>
        );
      })}
    </div>
  );
}
