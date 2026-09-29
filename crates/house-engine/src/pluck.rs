//! Cuerdas: plucked strings with Karplus-Strong (a burst of noise circulating
//! in a short delay that loses its brightness). Guitar, harp, koto and a
//! plucked bass. The delay lines live in a scratch buffer the track owns, so
//! nothing is allocated here.
//! p0 Brillo (string damping), p1 Púa (how bright the pluck is), p2 Cola
//! (how long it rings), p3 Cuerpo (wooden body), p4 Forma (soft noise ↔
//! bright saw), p5 Afinación fina, p7 Sostenido (ring after the key is released).

use crate::dsp::*;
use crate::fm::pick_voice;

pub const PLUCK_VOICES: usize = 8;
/// Samples per voice: down to ~24 Hz at 48 kHz.
pub const PLUCK_LEN: usize = 2048;
/// Scratch floats a track needs for this instrument.
pub const PLUCK_SCRATCH: usize = PLUCK_VOICES * PLUCK_LEN;

#[derive(Clone, Copy)]
struct String_ {
    write: usize,
    period: f32,
    damp: f32,
    lp: f32,
    loss: f32,
    release: f32,
    releasing: bool,
    note: u8,
    age: u32,
    level: f32,
    active: bool,
}

impl String_ {
    fn new() -> Self {
        String_ {
            write: 0,
            period: 100.0,
            damp: 0.5,
            lp: 0.0,
            loss: 0.999,
            release: 0.99,
            releasing: false,
            note: 0,
            age: 0,
            level: 0.0,
            active: false,
        }
    }
}

#[derive(Clone, Copy)]
pub struct Pluck {
    strings: [String_; PLUCK_VOICES],
    clock: u32,
    rng: Rng,
    damp: f32,
    pick: f32,
    t60: f32,
    body: f32,
    shape: f32,
    fine: f32,
    ring: f32,
    body_f: [Svf; 2],
}

impl Pluck {
    pub fn new(sr: f32, seed: u32) -> Self {
        let mut p = Pluck {
            strings: [String_::new(); PLUCK_VOICES],
            clock: 0,
            rng: Rng::new(seed.wrapping_mul(747_796_405).wrapping_add(3)),
            damp: 0.5,
            pick: 0.5,
            t60: 2.0,
            body: 0.3,
            shape: 0.0,
            fine: 0.0,
            ring: 0.3,
            body_f: [Svf::default(); 2],
        };
        p.set_params(&[0.55, 0.6, 0.5, 0.35, 0.0, 0.5, 0.5, 0.3], sr);
        p
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.damp = exp_map(p[0], 0.08, 0.95);
        self.pick = exp_map(p[1], 0.05, 1.0);
        self.t60 = exp_map(p[2], 0.25, 9.0);
        self.body = p[3];
        self.shape = p[4];
        self.fine = (p[5] - 0.5) * 0.5; // ±25 cents
        self.ring = exp_map(p[7], 0.04, 3.0);
        self.body_f[0].set_q(110.0, 1.6, sr);
        self.body_f[1].set_q(230.0, 2.2, sr);
    }

    pub fn note_on(&mut self, note: u8, vel: f32, sr: f32, scratch: &mut [f32]) {
        if scratch.len() < PLUCK_SCRATCH {
            return;
        }
        self.clock = self.clock.wrapping_add(1);
        let idx = pick_voice(&self.strings, note, |s| s.active, |s| s.note, |s| s.age);
        let f = midi_to_hz(note as f32 + self.fine);
        let period = (sr / f).clamp(2.0, (PLUCK_LEN - 3) as f32);
        let line = &mut scratch[idx * PLUCK_LEN..(idx + 1) * PLUCK_LEN];
        line.fill(0.0);
        // The pluck: noise (or a saw ramp) through a low-pass set by the pick.
        let n = period.ceil() as usize;
        let mut smooth = 0.0;
        for (i, x) in line.iter_mut().take(n).enumerate() {
            let ramp = 1.0 - 2.0 * (i as f32 / n as f32);
            let src = self.rng.noise() * (1.0 - self.shape) + ramp * self.shape;
            smooth += (src - smooth) * self.pick;
            *x = smooth * vel;
        }
        let s = &mut self.strings[idx];
        s.write = n % PLUCK_LEN;
        s.period = period;
        s.damp = self.damp;
        s.lp = 0.0;
        // Loss per trip around the string so it fades 60 dB in `t60` seconds.
        s.loss = 10f32.powf(-3.0 / (self.t60 * f)).min(0.99995);
        s.release = 10f32.powf(-3.0 / (self.ring * f));
        s.releasing = false;
        s.note = note;
        s.age = self.clock;
        s.level = 1.0;
        s.active = true;
    }

    pub fn note_off(&mut self, note: u8) {
        for s in self.strings.iter_mut() {
            if s.active && (s.note == note || note == 255) {
                s.releasing = true;
            }
        }
    }

    #[inline]
    pub fn next(&mut self, scratch: &mut [f32]) -> f32 {
        if scratch.len() < PLUCK_SCRATCH {
            return 0.0;
        }
        let mut out = 0.0;
        for (idx, s) in self.strings.iter_mut().enumerate() {
            if !s.active {
                continue;
            }
            let line = &mut scratch[idx * PLUCK_LEN..(idx + 1) * PLUCK_LEN];
            let mut rp = s.write as f32 - s.period;
            if rp < 0.0 {
                rp += PLUCK_LEN as f32;
            }
            let i0 = rp as usize % PLUCK_LEN;
            let i1 = (i0 + 1) % PLUCK_LEN;
            let frac = rp - rp.floor();
            let x = line[i0] + (line[i1] - line[i0]) * frac;
            s.lp += (x - s.lp) * s.damp;
            let g = if s.releasing {
                s.loss * s.release
            } else {
                s.loss
            };
            line[s.write] = s.lp * g + ANTI_DENORMAL;
            s.write = (s.write + 1) % PLUCK_LEN;
            s.level = s.level * 0.9995 + x.abs() * 0.0005;
            if s.level < 2.0e-5 {
                s.active = false;
            }
            out += x;
        }
        let body = self.body_f[0].bp(out) * 0.9 + self.body_f[1].bp(out) * 0.6;
        soft_clip((out + body * self.body * 1.4) * 0.9) * 0.8
    }
}
