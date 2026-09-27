//! Sampler: plays audio loaded into the engine's sample bank (your voice,
//! a dragged file, a chop). Up to four overlapping voices per track.
//! p0 Tono (-12..+12 st), p1 Inicio (0..50 % of the sample), p2 Cola, p3 Filtro.

use crate::dsp::*;

pub struct SampleBuf {
    pub data: Box<[f32]>,
    pub sr: f32,
}

pub const SAMPLER_VOICES: usize = 4;

#[derive(Clone, Copy)]
struct SVoice {
    pos: f64,
    rate: f64,
    active: bool,
    amp: Adsr,
    vel: f32,
    note: u8,
    filt: Svf,
}

impl SVoice {
    fn new() -> Self {
        SVoice { pos: 0.0, rate: 1.0, active: false, amp: Adsr::default(), vel: 0.0, note: 60, filt: Svf::default() }
    }
}

#[derive(Clone, Copy)]
pub struct Sampler {
    voices: [SVoice; SAMPLER_VOICES],
    pub slot: usize,
    next: usize,
    tune: f32,
    start: f32,
    cut: f32,
}

impl Sampler {
    pub fn new(sr: f32) -> Self {
        let mut s = Sampler { voices: [SVoice::new(); SAMPLER_VOICES], slot: 0, next: 0, tune: 0.0, start: 0.0, cut: 16000.0 };
        s.set_params(&[0.5, 0.0, 0.6, 1.0], sr);
        s
    }

    pub fn set_params(&mut self, p: &[f32], sr: f32) {
        self.tune = (p[0] - 0.5) * 24.0;
        self.start = p[1] * 0.5;
        let tail = exp_map(p[2], 0.02, 3.0);
        self.cut = exp_map(p[3], 300.0, 18000.0);
        for v in self.voices.iter_mut() {
            v.amp.set(0.001, 30.0, 1.0, tail, sr);
            v.filt.set(self.cut, 0.1, sr);
        }
    }

    pub fn note_on(&mut self, note: u8, vel: f32, bank: &[Option<SampleBuf>], sr: f32) {
        let Some(Some(buf)) = bank.get(self.slot) else { return };
        if buf.data.is_empty() {
            return;
        }
        let v = &mut self.voices[self.next];
        self.next = (self.next + 1) % SAMPLER_VOICES;
        let semis = (note as f32 - 60.0) + self.tune;
        v.rate = (buf.sr / sr) as f64 * 2f64.powf(semis as f64 / 12.0);
        v.pos = (self.start as f64) * buf.data.len() as f64;
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
        let Some(Some(buf)) = bank.get(self.slot) else { return 0.0 };
        let data = &buf.data;
        let n = data.len();
        let mut out = 0.0;
        for v in self.voices.iter_mut() {
            if !v.active {
                continue;
            }
            let i = v.pos as usize;
            if i + 1 >= n {
                v.active = false;
                continue;
            }
            let frac = (v.pos - i as f64) as f32;
            let s = data[i] + (data[i + 1] - data[i]) * frac;
            let a = v.amp.next();
            if !v.amp.is_active() {
                v.active = false;
            }
            out += v.filt.lp(s) * a * v.vel;
            v.pos += v.rate;
        }
        out
    }
}
