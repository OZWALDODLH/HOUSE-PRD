//! Shared effects: reverb ("Espacio"), ping-pong delay ("Eco"), glue
//! compressor and look-ahead limiter for the master. Buffers are allocated once
//! in `new()`; `process` never allocates.

use crate::dsp::*;

// --------------------------------------------------------------- helpers ---

struct DelayLine {
    buf: Box<[f32]>,
    pos: usize,
}

impl DelayLine {
    fn new(len: usize) -> Self {
        DelayLine { buf: vec![0.0; len.max(4)].into_boxed_slice(), pos: 0 }
    }
    #[inline]
    fn read(&self, delay: usize) -> f32 {
        let n = self.buf.len();
        let d = delay.min(n - 1);
        self.buf[(self.pos + n - d) % n]
    }
    #[inline]
    fn read_frac(&self, delay: f32) -> f32 {
        let d = delay.max(1.0);
        let i = d as usize;
        let f = d - i as f32;
        let a = self.read(i);
        let b = self.read(i + 1);
        a + (b - a) * f
    }
    #[inline]
    fn write(&mut self, x: f32) {
        self.buf[self.pos] = x;
        self.pos = (self.pos + 1) % self.buf.len();
    }
}

struct Allpass {
    line: DelayLine,
    len: usize,
    g: f32,
}

impl Allpass {
    fn new(len: usize, g: f32) -> Self {
        Allpass { line: DelayLine::new(len + 1), len, g }
    }
    #[inline]
    fn process(&mut self, x: f32) -> f32 {
        let d = self.line.read(self.len);
        let v = x + d * self.g;
        self.line.write(v + ANTI_DENORMAL);
        d - v * self.g
    }
}

// ---------------------------------------------------------------- Reverb ---

const FDN: usize = 8;
const FDN_LENS: [f32; FDN] = [0.0297, 0.0371, 0.0411, 0.0437, 0.0533, 0.0613, 0.0677, 0.0743];

/// 8-line feedback delay network with diffusion and damping.
pub struct Reverb {
    lines: [DelayLine; FDN],
    lens: [usize; FDN],
    damp: [OnePole; FDN],
    diff: [Allpass; 4],
    pre: DelayLine,
    pre_len: usize,
    fb: f32,
    hp: OnePole,
}

impl Reverb {
    pub fn new(sr: f32) -> Self {
        let scale = sr / 48_000.0;
        let lines = core::array::from_fn(|i| DelayLine::new((FDN_LENS[i] * 2.2 * sr) as usize + 8));
        let lens = core::array::from_fn(|i| (FDN_LENS[i] * sr) as usize);
        let damp = core::array::from_fn(|_| {
            let mut p = OnePole::default();
            p.set_hz(6000.0, sr);
            p
        });
        let diff = [
            Allpass::new((142.0 * scale) as usize, 0.6),
            Allpass::new((107.0 * scale) as usize, 0.6),
            Allpass::new((379.0 * scale) as usize, 0.55),
            Allpass::new((277.0 * scale) as usize, 0.55),
        ];
        let mut hp = OnePole::default();
        hp.set_hz(180.0, sr);
        let mut r = Reverb { lines, lens, damp, diff, pre: DelayLine::new((0.1 * sr) as usize), pre_len: (0.012 * sr) as usize, fb: 0.8, hp };
        r.set(0.55, 0.5, sr);
        r
    }

    /// size 0..1 (room to hall), damping 0..1 (bright to dark).
    pub fn set(&mut self, size: f32, damping: f32, sr: f32) {
        let s = 0.55 + size * 1.1;
        for i in 0..FDN {
            self.lens[i] = ((FDN_LENS[i] * s * sr) as usize).min(self.lines[i].buf.len() - 2);
            self.damp[i].set_hz(exp_map(1.0 - damping, 1800.0, 12000.0), sr);
        }
        // Decay: longer rooms feed back more.
        self.fb = 0.72 + size * 0.22;
    }

    #[inline]
    pub fn process(&mut self, x: f32) -> (f32, f32) {
        let x = self.hp.hp(x);
        self.pre.write(x);
        let mut d = self.pre.read(self.pre_len);
        for a in self.diff.iter_mut() {
            d = a.process(d);
        }
        let mut o = [0.0f32; FDN];
        for i in 0..FDN {
            o[i] = self.lines[i].read(self.lens[i]);
        }
        // Fast Walsh-Hadamard mix (energy preserving with the 1/sqrt(8) factor).
        let mut h = o;
        let mut len = 1;
        while len < FDN {
            let mut i = 0;
            while i < FDN {
                for j in i..i + len {
                    let a = h[j];
                    let b = h[j + len];
                    h[j] = a + b;
                    h[j + len] = a - b;
                }
                i += len * 2;
            }
            len *= 2;
        }
        let norm = 0.353_553_4; // 1/sqrt(8)
        for i in 0..FDN {
            let fbv = self.damp[i].lp(h[i] * norm) * self.fb;
            let inj = if i % 2 == 0 { d } else { -d };
            self.lines[i].write(inj * 0.5 + fbv);
        }
        let l = (o[0] + o[2] + o[4] + o[6]) * 0.3;
        let r = (o[1] + o[3] + o[5] + o[7]) * 0.3;
        (l, r)
    }
}

// ------------------------------------------------------------ Ping-pong ---

pub struct PingPong {
    l: DelayLine,
    r: DelayLine,
    time: Smooth,
    pub feedback: f32,
    lp: [OnePole; 2],
    hp: [OnePole; 2],
}

impl PingPong {
    pub fn new(sr: f32) -> Self {
        let mut lp = [OnePole::default(); 2];
        let mut hp = [OnePole::default(); 2];
        for f in lp.iter_mut() {
            f.set_hz(4500.0, sr);
        }
        for f in hp.iter_mut() {
            f.set_hz(250.0, sr);
        }
        PingPong {
            l: DelayLine::new((2.1 * sr) as usize),
            r: DelayLine::new((2.1 * sr) as usize),
            time: Smooth::new(0.3 * sr, 0.08, sr),
            feedback: 0.38,
            lp,
            hp,
        }
    }

    pub fn set_time(&mut self, samples: f32) {
        self.time.set(samples.clamp(64.0, (self.l.buf.len() - 4) as f32));
    }

    #[inline]
    pub fn process(&mut self, x: f32) -> (f32, f32) {
        let t = self.time.next();
        let ol = self.l.read_frac(t);
        let or = self.r.read_frac(t);
        let fl = self.hp[0].hp(self.lp[0].lp(or * self.feedback));
        let fr = self.hp[1].hp(self.lp[1].lp(ol * self.feedback));
        self.l.write(x + fl);
        self.r.write(fr);
        (ol, or)
    }
}

// ------------------------------------------------------------ Compressor ---

/// Gentle stereo-linked "glue" compressor. amount 0..1 lowers the threshold
/// and adds make-up gain.
pub struct Glue {
    env: f32,
    att: f32,
    rel: f32,
    thresh_db: f32,
    ratio: f32,
    makeup: f32,
    pub gr_db: f32,
}

impl Glue {
    pub fn new(sr: f32) -> Self {
        let mut g = Glue { env: 0.0, att: tau_coef(0.01, sr), rel: tau_coef(0.15, sr), thresh_db: 0.0, ratio: 2.0, makeup: 1.0, gr_db: 0.0 };
        g.set_amount(0.3);
        g
    }
    pub fn set_amount(&mut self, amount: f32) {
        let a = amount.clamp(0.0, 1.0);
        self.thresh_db = -4.0 - a * 16.0;
        self.ratio = 1.5 + a * 2.5;
        self.makeup = db_to_gain(a * 6.0);
    }
    #[inline]
    pub fn process(&mut self, l: f32, r: f32) -> (f32, f32) {
        let x = l.abs().max(r.abs());
        let c = if x > self.env { self.att } else { self.rel };
        self.env = x + (self.env - x) * c;
        let lvl = gain_to_db(self.env);
        let over = lvl - self.thresh_db;
        let gr = if over > 0.0 { over * (1.0 - 1.0 / self.ratio) } else { 0.0 };
        self.gr_db = gr;
        let g = db_to_gain(-gr) * self.makeup;
        (l * g, r * g)
    }
}

// --------------------------------------------------------------- Limiter ---

const LOOKAHEAD: usize = 64;

/// Look-ahead peak limiter: the gain starts dropping before the peak arrives,
/// so the master never goes over the ceiling.
pub struct Limiter {
    dl: [f32; LOOKAHEAD],
    dr: [f32; LOOKAHEAD],
    targets: [f32; LOOKAHEAD],
    pos: usize,
    gain: f32,
    att: f32,
    rel: f32,
    pub ceiling: f32,
    pub gr_db: f32,
}

impl Limiter {
    pub fn new(sr: f32) -> Self {
        Limiter {
            dl: [0.0; LOOKAHEAD],
            dr: [0.0; LOOKAHEAD],
            targets: [1.0; LOOKAHEAD],
            pos: 0,
            gain: 1.0,
            att: 1.0 - tau_coef(LOOKAHEAD as f32 / sr / 3.0, sr),
            rel: 1.0 - tau_coef(0.12, sr),
            ceiling: db_to_gain(-1.0),
            gr_db: 0.0,
        }
    }
    #[inline]
    pub fn process(&mut self, l: f32, r: f32) -> (f32, f32) {
        let peak = l.abs().max(r.abs());
        let target = if peak > self.ceiling { self.ceiling / peak } else { 1.0 };
        self.targets[self.pos] = target;
        let mut min = 1.0f32;
        for &t in self.targets.iter() {
            if t < min {
                min = t;
            }
        }
        let c = if min < self.gain { self.att } else { self.rel };
        self.gain += (min - self.gain) * c;
        let ol = self.dl[self.pos];
        let or = self.dr[self.pos];
        self.dl[self.pos] = l;
        self.dr[self.pos] = r;
        self.pos = (self.pos + 1) % LOOKAHEAD;
        self.gr_db = -gain_to_db(self.gain);
        let c = self.ceiling;
        ((ol * self.gain).clamp(-c, c), (or * self.gain).clamp(-c, c))
    }
}
