//! Melodic instruments: Ácido (acid line), 808 (sub bass) and Analógico (poly).
//! Macros (0..1) follow DESIGN/docs naming so the "cara fácil" maps 1:1.

use crate::dsp::*;

const CR: u32 = 16; // control-rate interval for filter coefficient updates

// ---------------------------------------------------------------- Ácido ----

/// p0 Brillo, p1 Resonancia, p2 Ácido (env mod), p3 Pegada (accent/drive),
/// p4 Forma (0 saw, 1 square), p5 Caída del filtro.
#[derive(Clone, Copy)]
pub struct Acid {
    osc: Osc,
    freq: f32,
    target: f32,
    gliding: bool,
    glide: f32,
    amp: Adsr,
    fenv: Decay,
    f1: Svf,
    f2: Svf,
    dc: OnePole,
    gate: bool,
    note: u8,
    vel: f32,
    accent: bool,
    cr: u32,
    base_cut: f32,
    res: f32,
    env_mod: f32,
    punch: f32,
    square: bool,
    fdecay: f32,
}

impl Acid {
    pub fn new(sr: f32) -> Self {
        let mut a = Acid {
            osc: Osc::default(),
            freq: 110.0,
            target: 110.0,
            gliding: false,
            glide: 1.0 - tau_coef(0.045, sr),
            amp: Adsr::default(),
            fenv: Decay::default(),
            f1: Svf::default(),
            f2: Svf::default(),
            dc: OnePole::default(),
            gate: false,
            note: 0,
            vel: 0.0,
            accent: false,
            cr: 0,
            base_cut: 400.0,
            res: 0.7,
            env_mod: 0.5,
            punch: 0.3,
            square: false,
            fdecay: 0.25,
        };
        a.amp.set(0.003, 0.2, 1.0, 0.012, sr);
        a.dc.set_hz(25.0, sr);
        a
    }

    pub fn set_params(&mut self, p: &[f32]) {
        self.base_cut = exp_map(p[0], 90.0, 3200.0);
        self.res = p[1] * 0.93;
        self.env_mod = p[2];
        self.punch = p[3];
        self.square = p[4] > 0.5;
        self.fdecay = exp_map(p[5], 0.08, 0.9);
    }

    pub fn note_on(&mut self, note: u8, vel: f32, slide: bool, accent: bool, sr: f32) {
        self.target = midi_to_hz(note as f32);
        self.accent = accent;
        if slide && self.gate {
            self.gliding = true;
        } else {
            self.gliding = false;
            self.freq = self.target;
            self.amp.gate_on();
            let d = if accent {
                self.fdecay * 0.6
            } else {
                self.fdecay
            };
            self.fenv.trigger(1.0, d, sr);
        }
        self.gate = true;
        self.note = note;
        self.vel = vel;
    }

    pub fn note_off(&mut self, note: u8) {
        if note == self.note || note == 255 {
            self.gate = false;
            self.amp.gate_off();
        }
    }

    pub fn active(&self) -> bool {
        self.amp.is_active()
    }

    #[inline]
    pub fn next(&mut self, sr: f32) -> f32 {
        if !self.amp.is_active() {
            return 0.0;
        }
        if self.gliding {
            self.freq += (self.target - self.freq) * self.glide;
        }
        let e = self.fenv.next();
        if self.cr.is_multiple_of(CR) {
            let acc = if self.accent {
                0.9 * self.punch + 0.3
            } else {
                0.0
            };
            let oct = self.env_mod * 4.2 * e + acc * e * 1.5;
            let cut = self.base_cut * 2f32.powf(oct);
            self.f1.set(cut, self.res, sr);
            self.f2.set(cut * 1.05, 0.1, sr);
        }
        self.cr = self.cr.wrapping_add(1);
        let x = if self.square {
            self.osc.square(self.freq, sr, 0.5) * 0.8
        } else {
            self.osc.saw(self.freq, sr)
        };
        let y = self.f2.lp(self.f1.lp(x));
        let y = self.dc.hp(y);
        let drive = 1.4 + self.punch * 2.0 + if self.accent { 0.8 } else { 0.0 };
        let amp = self.amp.next() * self.vel * if self.accent { 1.25 } else { 1.0 };
        soft_clip(y * drive) * amp * 0.55
    }
}

// ------------------------------------------------------------------ 808 ----

/// p0 Grave (decay), p1 Golpe (pitch punch), p2 Glide, p3 Saturación.
#[derive(Clone, Copy)]
pub struct Bass808 {
    osc: Osc,
    freq: f32,
    target: f32,
    gliding: bool,
    glide: f32,
    pitch: Decay,
    amp: Adsr,
    gate: bool,
    note: u8,
    vel: f32,
    punch: f32,
    sat: f32,
    decay: f32,
    lp: OnePole,
}

impl Bass808 {
    pub fn new(sr: f32) -> Self {
        let mut b = Bass808 {
            osc: Osc::default(),
            freq: 55.0,
            target: 55.0,
            gliding: false,
            glide: 1.0 - tau_coef(0.06, sr),
            pitch: Decay::default(),
            amp: Adsr::default(),
            gate: false,
            note: 0,
            vel: 0.0,
            punch: 12.0,
            sat: 0.3,
            decay: 1.0,
            lp: OnePole::default(),
        };
        b.amp.set(0.002, 1.0, 0.0, 0.03, sr);
        b.lp.set_hz(4000.0, sr);
        b
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.decay = exp_map(p[0], 0.25, 3.0);
        self.punch = p[1] * 24.0;
        self.glide = 1.0 - tau_coef(exp_map(p[2], 0.015, 0.25), sr);
        self.sat = p[3];
        self.amp.set(0.002, self.decay, 0.0, 0.04, sr);
    }

    pub fn note_on(&mut self, note: u8, vel: f32, slide: bool, sr: f32) {
        self.target = midi_to_hz(note as f32);
        if slide && self.gate {
            self.gliding = true;
        } else {
            self.gliding = false;
            self.freq = self.target;
            self.pitch.trigger(1.0, 0.035, sr);
            self.amp.gate_on();
        }
        self.gate = true;
        self.note = note;
        self.vel = vel;
    }

    pub fn note_off(&mut self, note: u8) {
        if note == self.note || note == 255 {
            self.gate = false;
            self.amp.gate_off();
        }
    }

    #[inline]
    pub fn next(&mut self, sr: f32) -> f32 {
        if !self.amp.is_active() {
            return 0.0;
        }
        if self.gliding {
            self.freq += (self.target - self.freq) * self.glide;
        }
        let pe = self.pitch.next();
        let f = self.freq * 2f32.powf(self.punch * pe / 12.0);
        let s = self.osc.sine(f, sr);
        let driven = soft_clip(s * (1.0 + self.sat * 5.0));
        let y = s * (1.0 - self.sat) + self.lp.lp(driven) * self.sat;
        y * self.amp.next() * self.vel * 0.85
    }
}

// ------------------------------------------------------------ Analógico ----

pub const POLY_VOICES: usize = 8;

#[derive(Clone, Copy)]
struct PolyVoice {
    o1: Osc,
    o2: Osc,
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

impl PolyVoice {
    fn new() -> Self {
        PolyVoice {
            o1: Osc::default(),
            o2: Osc { phase: 0.37 },
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

/// p0 Brillo, p1 Ataque, p2 Cola, p3 Grosor, p4 Forma (saw→square→triangle),
/// p5 Envolvente de filtro, p6 Resonancia, p7 Sostenido.
#[derive(Clone, Copy)]
pub struct Poly {
    voices: [PolyVoice; POLY_VOICES],
    clock: u32,
    cut: f32,
    detune: f32,
    sub_level: f32,
    shape: f32,
    env_amt: f32,
    res: f32,
}

impl Poly {
    pub fn new(sr: f32) -> Self {
        let mut p = Poly {
            voices: [PolyVoice::new(); POLY_VOICES],
            clock: 0,
            cut: 2000.0,
            detune: 0.1,
            sub_level: 0.1,
            shape: 0.0,
            env_amt: 0.3,
            res: 0.2,
        };
        p.set_params(&[0.6, 0.0, 0.3, 0.3, 0.0, 0.3, 0.2, 0.5], sr);
        p
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.cut = exp_map(p[0], 180.0, 12000.0);
        let attack = exp_map(p[1], 0.001, 2.5);
        let tail = exp_map(p[2], 0.05, 4.0);
        self.detune = p[3] * 0.25; // semitones
        self.sub_level = p[3] * 0.35;
        self.shape = p[4];
        self.env_amt = p[5];
        self.res = p[6] * 0.9;
        let sustain = p[7];
        for v in self.voices.iter_mut() {
            v.amp.set(attack, tail, sustain, tail * 0.8, sr);
            v.fenv.set(
                attack * 0.5 + 0.001,
                tail * 0.6,
                sustain * 0.5,
                tail * 0.6,
                sr,
            );
        }
    }

    pub fn note_on(&mut self, note: u8, vel: f32) {
        self.clock = self.clock.wrapping_add(1);
        // Reuse a voice already playing this note, else a free one, else the oldest.
        let mut idx = POLY_VOICES;
        for (i, v) in self.voices.iter().enumerate() {
            if v.amp.is_active() && v.note == note {
                idx = i;
                break;
            }
        }
        if idx == POLY_VOICES {
            if let Some(i) = self.voices.iter().position(|v| !v.amp.is_active()) {
                idx = i;
            } else {
                let mut oldest = 0;
                let mut best = u32::MAX;
                for (i, v) in self.voices.iter().enumerate() {
                    if v.age < best {
                        best = v.age;
                        oldest = i;
                    }
                }
                idx = oldest;
            }
        }
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
        let det = 2f32.powf(self.detune / 12.0);
        for v in self.voices.iter_mut() {
            if !v.amp.is_active() {
                continue;
            }
            let fe = v.fenv.next();
            if v.cr % CR == 0 {
                let cut = self.cut * 2f32.powf(self.env_amt * 4.0 * fe);
                v.filt.set(cut, self.res, sr);
            }
            v.cr = v.cr.wrapping_add(1);
            let f = v.freq;
            let (s1, q1, t1) = v.o1.multi(f, sr);
            let (s2, q2, t2) = v.o2.multi(f * det, sr);
            // Morph: saw (0) -> square (0.5) -> triangle (1).
            let osc = if self.shape < 0.5 {
                let t = self.shape * 2.0;
                (s1 + s2) * 0.5 * (1.0 - t) + (q1 + q2) * 0.5 * t
            } else {
                let t = (self.shape - 0.5) * 2.0;
                (q1 + q2) * 0.5 * (1.0 - t) + (t1 + t2) * 0.5 * t
            };
            let sub = v.sub.sine(f * 0.5, sr) * self.sub_level;
            let y = v.filt.lp(osc * 0.5 + sub);
            out += y * v.amp.next() * v.vel;
        }
        soft_clip(out * 0.6) * 0.7
    }
}
