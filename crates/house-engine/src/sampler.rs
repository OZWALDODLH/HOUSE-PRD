//! Sampler: plays audio loaded into the engine's sample bank (your voice,
//! a dragged file, a chop). Up to four overlapping voices per track.
//! The cut is non-destructive: the whole recording stays in the bank and each
//! track plays its own region, so a trim can always be undone and one
//! recording can feed many pads (chops).
//! p0 Tono (-12..+12 st), p1 Inicio (extra offset inside the region),
//! p2 Cola, p3 Filtro, p4 Recorte: inicio (0..1), p5 Recorte: final (0..1),
//! p6 Suavizado (fade at both ends), p7 Al revés (> 0.5).

use crate::dsp::*;

pub struct SampleBuf {
    pub data: Box<[f32]>,
    pub sr: f32,
}

pub const SAMPLER_VOICES: usize = 4;
/// Shortest fade at the edges of a region, in seconds, so a cut never clicks.
const MIN_FADE: f32 = 0.0015;

#[derive(Clone, Copy)]
struct SVoice {
    pos: f64,
    rate: f64,
    /// Region in samples of the buffer: `from` < `to`.
    from: f64,
    to: f64,
    /// Fade lengths in samples at the region's start and end (0 = none).
    fade_in: f64,
    fade_out: f64,
    active: bool,
    amp: Adsr,
    vel: f32,
    note: u8,
    filt: Svf,
}

impl SVoice {
    fn new() -> Self {
        SVoice {
            pos: 0.0,
            rate: 1.0,
            from: 0.0,
            to: 0.0,
            fade_in: 0.0,
            fade_out: 0.0,
            active: false,
            amp: Adsr::default(),
            vel: 0.0,
            note: 60,
            filt: Svf::default(),
        }
    }
}

#[derive(Clone, Copy)]
pub struct Sampler {
    voices: [SVoice; SAMPLER_VOICES],
    pub slot: usize,
    next: usize,
    tune: f32,
    offset: f32,
    cut: f32,
    region: (f32, f32),
    smooth: f32,
    reverse: bool,
}

impl Sampler {
    pub fn new(sr: f32) -> Self {
        let mut s = Sampler {
            voices: [SVoice::new(); SAMPLER_VOICES],
            slot: 0,
            next: 0,
            tune: 0.0,
            offset: 0.0,
            cut: 16000.0,
            region: (0.0, 1.0),
            smooth: 0.0,
            reverse: false,
        };
        s.set_params(&[0.5, 0.0, 0.6, 1.0, 0.0, 1.0, 0.0, 0.0], sr);
        s
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.tune = (p[0] - 0.5) * 24.0;
        self.offset = p[1] * 0.5;
        let tail = exp_map(p[2], 0.02, 3.0);
        self.cut = exp_map(p[3], 300.0, 18000.0);
        let a = p[4].clamp(0.0, 1.0);
        let b = p[5].clamp(0.0, 1.0);
        self.region = if b > a + 0.0005 { (a, b) } else { (0.0, 1.0) };
        self.smooth = p[6].clamp(0.0, 1.0);
        self.reverse = p[7] > 0.5;
        for v in self.voices.iter_mut() {
            v.amp.set(0.001, 30.0, 1.0, tail, sr);
            v.filt.set(self.cut, 0.1, sr);
        }
    }

    pub fn note_on(&mut self, note: u8, vel: f32, bank: &[Option<SampleBuf>], sr: f32) {
        let Some(Some(buf)) = bank.get(self.slot) else {
            return;
        };
        let len = buf.data.len();
        if len < 2 {
            return;
        }
        let v = &mut self.voices[self.next];
        self.next = (self.next + 1) % SAMPLER_VOICES;
        let semis = (note as f32 - 60.0) + self.tune;
        let rate = (buf.sr / sr) as f64 * 2f64.powf(semis as f64 / 12.0);
        let last = (len - 1) as f64;
        let from = (self.region.0 as f64 * last).floor();
        let to = (self.region.1 as f64 * last).ceil().max(from + 1.0);
        let span = to - from;
        // Edges that were cut get a tiny fade so they never click; the
        // "Suavizado" knob makes both fades longer.
        let fade = (((MIN_FADE + self.smooth * 0.06) * buf.sr) as f64)
            .min(span * 0.5)
            .max(1.0);
        let cut_start = from > 0.0 || self.smooth > 0.0;
        let cut_end = to < last || self.smooth > 0.0;
        let (head, tail) = if self.reverse {
            (cut_end, cut_start)
        } else {
            (cut_start, cut_end)
        };
        v.fade_in = if head { fade } else { 0.0 };
        v.fade_out = if tail { fade } else { 0.0 };
        v.from = from;
        v.to = to;
        let skip = self.offset as f64 * span;
        if self.reverse {
            // `to` is where the region ends; the last sample inside it is one before.
            v.pos = (to - 1.0 - skip).max(from);
            v.rate = -rate;
        } else {
            v.pos = from + skip;
            v.rate = rate;
        }
        v.active = true;
        v.vel = vel;
        v.note = note;
        v.amp.gate_on();
        v.filt.set(self.cut, 0.1, sr);
    }

    pub fn note_off(&mut self, note: u8) {
        for v in self.voices.iter_mut() {
            if v.active && (v.note == note || note == 255) {
                v.amp.gate_off();
            }
        }
    }

    #[inline]
    pub fn next(&mut self, bank: &[Option<SampleBuf>]) -> f32 {
        let Some(Some(buf)) = bank.get(self.slot) else {
            return 0.0;
        };
        let data = &buf.data;
        let n = data.len();
        let mut out = 0.0;
        for v in self.voices.iter_mut() {
            if !v.active {
                continue;
            }
            if v.pos < v.from || v.pos >= v.to || n < 2 {
                v.active = false;
                continue;
            }
            let i = (v.pos as usize).min(n - 2);
            let frac = (v.pos - i as f64) as f32;
            let s = data[i] + (data[i + 1] - data[i]) * frac;
            // Distance travelled since the note started and left until the end.
            let (done, left) = if v.rate >= 0.0 {
                (v.pos - v.from, v.to - v.pos)
            } else {
                (v.to - v.pos, v.pos - v.from)
            };
            let mut g = 1.0f32;
            if done < v.fade_in {
                g = (done / v.fade_in) as f32;
            }
            if left < v.fade_out {
                g = g.min((left / v.fade_out) as f32);
            }
            let a = v.amp.next();
            if !v.amp.is_active() {
                v.active = false;
            }
            out += v.filt.lp(s) * a * v.vel * g;
            v.pos += v.rate;
        }
        out
    }
}
