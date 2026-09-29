//! Insert effects: two slots per track, each one effect with three macros
//! (0..1). The delay lines are allocated once in `new()`; changing the effect
//! only clears them, so the audio thread never allocates.

use crate::dsp::*;
use core::f32::consts::{PI, TAU};

pub const INSERT_SLOTS: usize = 2;
pub const INSERT_PARAMS: usize = 3;
/// Samples per channel: 170 ms at 48 kHz.
const LINE: usize = 8192;

/// Effect ids for `SetFx`.
pub mod fx_kind {
    pub const NONE: u8 = 0;
    /// Coro: p0 Velocidad, p1 Profundidad, p2 Mezcla.
    pub const CHORUS: u8 = 1;
    /// Phaser: p0 Velocidad, p1 Profundidad, p2 Mezcla.
    pub const PHASER: u8 = 2;
    /// Flanger: p0 Velocidad, p1 Retroalimentación, p2 Mezcla.
    pub const FLANGER: u8 = 3;
    /// Paneo automático: p0 Velocidad (al tempo), p1 Profundidad, p2 Modo (paneo o trémolo).
    pub const AUTOPAN: u8 = 4;
    /// Lo-fi: p0 Bits, p1 Muestreo, p2 Mezcla.
    pub const LOFI: u8 = 5;
    /// Distorsión: p0 Cantidad, p1 Tono, p2 Mezcla.
    pub const DISTORTION: u8 = 6;
    /// Compresor: p0 Cantidad, p1 Rapidez, p2 Ganancia.
    pub const COMPRESSOR: u8 = 7;
    /// Eco corto: p0 Tiempo, p1 Repeticiones, p2 Mezcla.
    pub const SLAPBACK: u8 = 8;
    /// Wobble: p0 Velocidad (al tempo), p1 Profundidad, p2 Resonancia.
    pub const WOBBLE: u8 = 9;
    /// Ensanchar: p0 Anchura, p1 Brillo de los lados, p2 Mezcla.
    pub const WIDTH: u8 = 10;
    /// Vinilo: p0 Crujido, p1 Oscilación, p2 Mezcla.
    pub const VINYL: u8 = 11;
    pub const COUNT: u8 = 12;
}

/// Tempo information for effects that follow the beat.
#[derive(Clone, Copy)]
pub struct FxCtx {
    pub sr: f32,
    pub bpm: f32,
    /// Song position in beats at the current sample.
    pub beat: f64,
}

/// Beats per LFO cycle for the tempo-synced effects, slow to fast
/// (the 2/3 and 1/3 are triplets).
const SYNC: [f64; 7] = [4.0, 2.0, 1.0, 2.0 / 3.0, 0.5, 1.0 / 3.0, 0.25];

#[inline]
fn sync_cycle(p: f32) -> f64 {
    SYNC[((p * (SYNC.len() - 1) as f32).round() as usize).min(SYNC.len() - 1)]
}

struct Line {
    buf: Box<[f32]>,
    pos: usize,
}

impl Line {
    fn new() -> Self {
        Line {
            buf: vec![0.0; LINE].into_boxed_slice(),
            pos: 0,
        }
    }
    fn clear(&mut self) {
        self.buf.fill(0.0);
        self.pos = 0;
    }
    #[inline]
    fn write(&mut self, x: f32) {
        self.buf[self.pos] = x;
        self.pos = (self.pos + 1) % LINE;
    }
    /// Reads `delay` samples back (fractional, at least 1).
    #[inline]
    fn read(&self, delay: f32) -> f32 {
        let d = delay.clamp(1.0, (LINE - 2) as f32);
        let i = d as usize;
        let f = d - i as f32;
        let a = self.buf[(self.pos + LINE - i) % LINE];
        let b = self.buf[(self.pos + LINE - i - 1) % LINE];
        a + (b - a) * f
    }
}

/// First-order all-pass, for the phaser.
#[derive(Clone, Copy, Default)]
struct Ap1 {
    x1: f32,
    y1: f32,
}

impl Ap1 {
    #[inline]
    fn process(&mut self, x: f32, a: f32) -> f32 {
        let y = -a * x + self.x1 + a * self.y1;
        self.x1 = x;
        self.y1 = y + ANTI_DENORMAL;
        y
    }
}

const PHASER_STAGES: usize = 6;

pub struct Insert {
    pub kind: u8,
    /// Values sent by the interface (the knobs).
    pub knobs: [f32; INSERT_PARAMS],
    /// Values in use (the knobs, or automation on top of them).
    p: [f32; INSERT_PARAMS],
    lines: [Line; 2],
    phase: f32,
    ap: [[Ap1; PHASER_STAGES]; 2],
    fb: [f32; 2],
    svf: [Svf; 2],
    tone: [OnePole; 2],
    hiss: [OnePole; 2],
    env: f32,
    hold: [f32; 2],
    count: f32,
    rng: Rng,
    crackle: f32,
    cr: u32,
}

impl Insert {
    pub fn new() -> Self {
        Insert {
            kind: fx_kind::NONE,
            knobs: [0.5; INSERT_PARAMS],
            p: [0.5; INSERT_PARAMS],
            lines: [Line::new(), Line::new()],
            phase: 0.0,
            ap: [[Ap1::default(); PHASER_STAGES]; 2],
            fb: [0.0; 2],
            svf: [Svf::default(); 2],
            tone: [OnePole::default(); 2],
            hiss: [OnePole::default(); 2],
            env: 0.0,
            hold: [0.0; 2],
            count: 0.0,
            rng: Rng::new(0x5EED),
            crackle: 0.0,
            cr: 0,
        }
    }

    #[inline]
    pub fn is_on(&self) -> bool {
        self.kind != fx_kind::NONE
    }

    /// Changes the effect. Clears its memory so the old one never leaks in.
    pub fn set_kind(&mut self, kind: u8, sr: f32) {
        let kind = if kind < fx_kind::COUNT {
            kind
        } else {
            fx_kind::NONE
        };
        if kind == self.kind {
            return;
        }
        self.kind = kind;
        for l in self.lines.iter_mut() {
            l.clear();
        }
        self.phase = 0.0;
        self.ap = [[Ap1::default(); PHASER_STAGES]; 2];
        self.fb = [0.0; 2];
        for f in self.svf.iter_mut() {
            f.reset();
        }
        self.env = 0.0;
        self.hold = [0.0; 2];
        self.count = 0.0;
        self.crackle = 0.0;
        let p = self.p;
        self.update(&p, sr);
    }

    /// A knob from the interface.
    pub fn set_knob(&mut self, idx: usize, v: f32, sr: f32) {
        if idx < INSERT_PARAMS {
            self.knobs[idx] = v.clamp(0.0, 1.0);
            let k = self.knobs;
            self.update(&k, sr);
        }
    }

    /// The values in use, when automation moves them. Cheap when unchanged.
    pub fn apply(&mut self, values: &[f32; INSERT_PARAMS], sr: f32) {
        if *values != self.p {
            self.update(values, sr);
        }
    }

    fn update(&mut self, values: &[f32; INSERT_PARAMS], sr: f32) {
        self.p = *values;
        match self.kind {
            fx_kind::DISTORTION => {
                for t in self.tone.iter_mut() {
                    t.set_hz(exp_map(values[1], 800.0, 14000.0), sr);
                }
            }
            fx_kind::VINYL => {
                for t in self.tone.iter_mut() {
                    t.set_hz(exp_map(1.0 - values[2] * 0.6, 3500.0, 12000.0), sr);
                }
                for h in self.hiss.iter_mut() {
                    h.set_hz(70.0, sr);
                }
            }
            fx_kind::WIDTH => {
                for t in self.tone.iter_mut() {
                    t.set_hz(exp_map(values[1], 300.0, 4000.0), sr);
                }
            }
            fx_kind::LOFI => {
                for t in self.tone.iter_mut() {
                    t.set_hz(exp_map(1.0 - values[1], 2500.0, 16000.0), sr);
                }
            }
            _ => {}
        }
    }

    #[inline]
    fn lfo(&mut self, hz: f32, sr: f32) -> f32 {
        self.phase += hz / sr;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }
        self.phase
    }

    /// One stereo sample through the effect.
    #[inline]
    pub fn process(&mut self, l: f32, r: f32, ctx: &FxCtx) -> (f32, f32) {
        let sr = ctx.sr;
        let [a, b, c] = self.p;
        match self.kind {
            fx_kind::CHORUS => {
                let ph = self.lfo(exp_map(a, 0.08, 3.0), sr);
                let depth = (0.0003 + b * 0.0055) * sr;
                let base = 0.012 * sr;
                self.lines[0].write(l);
                self.lines[1].write(r);
                let dl = base + depth * (0.5 + 0.5 * (TAU * ph).sin());
                let dr = base + depth * (0.5 + 0.5 * (TAU * ph + PI * 0.5).sin());
                let wl = self.lines[0].read(dl);
                let wr = self.lines[1].read(dr);
                (
                    l * (1.0 - c * 0.5) + wl * c * 0.8,
                    r * (1.0 - c * 0.5) + wr * c * 0.8,
                )
            }
            fx_kind::FLANGER => {
                let ph = self.lfo(exp_map(a, 0.04, 2.0), sr);
                let fb = b * 0.85;
                let base = 0.0006 * sr;
                let depth = 0.0045 * sr;
                let dl = base + depth * (0.5 + 0.5 * (TAU * ph).sin());
                let dr = base + depth * (0.5 + 0.5 * (TAU * ph + PI * 0.5).sin());
                let wl = self.lines[0].read(dl);
                let wr = self.lines[1].read(dr);
                self.lines[0].write(soft_clip(l + wl * fb));
                self.lines[1].write(soft_clip(r + wr * fb));
                (
                    l * (1.0 - c * 0.5) + wl * c * 0.7,
                    r * (1.0 - c * 0.5) + wr * c * 0.7,
                )
            }
            fx_kind::PHASER => {
                let ph = self.lfo(exp_map(a, 0.05, 3.0), sr);
                let mut out = [l, r];
                for (ch, x) in out.iter_mut().enumerate() {
                    let off = if ch == 0 { 0.0 } else { 0.25 };
                    let sweep = 0.5 + 0.5 * (TAU * (ph + off)).sin();
                    let f = exp_map(sweep * (0.3 + b * 0.7), 180.0, 4200.0);
                    let t = (PI * f / sr).tan();
                    let coef = (t - 1.0) / (t + 1.0);
                    let mut y = *x + self.fb[ch] * 0.45;
                    for st in self.ap[ch].iter_mut() {
                        y = st.process(y, coef);
                    }
                    self.fb[ch] = y;
                    *x = *x * (1.0 - c * 0.5) + y * c * 0.7;
                }
                (out[0], out[1])
            }
            fx_kind::AUTOPAN => {
                let ph = (ctx.beat / sync_cycle(a)).fract() as f32;
                let s = (TAU * ph).sin();
                if c < 0.5 {
                    let pan = s * b;
                    let (gl, gr) = pan_gains(pan);
                    (
                        l * gl * core::f32::consts::SQRT_2,
                        r * gr * core::f32::consts::SQRT_2,
                    )
                } else {
                    let g = 1.0 - b * (0.5 + 0.5 * s);
                    (l * g, r * g)
                }
            }
            fx_kind::LOFI => {
                let bits = exp_map(1.0 - a, 3.0, 16.0);
                let q = 2f32.powf(bits - 1.0);
                let factor = 1.0 + b * 19.0;
                self.count += 1.0;
                if self.count >= factor {
                    self.count -= factor;
                    self.hold = [(l * q).round() / q, (r * q).round() / q];
                }
                let wl = self.tone[0].lp(self.hold[0]);
                let wr = self.tone[1].lp(self.hold[1]);
                (l + (wl - l) * c, r + (wr - r) * c)
            }
            fx_kind::DISTORTION => {
                let drive = exp_map(a, 1.0, 30.0);
                let comp = 1.0 / (1.0 + drive * 0.12);
                let shape = |x: f32| soft_clip(x * drive + 0.08) - soft_clip(0.08);
                let wl = self.tone[0].lp(shape(l)) * comp * 1.6;
                let wr = self.tone[1].lp(shape(r)) * comp * 1.6;
                (l + (wl - l) * c, r + (wr - r) * c)
            }
            fx_kind::COMPRESSOR => {
                let peak = l.abs().max(r.abs());
                let attack = tau_coef(exp_map(1.0 - b, 0.001, 0.03), sr);
                let release = tau_coef(exp_map(1.0 - b, 0.05, 0.3), sr);
                let coef = if peak > self.env { attack } else { release };
                self.env = peak + (self.env - peak) * coef + ANTI_DENORMAL;
                let threshold = -6.0 - a * 34.0;
                let ratio = 2.0 + a * 8.0;
                let level = gain_to_db(self.env);
                let over = level - threshold;
                let reduce = if over > 0.0 {
                    over * (1.0 - 1.0 / ratio)
                } else {
                    0.0
                };
                // Make-up: half of the typical reduction, plus the Ganancia knob.
                let makeup = (a * 10.0) + (c - 0.5) * 24.0;
                let g = db_to_gain(makeup - reduce);
                (l * g, r * g)
            }
            fx_kind::SLAPBACK => {
                let t = (0.035 + a * 0.13) * sr;
                let fb = b * 0.7;
                let wl = self.lines[0].read(t);
                let wr = self.lines[1].read(t * 1.07 + 0.004 * sr);
                self.lines[0].write(l + wl * fb);
                self.lines[1].write(r + wr * fb);
                (l + wl * c * 0.8, r + wr * c * 0.8)
            }
            fx_kind::WOBBLE => {
                if self.cr.is_multiple_of(16) {
                    let ph = (ctx.beat / sync_cycle(a)).fract() as f32;
                    // Smooth rise and fall, like the classic "wub".
                    let shape = 0.5 - 0.5 * (TAU * ph).cos();
                    let lo = 90.0;
                    let hi = exp_map(0.25 + b * 0.75, 200.0, 9000.0);
                    let cut = lo * (hi / lo).powf(shape);
                    for f in self.svf.iter_mut() {
                        f.set(cut, c * 0.9, sr);
                    }
                }
                self.cr = self.cr.wrapping_add(1);
                (self.svf[0].lp(l), self.svf[1].lp(r))
            }
            fx_kind::WIDTH => {
                let d = 0.0005 * sr + a * 0.018 * sr;
                self.lines[0].write(r);
                let delayed = self.lines[0].read(d);
                let mid = (l + r) * 0.5;
                let side = (l - r) * 0.5 + (delayed - mid) * a;
                let side = side + self.tone[0].lp(side) * (b - 0.5) * 0.5;
                let wl = mid + side * (1.0 + a);
                let wr = mid - side * (1.0 + a);
                (l + (wl - l) * c, r + (wr - r) * c)
            }
            fx_kind::VINYL => {
                // Wow: a slow, small pitch wobble through a short delay.
                let ph = self.lfo(0.55, sr);
                let d = 0.004 * sr + b * 0.0025 * sr * (TAU * ph).sin();
                self.lines[0].write(l);
                self.lines[1].write(r);
                let wl = self.lines[0].read(d);
                let wr = self.lines[1].read(d);
                // Crackle: sparse clicks, plus a little hiss.
                if self.rng.unit() < a * 0.0012 {
                    self.crackle = self.rng.noise() * (0.3 + a * 0.6);
                }
                let click = self.crackle;
                self.crackle *= 0.55;
                let hiss = self.rng.noise() * a * 0.012;
                let nl = self.hiss[0].hp(self.tone[0].lp(wl) + click + hiss);
                let nr = self.hiss[1].hp(self.tone[1].lp(wr) + click + hiss);
                (l + (nl - l) * c, r + (nr - r) * c)
            }
            _ => (l, r),
        }
    }
}

impl Default for Insert {
    fn default() -> Self {
        Self::new()
    }
}
