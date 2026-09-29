//! Synthesized drum machine voices. Every sound is generated, so kits weigh
//! nothing and have no licensing issues. Four macros per voice:
//! p0 = Afinación, p1 = Cola, p2 = Brillo, p3 = Pegada / Suciedad.

use crate::dsp::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum DrumModel {
    Kick = 0,
    Snare = 1,
    Clap = 2,
    HatClosed = 3,
    HatOpen = 4,
    Rim = 5,
    Conga = 6,
    Shaker = 7,
    Cowbell = 8,
    Cymbal = 9,
    Timbal = 10,
    Riser = 11,
    Impact = 12,
    Click = 13,
    Tom = 14,
    Snap = 15,
    Clave = 16,
    Tambourine = 17,
    Ride = 18,
    Bongo = 19,
    Kick808 = 20,
    Downlifter = 21,
    ReverseCymbal = 22,
    Laser = 23,
    AirHorn = 24,
    SubDrop = 25,
}

impl DrumModel {
    pub fn from_u8(v: u8) -> DrumModel {
        match v {
            0 => DrumModel::Kick,
            1 => DrumModel::Snare,
            2 => DrumModel::Clap,
            3 => DrumModel::HatClosed,
            4 => DrumModel::HatOpen,
            5 => DrumModel::Rim,
            6 => DrumModel::Conga,
            7 => DrumModel::Shaker,
            8 => DrumModel::Cowbell,
            9 => DrumModel::Cymbal,
            10 => DrumModel::Timbal,
            11 => DrumModel::Riser,
            12 => DrumModel::Impact,
            14 => DrumModel::Tom,
            15 => DrumModel::Snap,
            16 => DrumModel::Clave,
            17 => DrumModel::Tambourine,
            18 => DrumModel::Ride,
            19 => DrumModel::Bongo,
            20 => DrumModel::Kick808,
            21 => DrumModel::Downlifter,
            22 => DrumModel::ReverseCymbal,
            23 => DrumModel::Laser,
            24 => DrumModel::AirHorn,
            25 => DrumModel::SubDrop,
            _ => DrumModel::Click,
        }
    }
    /// Which visual "hit" this model feeds: 0 none, 1 kick, 2 snare, 3 hat.
    pub fn hit_class(self) -> u8 {
        match self {
            DrumModel::Kick | DrumModel::Impact | DrumModel::Kick808 | DrumModel::SubDrop => 1,
            DrumModel::Snare
            | DrumModel::Clap
            | DrumModel::Rim
            | DrumModel::Timbal
            | DrumModel::Snap
            | DrumModel::Tom => 2,
            DrumModel::HatClosed
            | DrumModel::HatOpen
            | DrumModel::Shaker
            | DrumModel::Cymbal
            | DrumModel::Ride
            | DrumModel::Tambourine
            | DrumModel::Clave => 3,
            _ => 0,
        }
    }
}

const METAL: [f32; 6] = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];

#[derive(Clone, Copy)]
pub struct DrumVoice {
    pub model: DrumModel,
    vel: f32,
    t: f32,
    osc: [Osc; 6],
    amp: Decay,
    env2: Decay,
    pitch: Decay,
    f1: Svf,
    f2: Svf,
    rng: Rng,
    // Values computed at trigger time.
    fa: f32,
    fb: f32,
    drive: f32,
    len: f32,
    cr: u32,
    active: bool,
}

impl DrumVoice {
    pub fn new(model: DrumModel, seed: u32) -> Self {
        DrumVoice {
            model,
            vel: 0.0,
            t: 0.0,
            osc: [Osc::default(); 6],
            amp: Decay::default(),
            env2: Decay::default(),
            pitch: Decay::default(),
            f1: Svf::default(),
            f2: Svf::default(),
            rng: Rng::new(seed.wrapping_mul(2_654_435_761).wrapping_add(17)),
            fa: 0.0,
            fb: 0.0,
            drive: 0.0,
            len: 1.0,
            cr: 0,
            active: false,
        }
    }

    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Cuts the sound quickly (hi-hat choke).
    pub fn choke(&mut self, sr: f32) {
        if self.active {
            let l = self.amp.level;
            self.amp.trigger(l, 0.012, sr);
        }
    }

    pub fn trigger(&mut self, vel: f32, p: &[f32], sr: f32, bpm: f32) {
        let p0 = p[0];
        let p1 = p[1];
        let p2 = p[2];
        let p3 = p[3];
        self.vel = vel.clamp(0.0, 1.2);
        self.t = 0.0;
        self.active = true;
        self.cr = 0;
        self.drive = p3;
        for o in self.osc.iter_mut() {
            o.phase = 0.0;
        }
        match self.model {
            DrumModel::Kick => {
                self.fa = exp_map(p0, 38.0, 78.0); // resting pitch
                self.fb = self.fa * (3.5 + p3 * 4.0); // start pitch
                self.pitch.trigger(1.0, 0.016 + (1.0 - p2) * 0.02, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.06, 0.6), sr);
                self.env2.trigger(1.0, 0.0025, sr); // click
                self.f1.set_q(exp_map(p2, 1500.0, 9000.0), 0.7, sr);
            }
            DrumModel::Snare => {
                self.fa = exp_map(p0, 140.0, 270.0);
                self.env2.trigger(1.0, 0.075, sr); // tone
                self.amp.trigger(1.0, exp_map(p1, 0.08, 0.45), sr); // noise
                self.pitch.trigger(1.0, 0.01, sr);
                self.f1.set_q(exp_map(p2, 700.0, 4000.0), 0.6, sr); // noise high pass
                self.f2.set_q(9000.0, 0.7, sr);
            }
            DrumModel::Clap => {
                self.fa = exp_map(p0, 750.0, 2200.0);
                self.amp.trigger(1.0, exp_map(p1, 0.08, 0.5), sr);
                self.f1.set_q(self.fa, 1.3, sr);
                self.f2.set_q(exp_map(p2, 2500.0, 12000.0), 0.7, sr);
            }
            DrumModel::HatClosed | DrumModel::HatOpen | DrumModel::Cymbal => {
                self.fa = exp_map(p0, 0.8, 1.45);
                let decay = match self.model {
                    DrumModel::HatClosed => exp_map(p1, 0.025, 0.14),
                    DrumModel::HatOpen => exp_map(p1, 0.18, 0.9),
                    _ => exp_map(p1, 0.7, 3.0),
                };
                self.amp.trigger(1.0, decay, sr);
                self.f1.set_q(exp_map(p2, 6000.0, 12000.0), 1.1, sr);
                self.f2.set_q(exp_map(p2, 4500.0, 8500.0), 0.7, sr);
                for (i, o) in self.osc.iter_mut().enumerate() {
                    o.phase = (i as f32 * 0.137) % 1.0;
                }
            }
            DrumModel::Rim => {
                self.fa = exp_map(p0, 1200.0, 2400.0);
                self.env2.trigger(1.0, 0.006, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.008, 0.05), sr);
                self.f1.set_q(self.fa * 1.4, 2.0, sr);
            }
            DrumModel::Conga => {
                self.fa = exp_map(p0, 170.0, 460.0);
                self.pitch.trigger(1.0, 0.012, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.08, 0.5), sr);
                self.env2.trigger(1.0, 0.004, sr);
                self.f1.set_q(2500.0, 1.0, sr);
            }
            DrumModel::Shaker => {
                self.fa = 0.006 + p0 * 0.02; // attack time
                self.amp.trigger(1.0, exp_map(p1, 0.03, 0.2), sr);
                self.f1.set_q(exp_map(p2, 3500.0, 9500.0), 0.8, sr);
            }
            DrumModel::Cowbell => {
                self.fa = exp_map(p0, 0.75, 1.4);
                self.env2.trigger(1.0, 0.02, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.1, 0.6), sr);
                self.f1.set_q(900.0 * self.fa, 3.0, sr);
            }
            DrumModel::Timbal => {
                self.fa = exp_map(p0, 300.0, 720.0);
                self.pitch.trigger(1.0, 0.01, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.06, 0.32), sr);
                self.env2.trigger(1.0, 0.003, sr);
            }
            DrumModel::Riser => {
                // Length in bars: 1, 2, 4, 8 or 16.
                let bars = [1.0, 2.0, 4.0, 8.0, 16.0][((p1 * 4.0).round() as usize).min(4)];
                self.len = bars * 4.0 * 60.0 / bpm.max(40.0);
                self.fa = p2;
                self.amp.trigger(1.0, 1000.0, sr);
            }
            DrumModel::Impact => {
                self.fa = exp_map(p0, 32.0, 60.0);
                self.pitch.trigger(1.0, 0.05, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.8, 3.0), sr);
                self.env2.trigger(1.0, 0.25, sr);
                self.f1.set_q(6000.0, 0.7, sr);
            }
            DrumModel::Click => {
                self.fa = if p0 > 0.5 { 1650.0 } else { 1100.0 };
                self.amp.trigger(1.0, 0.025, sr);
            }
            DrumModel::Tom => {
                self.fa = exp_map(p0, 70.0, 260.0);
                self.pitch.trigger(1.0, 0.045, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.12, 0.8), sr);
                self.env2.trigger(1.0, 0.006, sr);
                self.f1.set_q(exp_map(p2, 900.0, 5000.0), 0.7, sr);
            }
            DrumModel::Snap => {
                self.fa = exp_map(p0, 1400.0, 3200.0);
                self.amp.trigger(1.0, exp_map(p1, 0.03, 0.15), sr);
                self.f1.set_q(self.fa, 2.0, sr);
                self.f2.set_q(exp_map(p2, 4000.0, 12000.0), 0.7, sr);
            }
            DrumModel::Clave => {
                self.fa = exp_map(p0, 1700.0, 3200.0);
                self.amp.trigger(1.0, exp_map(p1, 0.02, 0.12), sr);
                self.env2.trigger(1.0, 0.002, sr);
                self.f1.set_q(self.fa, 4.0, sr);
            }
            DrumModel::Tambourine => {
                self.fa = exp_map(p0, 1.4, 2.2);
                self.amp.trigger(1.0, exp_map(p1, 0.05, 0.4), sr);
                self.f1.set_q(exp_map(p2, 7000.0, 11000.0), 1.4, sr);
                self.f2.set_q(5000.0, 0.7, sr);
                for (i, o) in self.osc.iter_mut().enumerate() {
                    o.phase = (i as f32 * 0.29) % 1.0;
                }
            }
            DrumModel::Ride => {
                self.fa = exp_map(p0, 0.9, 1.3);
                self.amp.trigger(1.0, exp_map(p1, 0.8, 4.0), sr);
                self.env2.trigger(1.0, exp_map(p1, 0.15, 0.6), sr);
                self.f1.set_q(exp_map(p2, 5000.0, 9000.0), 1.2, sr);
                self.f2.set_q(3000.0, 0.7, sr);
                for (i, o) in self.osc.iter_mut().enumerate() {
                    o.phase = (i as f32 * 0.173) % 1.0;
                }
            }
            DrumModel::Bongo => {
                self.fa = exp_map(p0, 380.0, 900.0);
                self.pitch.trigger(1.0, 0.008, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.05, 0.3), sr);
                self.env2.trigger(1.0, 0.003, sr);
                self.f1.set_q(exp_map(p2, 2500.0, 7000.0), 1.0, sr);
            }
            DrumModel::Kick808 => {
                self.fa = exp_map(p0, 35.0, 65.0);
                self.fb = self.fa * 3.2;
                self.pitch.trigger(1.0, 0.03, sr);
                self.amp.trigger(1.0, exp_map(p1, 0.3, 2.5), sr);
                self.env2.trigger(1.0, 0.002, sr);
                self.f1.set_q(exp_map(p2, 2000.0, 8000.0), 0.7, sr);
            }
            DrumModel::Downlifter => {
                // Length in bars: 1, 2 or 4.
                let bars = [1.0, 2.0, 4.0][((p1 * 2.0).round() as usize).min(2)];
                self.len = bars * 4.0 * 60.0 / bpm.max(40.0);
                self.fa = p2;
                self.amp.trigger(1.0, 1000.0, sr);
            }
            DrumModel::ReverseCymbal => {
                // Length in beats: 1, 2, 4 or 8, rising into the next downbeat.
                let beats = [1.0, 2.0, 4.0, 8.0][((p1 * 3.0).round() as usize).min(3)];
                self.len = beats * 60.0 / bpm.max(40.0);
                self.fa = exp_map(p0, 0.8, 1.45);
                self.f1.set_q(exp_map(p2, 6000.0, 12000.0), 1.1, sr);
                self.f2.set_q(4000.0, 0.7, sr);
                self.amp.trigger(1.0, 1000.0, sr);
            }
            DrumModel::Laser => {
                self.fa = exp_map(p0, 800.0, 3000.0);
                self.pitch.trigger(1.0, exp_map(p1, 0.03, 0.2), sr);
                self.amp.trigger(1.0, exp_map(p1, 0.08, 0.5), sr);
            }
            DrumModel::AirHorn => {
                self.fa = exp_map(p0, 330.0, 620.0);
                self.len = exp_map(p1, 0.25, 1.4);
                self.f1.set_q(exp_map(p2, 900.0, 2600.0), 1.2, sr);
                self.amp.trigger(1.0, 1000.0, sr);
                for (i, o) in self.osc.iter_mut().enumerate() {
                    o.phase = (i as f32 * 0.31) % 1.0;
                }
            }
            DrumModel::SubDrop => {
                self.fa = exp_map(p0, 30.0, 60.0);
                self.len = exp_map(p1, 0.5, 3.0);
                self.amp.trigger(1.0, self.len * 0.55, sr);
            }
        }
    }

    #[inline]
    pub fn next(&mut self, sr: f32) -> f32 {
        if !self.active {
            return 0.0;
        }
        let dt = 1.0 / sr;
        self.t += dt;
        let out = match self.model {
            DrumModel::Kick => {
                let pe = self.pitch.next();
                let f = self.fa + (self.fb - self.fa) * pe;
                let body = self.osc[0].sine(f, sr) * self.amp.next();
                let click = self.f1.hp(self.rng.noise()) * self.env2.next();
                soft_clip((body * 1.1 + click * 0.35) * (1.0 + self.drive * 1.6)) * 0.95
            }
            DrumModel::Snare => {
                let pe = self.pitch.next();
                let f = self.fa * (1.0 + 0.25 * pe);
                let te = self.env2.next();
                let tone =
                    (self.osc[0].sine(f, sr) * 0.6 + self.osc[1].sine(f * 1.78, sr) * 0.3) * te;
                let n = self.f2.lp(self.f1.hp(self.rng.noise()));
                let noise = n * self.amp.next();
                soft_clip((tone + noise * 0.95) * (1.0 + self.drive)) * 0.8
            }
            DrumModel::Clap => {
                let t = self.t;
                let mut burst = 0.0;
                for k in 0..3 {
                    let tk = k as f32 * 0.0105;
                    if t >= tk && t < tk + 0.02 {
                        burst += (-(t - tk) / 0.0028).exp();
                    }
                }
                let tail = if t > 0.03 { self.amp.next() * 0.8 } else { 0.0 };
                let n = self.f2.lp(self.f1.bp(self.rng.noise()) * 2.2);
                soft_clip(n * (burst + tail) * (1.0 + self.drive)) * 0.9
            }
            DrumModel::HatClosed | DrumModel::HatOpen | DrumModel::Cymbal => {
                let mut m = 0.0;
                for i in 0..6 {
                    m += self.osc[i].raw_square(METAL[i] * self.fa, sr);
                }
                let m = m * (1.0 / 6.0) * 0.8 + self.rng.noise() * 0.25 * (1.0 - self.drive * 0.5);
                let y = self.f2.hp(self.f1.bp(m) * 2.5);
                y * self.amp.next() * 0.7
            }
            DrumModel::Rim => {
                let tone = self.osc[0].sine(self.fa, sr) * self.amp.next();
                let click = self.f1.bp(self.rng.noise()) * self.env2.next() * 2.0;
                soft_clip((tone + click) * (1.0 + self.drive)) * 0.7
            }
            DrumModel::Conga => {
                let pe = self.pitch.next();
                let f = self.fa * (1.0 + 0.2 * pe);
                let body = (self.osc[0].sine(f, sr)
                    + self.osc[1].triangle(f * 1.5, sr) * 0.12 * self.drive)
                    * self.amp.next();
                let slap = self.f1.hp(self.rng.noise()) * self.env2.next() * 0.3;
                soft_clip(body + slap) * 0.85
            }
            DrumModel::Shaker => {
                let a = if self.t < self.fa {
                    self.t / self.fa
                } else {
                    1.0
                };
                let e = if self.t < self.fa { a } else { self.amp.next() };
                self.f1.hp(self.rng.noise()) * e * 0.55
            }
            DrumModel::Cowbell => {
                let s = self.osc[0].square(540.0 * self.fa, sr, 0.5)
                    + self.osc[1].square(800.0 * self.fa, sr, 0.5);
                let e = self.env2.next() * 0.6 + self.amp.next() * 0.5;
                soft_clip(self.f1.bp(s) * e * (1.2 + self.drive)) * 0.6
            }
            DrumModel::Timbal => {
                let pe = self.pitch.next();
                let f = self.fa * (1.0 + 0.12 * pe);
                let ring = self.osc[0].sine(f, sr) + self.osc[1].square(f * 1.51, sr, 0.5) * 0.12;
                let hit = self.rng.noise() * self.env2.next() * 0.4;
                soft_clip((ring * self.amp.next() + hit) * (1.0 + self.drive)) * 0.7
            }
            DrumModel::Riser => {
                let prog = (self.t / self.len).min(1.0);
                if self.cr.is_multiple_of(16) {
                    self.f1
                        .set_q(exp_map(prog, 250.0, 9000.0), 2.0 + self.fa * 3.0, sr);
                }
                self.cr = self.cr.wrapping_add(1);
                let n = self.f1.bp(self.rng.noise()) * 2.0;
                let tone = self.osc[0].saw(exp_map(prog, 180.0, 1400.0), sr) * 0.08 * self.drive;
                if self.t >= self.len {
                    self.active = false;
                }
                (n + tone) * prog * prog * 0.6
            }
            DrumModel::Impact => {
                let pe = self.pitch.next();
                let f = self.fa * (1.0 + pe);
                let boom = self.osc[0].sine(f, sr) * self.amp.next();
                let crash = self.f1.lp(self.rng.noise()) * self.env2.next() * 0.35;
                soft_clip((boom + crash) * (1.2 + self.drive)) * 0.9
            }
            DrumModel::Click => self.osc[0].sine(self.fa, sr) * self.amp.next() * 0.5,
            DrumModel::Tom => {
                let pe = self.pitch.next();
                let f = self.fa * (1.0 + 0.6 * pe);
                let body = self.osc[0].sine(f, sr) * self.amp.next();
                let hit = self.f1.lp(self.rng.noise()) * self.env2.next() * 0.5;
                soft_clip((body + hit) * (1.0 + self.drive * 2.0)) * 0.9
            }
            DrumModel::Snap => {
                let t = self.t;
                let burst = (-t / 0.0015).exp()
                    + if t > 0.006 {
                        0.6 * (-(t - 0.006) / 0.002).exp()
                    } else {
                        0.0
                    };
                let tail = self.amp.next() * 0.5;
                let n = self.f2.lp(self.f1.bp(self.rng.noise()) * 2.5);
                soft_clip(n * (burst + tail) * (1.0 + self.drive)) * 0.9
            }
            DrumModel::Clave => {
                let tone = self.osc[0].sine(self.fa, sr)
                    + self.osc[1].square(self.fa * 2.02, sr, 0.5) * 0.08;
                let click = self.f1.bp(self.rng.noise()) * self.env2.next();
                soft_clip((tone * self.amp.next() + click) * (1.0 + self.drive)) * 0.7
            }
            DrumModel::Tambourine => {
                let t = self.t;
                // Three jingles that arrive a few milliseconds apart.
                let mut jingle = 0.0;
                for k in 0..3 {
                    let tk = k as f32 * 0.009;
                    if t >= tk {
                        jingle += (-(t - tk) / 0.004).exp();
                    }
                }
                let mut m = 0.0;
                for i in 0..6 {
                    m += self.osc[i].raw_square(METAL[i] * self.fa * 2.2, sr);
                }
                let x = m * (1.0 / 6.0) * 0.6 + self.rng.noise() * 0.4;
                let y = self.f2.hp(self.f1.bp(x) * 2.2);
                y * (self.amp.next() * 0.7 + jingle * 0.5) * 0.7
            }
            DrumModel::Ride => {
                let mut m = 0.0;
                for i in 0..6 {
                    m += self.osc[i].raw_square(METAL[i] * self.fa * 1.3, sr);
                }
                let wash = self
                    .f2
                    .hp(self.f1.bp(m * (1.0 / 6.0) + self.rng.noise() * 0.15) * 2.0);
                let ping = (self.t * core::f32::consts::TAU * 3100.0 * self.fa).sin()
                    * self.env2.next()
                    * 0.25;
                (wash * self.amp.next() + ping * (1.0 + self.drive)) * 0.55
            }
            DrumModel::Bongo => {
                let pe = self.pitch.next();
                let f = self.fa * (1.0 + 0.15 * pe);
                let body = self.osc[0].sine(f, sr) * self.amp.next();
                let slap = self.f1.hp(self.rng.noise()) * self.env2.next() * 0.35;
                soft_clip((body + slap) * (1.0 + self.drive)) * 0.8
            }
            DrumModel::Kick808 => {
                let pe = self.pitch.next();
                let f = self.fa + (self.fb - self.fa) * pe;
                let body = self.osc[0].sine(f, sr) * self.amp.next();
                let click = self.f1.hp(self.rng.noise()) * self.env2.next() * 0.2;
                soft_clip((body * 1.05 + click) * (1.0 + self.drive * 2.5)) * 0.95
            }
            DrumModel::Downlifter => {
                let prog = (self.t / self.len).min(1.0);
                if self.cr.is_multiple_of(16) {
                    self.f1
                        .set_q(exp_map(1.0 - prog, 200.0, 9000.0), 2.0 + self.fa * 3.0, sr);
                }
                self.cr = self.cr.wrapping_add(1);
                let n = self.f1.bp(self.rng.noise()) * 2.0;
                let tone =
                    self.osc[0].sine(exp_map(1.0 - prog, 60.0, 900.0), sr) * 0.12 * self.drive;
                if self.t >= self.len {
                    self.active = false;
                }
                let e = 1.0 - prog;
                (n + tone) * e * e * 0.6
            }
            DrumModel::ReverseCymbal => {
                let prog = (self.t / self.len).min(1.0);
                let mut m = 0.0;
                for i in 0..6 {
                    m += self.osc[i].raw_square(METAL[i] * self.fa, sr);
                }
                let m = m * (1.0 / 6.0) * 0.8 + self.rng.noise() * 0.3;
                let y = self.f2.hp(self.f1.bp(m) * 2.5);
                if self.t >= self.len {
                    self.active = false;
                }
                y * prog * prog * prog * 0.8
            }
            DrumModel::Laser => {
                let pe = self.pitch.next();
                let f = self.fa * (0.12 + 0.88 * pe);
                let s = self.osc[0].sine(f, sr) * (1.0 - self.drive * 0.5)
                    + self.osc[1].square(f, sr, 0.5) * self.drive * 0.4;
                soft_clip(s * 1.2) * self.amp.next() * 0.6
            }
            DrumModel::AirHorn => {
                let t = self.t;
                let a = (t / 0.015).min(1.0);
                let rel = if t > self.len {
                    (1.0 - (t - self.len) / 0.12).max(0.0)
                } else {
                    1.0
                };
                if t > self.len + 0.12 {
                    self.active = false;
                }
                // A slight drop in pitch at the end, like a real horn running out.
                let bend = if t > self.len * 0.8 {
                    1.0 - ((t - self.len * 0.8) / (self.len * 0.2 + 0.12)).min(1.0) * 0.06
                } else {
                    1.0
                };
                let vib = 1.0 + (t * 34.0).sin() * 0.004;
                let f = self.fa * bend * vib;
                let mut s = 0.0;
                for (i, d) in [1.0, 1.006, 0.994, 2.003].iter().enumerate() {
                    s += self.osc[i].saw(f * d, sr) * if i == 3 { 0.35 } else { 0.5 };
                }
                let y = self.f1.bp(s) * 2.2 + s * 0.15;
                soft_clip(y * (1.2 + self.drive * 2.0)) * a * rel * 0.55
            }
            DrumModel::SubDrop => {
                let prog = (self.t / self.len).min(1.0);
                let f = self.fa * (2.0 - prog);
                let s = self.osc[0].sine(f, sr);
                if self.t >= self.len {
                    self.active = false;
                }
                soft_clip(s * (1.0 + self.drive * 3.0)) * self.amp.next() * 0.9
            }
        };
        let sustained = matches!(
            self.model,
            DrumModel::Riser
                | DrumModel::Downlifter
                | DrumModel::ReverseCymbal
                | DrumModel::AirHorn
        );
        if !sustained && !self.amp.active() {
            self.active = false;
        }
        out * self.vel
    }
}
