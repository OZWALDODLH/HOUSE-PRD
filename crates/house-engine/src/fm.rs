//! Teclas FM: two-operator FM (a modulator bends the carrier) with feedback,
//! eight voices. Electric piano, bells, marimba, kalimba and FM bass.
//! p0 Brillo (index), p1 Ataque, p2 Cola, p3 Relación (modulator ratio),
//! p4 Campana (how fast the brightness fades), p5 Vibrato, p6 Sostenido,
//! p7 Retroalimentación (modulator feedback).

use crate::dsp::*;
use core::f32::consts::TAU;

pub const FM_VOICES: usize = 8;
const RATIOS: [f32; 8] = [0.5, 1.0, 2.0, 3.0, 3.5, 4.0, 5.0, 7.0];

#[derive(Clone, Copy)]
struct FmVoice {
    carrier: f32,
    modulator: f32,
    last: f32,
    note: u8,
    freq: f32,
    vel: f32,
    amp: Adsr,
    bright: Decay,
    age: u32,
}

impl FmVoice {
    fn new() -> Self {
        FmVoice {
            carrier: 0.0,
            modulator: 0.0,
            last: 0.0,
            note: 0,
            freq: 220.0,
            vel: 0.0,
            amp: Adsr::default(),
            bright: Decay::default(),
            age: 0,
        }
    }
}

#[inline]
fn wrap(x: f32) -> f32 {
    x - x.floor()
}

#[derive(Clone, Copy)]
pub struct Fm {
    voices: [FmVoice; FM_VOICES],
    clock: u32,
    index: f32,
    ratio: f32,
    fade: f32,
    vibrato: f32,
    feedback: f32,
    lfo: f32,
}

impl Fm {
    pub fn new(sr: f32) -> Self {
        let mut f = Fm {
            voices: [FmVoice::new(); FM_VOICES],
            clock: 0,
            index: 2.0,
            ratio: 1.0,
            fade: 0.6,
            vibrato: 0.0,
            feedback: 0.0,
            lfo: 0.0,
        };
        f.set_params(&[0.3, 0.0, 0.5, 0.15, 0.45, 0.0, 0.25, 0.05], sr);
        f
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.index = p[0] * 9.0;
        let attack = exp_map(p[1], 0.001, 2.0);
        let tail = exp_map(p[2], 0.05, 4.0);
        self.ratio = RATIOS[((p[3] * 7.0).round() as usize).min(7)];
        self.fade = exp_map(p[4], 0.04, 4.0);
        self.vibrato = p[5] * 0.012;
        let sustain = p[6];
        self.feedback = p[7] * 0.9;
        for v in self.voices.iter_mut() {
            v.amp.set(attack, tail, sustain, tail * 0.8, sr);
        }
    }

    pub fn note_on(&mut self, note: u8, vel: f32, sr: f32) {
        self.clock = self.clock.wrapping_add(1);
        let idx = pick_voice(
            &self.voices,
            note,
            |v| v.amp.is_active(),
            |v| v.note,
            |v| v.age,
        );
        let fade = self.fade;
        let v = &mut self.voices[idx];
        v.note = note;
        v.freq = midi_to_hz(note as f32);
        v.vel = vel;
        v.age = self.clock;
        v.carrier = 0.0;
        v.modulator = 0.0;
        v.last = 0.0;
        v.bright.trigger(1.0, fade, sr);
        v.amp.gate_on();
    }

    pub fn note_off(&mut self, note: u8) {
        for v in self.voices.iter_mut() {
            if (v.note == note || note == 255) && v.amp.is_active() && !v.amp.is_releasing() {
                v.amp.gate_off();
            }
        }
    }

    #[inline]
    pub fn next(&mut self, sr: f32) -> f32 {
        self.lfo = wrap(self.lfo + 5.5 / sr);
        let vib = 1.0 + self.vibrato * (TAU * self.lfo).sin();
        let mut out = 0.0;
        for v in self.voices.iter_mut() {
            if !v.amp.is_active() {
                continue;
            }
            let env = v.amp.next();
            // The brightness fades from full to a quarter: the "bell".
            let index = self.index * (0.25 + 0.75 * v.bright.next());
            let m = (TAU * v.modulator + self.feedback * v.last).sin();
            v.last = m;
            let c = (TAU * v.carrier + index * m).sin();
            let f = v.freq * vib;
            v.modulator = wrap(v.modulator + f * self.ratio / sr);
            v.carrier = wrap(v.carrier + f / sr);
            out += c * env * v.vel;
        }
        soft_clip(out * 0.45) * 0.8
    }
}

/// Voice allocation shared by the polyphonic instruments: the voice already
/// playing this note, else a free one, else the oldest.
pub(crate) fn pick_voice<V>(
    voices: &[V],
    note: u8,
    active: impl Fn(&V) -> bool,
    note_of: impl Fn(&V) -> u8,
    age: impl Fn(&V) -> u32,
) -> usize {
    if let Some(i) = voices.iter().position(|v| active(v) && note_of(v) == note) {
        return i;
    }
    if let Some(i) = voices.iter().position(|v| !active(v)) {
        return i;
    }
    let mut oldest = 0;
    let mut best = u32::MAX;
    for (i, v) in voices.iter().enumerate() {
        if age(v) < best {
            best = age(v);
            oldest = i;
        }
    }
    oldest
}
