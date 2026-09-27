//! Per-track insert effects: saturation, 3-band EQ and a one-knob DJ filter.
//! Coefficients change only when a command arrives, never per sample.

use crate::dsp::{exp_map, soft_clip, Svf, ANTI_DENORMAL};
use core::f32::consts::PI;

/// Shelf or bell EQ band on the trapezoidal SVF (Andrew Simper's
/// "SvfLinearTrapOptimised2" mixing coefficients).
#[derive(Clone, Copy, Default)]
struct EqBand {
    ic1: f32,
    ic2: f32,
    a1: f32,
    a2: f32,
    a3: f32,
    m0: f32,
    m1: f32,
    m2: f32,
}

#[derive(Clone, Copy, PartialEq)]
enum Shape {
    LowShelf,
    Bell,
    HighShelf,
}

impl EqBand {
    fn set(&mut self, shape: Shape, fc: f32, q: f32, db: f32, sr: f32) {
        let a = 10f32.powf(db / 40.0);
        let t = (PI * fc.clamp(10.0, sr * 0.45) / sr).tan();
        let (g, k) = match shape {
            Shape::LowShelf => (t / a.sqrt(), 1.0 / q),
            Shape::HighShelf => (t * a.sqrt(), 1.0 / q),
            Shape::Bell => (t, 1.0 / (q * a)),
        };
        self.a1 = 1.0 / (1.0 + g * (g + k));
        self.a2 = g * self.a1;
        self.a3 = g * self.a2;
        let (m0, m1, m2) = match shape {
            Shape::LowShelf => (1.0, k * (a - 1.0), a * a - 1.0),
            Shape::HighShelf => (a * a, k * (1.0 - a) * a, 1.0 - a * a),
            Shape::Bell => (1.0, k * (a * a - 1.0), 0.0),
        };
        self.m0 = m0;
        self.m1 = m1;
        self.m2 = m2;
    }

    #[inline]
    fn process(&mut self, v0: f32) -> f32 {
        let v3 = v0 - self.ic2;
        let v1 = self.a1 * self.ic1 + self.a2 * v3;
        let v2 = self.ic2 + self.a2 * self.ic1 + self.a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1 + ANTI_DENORMAL;
        self.ic2 = 2.0 * v2 - self.ic2 + ANTI_DENORMAL;
        self.m0 * v0 + self.m1 * v1 + self.m2 * v2
    }
}

const BANDS: [(Shape, f32, f32); 3] = [
    (Shape::LowShelf, 180.0, 0.7),
    (Shape::Bell, 1200.0, 0.8),
    (Shape::HighShelf, 5000.0, 0.7),
];

#[derive(Clone, Copy)]
pub struct TrackFx {
    drive: f32,
    pre: f32,
    post: f32,
    eq: [EqBand; 3],
    eq_on: [bool; 3],
    sr: f32,
    filt: Svf,
    /// 0 = off, 1 = low-pass, 2 = high-pass.
    mode: u8,
    pub filter: f32,
    pub eq_db: [f32; 3],
}

impl TrackFx {
    pub fn new(sr: f32) -> Self {
        let mut fx = TrackFx {
            drive: 0.0,
            pre: 1.0,
            post: 1.0,
            eq: [EqBand::default(); 3],
            eq_on: [false; 3],
            sr,
            filt: Svf::default(),
            mode: 0,
            filter: 0.5,
            eq_db: [0.0; 3],
        };
        for b in 0..3 {
            fx.set_eq(b, 0.0);
        }
        fx
    }

    pub fn set_drive(&mut self, amount: f32) {
        self.drive = amount.clamp(0.0, 1.0);
        self.pre = 1.0 + self.drive * 7.0;
        self.post = 1.0 / (1.0 + self.drive * 1.6);
    }

    pub fn set_eq(&mut self, band: usize, db: f32) {
        if band >= 3 {
            return;
        }
        let db = db.clamp(-24.0, 12.0);
        self.eq_db[band] = db;
        let (shape, fc, q) = BANDS[band];
        self.eq[band].set(shape, fc, q, db, self.sr);
        self.eq_on[band] = db.abs() >= 0.05;
    }

    pub fn set_filter(&mut self, v: f32, sr: f32) {
        let v = v.clamp(0.0, 1.0);
        self.filter = v;
        if (v - 0.5).abs() < 0.015 {
            self.mode = 0;
        } else if v < 0.5 {
            let cut = exp_map(v / 0.5, 90.0, 18_000.0);
            if self.mode != 1 {
                self.filt.reset();
            }
            self.filt.set(cut, 0.25, sr);
            self.mode = 1;
        } else {
            let cut = exp_map((v - 0.5) / 0.5, 25.0, 7_000.0);
            if self.mode != 2 {
                self.filt.reset();
            }
            self.filt.set(cut, 0.25, sr);
            self.mode = 2;
        }
    }

    #[inline]
    pub fn is_neutral(&self) -> bool {
        self.drive <= 0.001 && self.mode == 0 && !self.eq_on[0] && !self.eq_on[1] && !self.eq_on[2]
    }

    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        let mut y = x;
        if self.drive > 0.001 {
            y = soft_clip(y * self.pre) * self.post;
        }
        for b in 0..3 {
            if self.eq_on[b] {
                y = self.eq[b].process(y);
            }
        }
        match self.mode {
            1 => self.filt.lp(y),
            2 => self.filt.hp(y),
            _ => y,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Amplitude of the output for a 0.5 sine (RMS based, so it works near Nyquist).
    fn tone_level(fx: &mut TrackFx, hz: f32, sr: f32) -> f32 {
        let (mut sum, mut n) = (0.0f64, 0u32);
        for i in 0..(sr as usize) {
            let x = (core::f32::consts::TAU * hz * i as f32 / sr).sin() * 0.5;
            let y = fx.process(x);
            if i >= sr as usize / 2 {
                sum += (y as f64) * (y as f64);
                n += 1;
            }
        }
        ((sum / n as f64).sqrt() * core::f64::consts::SQRT_2) as f32
    }

    #[test]
    fn neutral_is_transparent() {
        let sr = 48_000.0;
        let mut fx = TrackFx::new(sr);
        assert!(fx.is_neutral());
        let l = tone_level(&mut fx, 440.0, sr);
        assert!((l - 0.5).abs() < 1e-3, "level {l}");
    }

    #[test]
    fn low_pass_filter_darkens() {
        let sr = 48_000.0;
        let mut fx = TrackFx::new(sr);
        fx.set_filter(0.15, sr);
        let hi = tone_level(&mut fx, 6_000.0, sr);
        let mut fx2 = TrackFx::new(sr);
        fx2.set_filter(0.15, sr);
        let lo = tone_level(&mut fx2, 100.0, sr);
        assert!(hi < 0.05 && lo > 0.3, "hi {hi} lo {lo}");
    }

    #[test]
    fn eq_cut_lowers_band() {
        let sr = 48_000.0;
        let mut fx = TrackFx::new(sr);
        fx.set_eq(0, -24.0);
        let l = tone_level(&mut fx, 60.0, sr);
        assert!(l < 0.1, "low shelf cut left {l}");
        let mut fx = TrackFx::new(sr);
        fx.set_eq(2, 6.0);
        let h = tone_level(&mut fx, 12_000.0, sr);
        assert!(h > 0.9 && h < 1.05, "high shelf boost gave {h}");
        let mut fx = TrackFx::new(sr);
        fx.set_eq(1, -12.0);
        let m = tone_level(&mut fx, 1_200.0, sr);
        assert!(m < 0.14 && m > 0.11, "bell cut gave {m}");
        let mut fx = TrackFx::new(sr);
        fx.set_eq(0, -12.0);
        let untouched = tone_level(&mut fx, 8_000.0, sr);
        assert!(
            (untouched - 0.5).abs() < 0.03,
            "low shelf touched highs: {untouched}"
        );
    }
}
