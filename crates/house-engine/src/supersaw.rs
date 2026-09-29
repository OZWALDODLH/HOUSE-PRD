//! Supersaw: seven detuned saws per voice. Trance and EDM leads, big pads and,
//! low and closed, a Reese bass. Eight voices.
//! p0 Brillo, p1 Ataque, p2 Cola, p3 Grosor (detune), p4 Octava abajo,
//! p5 Envolvente de filtro, p6 Resonancia, p7 Sostenido.

use crate::dsp::*;
use crate::fm::pick_voice;

pub const SUPER_VOICES: usize = 8;
const SAWS: usize = 7;
/// Detune of each saw relative to the widest one (the classic uneven spread).
const SPREAD: [f32; SAWS] = [0.0, -0.11, 0.11, -0.32, 0.32, -0.64, 0.64];
const CR: u32 = 16;

#[derive(Clone, Copy)]
struct SuperVoice {
    saws: [Osc; SAWS],
    sub: Osc,
    note: u8,
    freq: f32,
    vel: f32,
    amp: Adsr,
    fenv: Adsr,
    filt: Svf,
    age: u32,
    cr: u32,
}

impl SuperVoice {
    fn new() -> Self {
        let mut saws = [Osc::default(); SAWS];
        for (i, o) in saws.iter_mut().enumerate() {
            o.phase = (i as f32 * 0.379) % 1.0;
        }
        SuperVoice {
            saws,
            sub: Osc::default(),
            note: 0,
            freq: 220.0,
            vel: 0.0,
            amp: Adsr::default(),
            fenv: Adsr::default(),
            filt: Svf::default(),
            age: 0,
            cr: 0,
        }
    }
}

#[derive(Clone, Copy)]
pub struct SuperSaw {
    voices: [SuperVoice; SUPER_VOICES],
    clock: u32,
    cut: f32,
    ratios: [f32; SAWS],
    sub: f32,
    env_amt: f32,
    res: f32,
}

impl SuperSaw {
    pub fn new(sr: f32) -> Self {
        let mut s = SuperSaw {
            voices: [SuperVoice::new(); SUPER_VOICES],
            clock: 0,
            cut: 4000.0,
            ratios: [1.0; SAWS],
            sub: 0.0,
            env_amt: 0.3,
            res: 0.1,
        };
        s.set_params(&[0.62, 0.02, 0.4, 0.5, 0.0, 0.3, 0.15, 0.8], sr);
        s
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.cut = exp_map(p[0], 150.0, 14000.0);
        let attack = exp_map(p[1], 0.001, 3.0);
        let tail = exp_map(p[2], 0.05, 5.0);
        let detune = p[3] * 0.9; // semitones for the widest pair
        for (r, s) in self.ratios.iter_mut().zip(SPREAD) {
            *r = 2f32.powf(s * detune / 12.0);
        }
        self.sub = p[4] * 0.6;
        self.env_amt = p[5];
        self.res = p[6] * 0.85;
        let sustain = p[7];
        for v in self.voices.iter_mut() {
            v.amp.set(attack, tail, sustain, tail * 0.8, sr);
            v.fenv.set(
                attack * 0.5 + 0.001,
                tail * 0.7,
                sustain * 0.4,
                tail * 0.7,
                sr,
            );
        }
    }

    pub fn note_on(&mut self, note: u8, vel: f32) {
        self.clock = self.clock.wrapping_add(1);
        let idx = pick_voice(
            &self.voices,
            note,
            |v| v.amp.is_active(),
            |v| v.note,
            |v| v.age,
        );
        let v = &mut self.voices[idx];
        v.note = note;
        v.freq = midi_to_hz(note as f32);
        v.vel = vel;
        v.age = self.clock;
        v.amp.gate_on();
        v.fenv.gate_on();
    }

    pub fn note_off(&mut self, note: u8) {
        for v in self.voices.iter_mut() {
            if (v.note == note || note == 255) && v.amp.is_active() && !v.amp.is_releasing() {
                v.amp.gate_off();
                v.fenv.gate_off();
            }
        }
    }

    #[inline]
    pub fn next(&mut self, sr: f32) -> f32 {
        let mut out = 0.0;
        for v in self.voices.iter_mut() {
            if !v.amp.is_active() {
                continue;
            }
            let fe = v.fenv.next();
            if v.cr.is_multiple_of(CR) {
                let cut = self.cut * 2f32.powf(self.env_amt * 4.0 * fe);
                v.filt.set(cut, self.res, sr);
            }
            v.cr = v.cr.wrapping_add(1);
            let mut s = 0.0;
            for (k, o) in v.saws.iter_mut().enumerate() {
                let w = if k == 0 { 0.34 } else { 0.11 };
                s += o.saw(v.freq * self.ratios[k], sr) * w;
            }
            let sub = if self.sub > 0.0 {
                v.sub.sine(v.freq * 0.5, sr) * self.sub
            } else {
                0.0
            };
            out += v.filt.lp(s + sub) * v.amp.next() * v.vel;
        }
        soft_clip(out * 0.55) * 0.75
    }
}
