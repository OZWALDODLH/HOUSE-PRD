//! Building blocks: oscillators, filters, envelopes, noise and small helpers.
//! Everything here is allocation-free and safe to call from the audio thread.

use core::f32::consts::{PI, TAU};

/// Tiny value added in feedback paths so filters never fall into denormals.
pub const ANTI_DENORMAL: f32 = 1.0e-20;

#[inline]
pub fn db_to_gain(db: f32) -> f32 {
    if db <= -90.0 {
        0.0
    } else {
        10f32.powf(db / 20.0)
    }
}

#[inline]
pub fn gain_to_db(g: f32) -> f32 {
    if g <= 1.0e-5 {
        -100.0
    } else {
        20.0 * g.log10()
    }
}

#[inline]
pub fn midi_to_hz(n: f32) -> f32 {
    440.0 * 2f32.powf((n - 69.0) / 12.0)
}

#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

/// Maps 0..1 to min..max on an exponential curve (good for frequencies and times).
#[inline]
pub fn exp_map(t: f32, min: f32, max: f32) -> f32 {
    min * (max / min).powf(t.clamp(0.0, 1.0))
}

/// Smooth saturation. Close to tanh for |x| < 3, cheap, and hard-limited beyond.
#[inline]
pub fn soft_clip(x: f32) -> f32 {
    let x = x.clamp(-3.0, 3.0);
    x * (27.0 + x * x) / (27.0 + 9.0 * x * x)
}

/// One-pole smoothing coefficient for a time constant in seconds.
#[inline]
pub fn tau_coef(seconds: f32, sr: f32) -> f32 {
    if seconds <= 0.0 {
        0.0
    } else {
        (-1.0 / (seconds * sr)).exp()
    }
}

/// Constant-power pan. `pan` in -1..1. Returns (left, right) gains.
#[inline]
pub fn pan_gains(pan: f32) -> (f32, f32) {
    let theta = (pan.clamp(-1.0, 1.0) + 1.0) * PI * 0.25;
    (theta.cos(), theta.sin())
}

/// xorshift32 noise. Deterministic so offline renders match live playback.
#[derive(Clone, Copy)]
pub struct Rng(u32);

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng(if seed == 0 { 0x9E37_79B9 } else { seed })
    }
    #[inline]
    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x
    }
    /// White noise in -1..1.
    #[inline]
    pub fn noise(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 * (2.0 / 16_777_216.0) - 1.0
    }
    /// Uniform 0..1.
    #[inline]
    pub fn unit(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 / 16_777_216.0
    }
}

#[inline]
fn poly_blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        let t = t / dt;
        t + t - t * t - 1.0
    } else if t > 1.0 - dt {
        let t = (t - 1.0) / dt;
        t * t + t + t + 1.0
    } else {
        0.0
    }
}

/// Band-limited oscillator (PolyBLEP saw and square, plain sine and triangle).
#[derive(Clone, Copy, Default)]
pub struct Osc {
    pub phase: f32,
}

impl Osc {
    #[inline]
    fn advance(&mut self, dt: f32) {
        self.phase += dt;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
            if self.phase >= 1.0 {
                self.phase = 0.0;
            }
        }
    }
    #[inline]
    pub fn saw(&mut self, freq: f32, sr: f32) -> f32 {
        let dt = (freq / sr).clamp(0.0, 0.49);
        let v = 2.0 * self.phase - 1.0 - poly_blep(self.phase, dt);
        self.advance(dt);
        v
    }
    #[inline]
    pub fn square(&mut self, freq: f32, sr: f32, width: f32) -> f32 {
        let dt = (freq / sr).clamp(0.0, 0.49);
        let w = width.clamp(0.05, 0.95);
        let mut v = if self.phase < w { 1.0 } else { -1.0 };
        v += poly_blep(self.phase, dt);
        let mut t2 = self.phase - w;
        if t2 < 0.0 {
            t2 += 1.0;
        }
        v -= poly_blep(t2, dt);
        self.advance(dt);
        v
    }
    #[inline]
    pub fn sine(&mut self, freq: f32, sr: f32) -> f32 {
        let v = (TAU * self.phase).sin();
        self.advance((freq / sr).clamp(0.0, 0.49));
        v
    }
    #[inline]
    pub fn triangle(&mut self, freq: f32, sr: f32) -> f32 {
        let p = self.phase;
        let v = if p < 0.5 { 4.0 * p - 1.0 } else { 3.0 - 4.0 * p };
        self.advance((freq / sr).clamp(0.0, 0.49));
        v
    }
    /// Saw, square and triangle from the same phase (one advance per sample),
    /// so a synth can morph between shapes without detuning itself.
    #[inline]
    pub fn multi(&mut self, freq: f32, sr: f32) -> (f32, f32, f32) {
        let dt = (freq / sr).clamp(0.0, 0.49);
        let p = self.phase;
        let saw = 2.0 * p - 1.0 - poly_blep(p, dt);
        let mut sq = if p < 0.5 { 1.0 } else { -1.0 };
        sq += poly_blep(p, dt);
        let mut t2 = p - 0.5;
        if t2 < 0.0 {
            t2 += 1.0;
        }
        sq -= poly_blep(t2, dt);
        let tri = if p < 0.5 { 4.0 * p - 1.0 } else { 3.0 - 4.0 * p };
        self.advance(dt);
        (saw, sq, tri)
    }
    /// Naive square used for metallic hats (aliasing is part of the sound).
    #[inline]
    pub fn raw_square(&mut self, freq: f32, sr: f32) -> f32 {
        let v = if self.phase < 0.5 { 1.0 } else { -1.0 };
        self.advance((freq / sr).clamp(0.0, 0.49));
        v
    }
}

/// Topology-preserving state variable filter (Andrew Simper). Stable under fast
/// modulation; gives low, band and high pass at once.
#[derive(Clone, Copy)]
pub struct Svf {
    ic1: f32,
    ic2: f32,
    a1: f32,
    a2: f32,
    a3: f32,
    k: f32,
}

impl Default for Svf {
    fn default() -> Self {
        let mut f = Svf { ic1: 0.0, ic2: 0.0, a1: 0.0, a2: 0.0, a3: 0.0, k: 1.4 };
        f.set(1000.0, 0.0, 48_000.0);
        f
    }
}

pub struct SvfOut {
    pub lp: f32,
    pub bp: f32,
    pub hp: f32,
}

impl Svf {
    /// `res` in 0..1 (0.98 = almost self-oscillating).
    #[inline]
    pub fn set(&mut self, cutoff: f32, res: f32, sr: f32) {
        let fc = cutoff.clamp(8.0, sr * 0.45);
        let g = (PI * fc / sr).tan();
        let k = 2.0 - 2.0 * res.clamp(0.0, 0.985);
        self.k = k;
        self.a1 = 1.0 / (1.0 + g * (g + k));
        self.a2 = g * self.a1;
        self.a3 = g * self.a2;
    }
    /// Sets the filter from a Q value instead of resonance.
    #[inline]
    pub fn set_q(&mut self, cutoff: f32, q: f32, sr: f32) {
        let fc = cutoff.clamp(8.0, sr * 0.45);
        let g = (PI * fc / sr).tan();
        let k = 1.0 / q.max(0.05);
        self.k = k;
        self.a1 = 1.0 / (1.0 + g * (g + k));
        self.a2 = g * self.a1;
        self.a3 = g * self.a2;
    }
    #[inline]
    pub fn process(&mut self, v0: f32) -> SvfOut {
        let v3 = v0 - self.ic2;
        let v1 = self.a1 * self.ic1 + self.a2 * v3;
        let v2 = self.ic2 + self.a2 * self.ic1 + self.a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1 + ANTI_DENORMAL;
        self.ic2 = 2.0 * v2 - self.ic2 + ANTI_DENORMAL;
        SvfOut { lp: v2, bp: v1, hp: v0 - self.k * v1 - v2 }
    }
    #[inline]
    pub fn lp(&mut self, x: f32) -> f32 {
        self.process(x).lp
    }
    #[inline]
    pub fn hp(&mut self, x: f32) -> f32 {
        self.process(x).hp
    }
    #[inline]
    pub fn bp(&mut self, x: f32) -> f32 {
        self.process(x).bp
    }
    pub fn reset(&mut self) {
        self.ic1 = 0.0;
        self.ic2 = 0.0;
    }
}

/// One-pole low-pass, used for smoothing and damping.
#[derive(Clone, Copy, Default)]
pub struct OnePole {
    pub z: f32,
    pub a: f32,
}

impl OnePole {
    pub fn set_hz(&mut self, hz: f32, sr: f32) {
        self.a = (-TAU * hz.clamp(1.0, sr * 0.49) / sr).exp();
    }
    #[inline]
    pub fn lp(&mut self, x: f32) -> f32 {
        self.z = x + (self.z - x) * self.a + ANTI_DENORMAL;
        self.z
    }
    #[inline]
    pub fn hp(&mut self, x: f32) -> f32 {
        x - self.lp(x)
    }
}

/// Linear parameter smoother to avoid zipper noise.
#[derive(Clone, Copy)]
pub struct Smooth {
    pub value: f32,
    target: f32,
    coef: f32,
}

impl Smooth {
    pub fn new(v: f32, seconds: f32, sr: f32) -> Self {
        Smooth { value: v, target: v, coef: 1.0 - tau_coef(seconds, sr) }
    }
    #[inline]
    pub fn set(&mut self, v: f32) {
        self.target = v;
    }
    #[inline]
    pub fn next(&mut self) -> f32 {
        self.value += (self.target - self.value) * self.coef;
        self.value
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

/// Exponential ADSR with an overshooting attack, like analog envelopes.
#[derive(Clone, Copy)]
pub struct Adsr {
    stage: Stage,
    pub level: f32,
    a: f32,
    d: f32,
    s: f32,
    r: f32,
}

impl Default for Adsr {
    fn default() -> Self {
        Adsr { stage: Stage::Idle, level: 0.0, a: 0.5, d: 0.999, s: 0.7, r: 0.999 }
    }
}

impl Adsr {
    pub fn set(&mut self, attack: f32, decay: f32, sustain: f32, release: f32, sr: f32) {
        self.a = 1.0 - tau_coef(attack.max(0.0005) * 0.5, sr);
        self.d = tau_coef(decay.max(0.001) * 0.35, sr);
        self.s = sustain.clamp(0.0, 1.0);
        self.r = tau_coef(release.max(0.001) * 0.35, sr);
    }
    pub fn gate_on(&mut self) {
        self.stage = Stage::Attack;
    }
    pub fn gate_off(&mut self) {
        if self.stage != Stage::Idle {
            self.stage = Stage::Release;
        }
    }
    pub fn is_active(&self) -> bool {
        self.stage != Stage::Idle
    }
    pub fn is_releasing(&self) -> bool {
        self.stage == Stage::Release
    }
    #[inline]
    pub fn next(&mut self) -> f32 {
        match self.stage {
            Stage::Idle => {}
            Stage::Attack => {
                self.level += (1.25 - self.level) * self.a;
                if self.level >= 1.0 {
                    self.level = 1.0;
                    self.stage = Stage::Decay;
                }
            }
            Stage::Decay => {
                self.level = self.s + (self.level - self.s) * self.d;
                if (self.level - self.s).abs() < 1.0e-4 {
                    self.level = self.s;
                    self.stage = Stage::Sustain;
                }
            }
            Stage::Sustain => {
                self.level = self.s;
                if self.s <= 1.0e-4 {
                    self.stage = Stage::Idle;
                    self.level = 0.0;
                }
            }
            Stage::Release => {
                self.level *= self.r;
                if self.level < 1.0e-4 {
                    self.level = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }
        self.level
    }
}

/// Simple exponential decay (drums).
#[derive(Clone, Copy, Default)]
pub struct Decay {
    pub level: f32,
    coef: f32,
}

impl Decay {
    pub fn trigger(&mut self, level: f32, seconds: f32, sr: f32) {
        self.level = level;
        self.coef = tau_coef(seconds.max(0.0005), sr);
    }
    #[inline]
    pub fn next(&mut self) -> f32 {
        let v = self.level;
        self.level *= self.coef;
        if self.level < 1.0e-5 {
            self.level = 0.0;
        }
        v
    }
    pub fn active(&self) -> bool {
        self.level > 0.0
    }
}
