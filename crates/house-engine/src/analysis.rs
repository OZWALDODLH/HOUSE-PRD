//! Lightweight analysis of the master for the visuals window and the meters:
//! 16 log-spaced bands (40 Hz – 12 kHz) with envelope followers.

use crate::dsp::*;

pub const BANDS: usize = 16;

pub struct Analyzer {
    filters: [Svf; BANDS],
    env: [f32; BANDS],
    att: f32,
    rel: f32,
    decim: u32,
}

impl Analyzer {
    pub fn new(sr: f32) -> Self {
        let mut filters = [Svf::default(); BANDS];
        for (i, f) in filters.iter_mut().enumerate() {
            let t = i as f32 / (BANDS - 1) as f32;
            // The analyzer runs at half rate, so the filters use sr / 2.
            f.set_q(exp_map(t, 40.0, 10_000.0), 2.2, sr / 2.0);
        }
        Analyzer {
            filters,
            env: [0.0; BANDS],
            att: 1.0 - tau_coef(0.004, sr / 2.0),
            rel: 1.0 - tau_coef(0.14, sr / 2.0),
            decim: 0,
        }
    }

    /// Feed one mono sample. Runs at half rate to keep it cheap.
    #[inline]
    pub fn feed(&mut self, x: f32) {
        self.decim = self.decim.wrapping_add(1);
        if self.decim & 1 == 1 {
            return;
        }
        for i in 0..BANDS {
            let y = self.filters[i].bp(x).abs();
            let c = if y > self.env[i] { self.att } else { self.rel };
            self.env[i] += (y - self.env[i]) * c;
        }
    }

    /// Band levels mapped to 0..1 (about -60..0 dB).
    pub fn bands(&self, out: &mut [f32]) {
        for i in 0..BANDS.min(out.len()) {
            let db = gain_to_db(self.env[i] * 3.0);
            out[i] = ((db + 60.0) / 60.0).clamp(0.0, 1.0);
        }
    }
}
