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
            _ => DrumModel::Click,
        }
    }
    /// Which visual "hit" this model feeds: 0 none, 1 kick, 2 snare, 3 hat.
    pub fn hit_class(self) -> u8 {
        match self {
            DrumModel::Kick | DrumModel::Impact => 1,
            DrumModel::Snare | DrumModel::Clap | DrumModel::Rim | DrumModel::Timbal => 2,
            DrumModel::HatClosed | DrumModel::HatOpen | DrumModel::Shaker | DrumModel::Cymbal => 3,
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
        };
        if self.model != DrumModel::Riser && !self.amp.active() {
            self.active = false;
        }
        out * self.vel
    }
}
