//! One instrument: whichever drum or synth a track (or a soundboard shot, or
//! the browser preview) plays, behind the same few calls.

use crate::drums::{DrumModel, DrumVoice};
use crate::engine::{kind, NUM_PARAMS};
use crate::fm::Fm;
use crate::pluck::Pluck;
use crate::sampler::{SampleBuf, Sampler};
use crate::supersaw::SuperSaw;
use crate::synths::{Acid, Bass808, Poly};

#[derive(Clone, Copy)]
pub enum Inst {
    None,
    Drum(DrumVoice),
    Acid(Acid),
    Bass(Bass808),
    Poly(Poly),
    Sampler(Sampler),
    Fm(Fm),
    Super(SuperSaw),
    Pluck(Pluck),
}

/// What an instrument may need besides its own state.
pub struct Ctx<'a> {
    pub sr: f32,
    pub bpm: f32,
    pub bank: &'a [Option<SampleBuf>],
}

impl Inst {
    pub fn new(k: u8, model: u8, sr: f32, seed: u32) -> Inst {
        match k {
            kind::DRUM => Inst::Drum(DrumVoice::new(DrumModel::from_u8(model), seed)),
            kind::ACID => Inst::Acid(Acid::new(sr)),
            kind::BASS808 => Inst::Bass(Bass808::new(sr)),
            kind::POLY => Inst::Poly(Poly::new(sr)),
            kind::SAMPLER => Inst::Sampler(Sampler::new(sr)),
            kind::FM => Inst::Fm(Fm::new(sr)),
            kind::SUPER => Inst::Super(SuperSaw::new(sr)),
            kind::PLUCK => Inst::Pluck(Pluck::new(sr, seed)),
            _ => Inst::None,
        }
    }

    pub fn set_params(&mut self, p: &[f32; NUM_PARAMS], sr: f32) {
        match self {
            Inst::Acid(a) => a.set_params(p),
            Inst::Bass(b) => b.set_params(p, sr),
            Inst::Poly(x) => x.set_params(p, sr),
            Inst::Sampler(s) => s.set_params(p, sr),
            Inst::Fm(f) => f.set_params(p, sr),
            Inst::Super(s) => s.set_params(p, sr),
            Inst::Pluck(x) => x.set_params(p, sr),
            Inst::None | Inst::Drum(_) => {}
        }
    }

    /// Plays chords: every note of a step sounds at once.
    pub fn is_poly(&self) -> bool {
        matches!(
            self,
            Inst::Poly(_) | Inst::Fm(_) | Inst::Super(_) | Inst::Pluck(_)
        )
    }

    /// Starts a note (drums ignore the note and read their knobs).
    #[allow(clippy::too_many_arguments)]
    pub fn start(
        &mut self,
        note: u8,
        vel: f32,
        slide: bool,
        accent: bool,
        params: &[f32; NUM_PARAMS],
        ctx: &Ctx,
        scratch: &mut [f32],
    ) {
        let sr = ctx.sr;
        match self {
            Inst::None => {}
            Inst::Drum(v) => v.trigger(vel, params, sr, ctx.bpm),
            Inst::Acid(a) => a.note_on(note, vel, slide, accent, sr),
            Inst::Bass(b) => b.note_on(note, vel, slide, sr),
            Inst::Poly(p) => p.note_on(note, vel),
            Inst::Sampler(s) => s.note_on(note, vel, ctx.bank, sr),
            Inst::Fm(f) => f.note_on(note, vel, sr),
            Inst::Super(s) => s.note_on(note, vel),
            Inst::Pluck(p) => p.note_on(note, vel, sr, scratch),
        }
    }

    /// Releases a note; 255 releases all of them.
    pub fn stop(&mut self, note: u8) {
        match self {
            Inst::Acid(a) => a.note_off(note),
            Inst::Bass(b) => b.note_off(note),
            Inst::Poly(p) => p.note_off(note),
            Inst::Sampler(s) => s.note_off(note),
            Inst::Fm(f) => f.note_off(note),
            Inst::Super(s) => s.note_off(note),
            Inst::Pluck(p) => p.note_off(note),
            Inst::None | Inst::Drum(_) => {}
        }
    }

    /// Cuts drums at once (hi-hat choke, all notes off).
    pub fn choke(&mut self, sr: f32) {
        if let Inst::Drum(v) = self {
            v.choke(sr);
        }
    }

    /// The drum model, when this is a drum.
    pub fn drum_model(&self) -> Option<DrumModel> {
        match self {
            Inst::Drum(v) => Some(v.model),
            _ => None,
        }
    }

    /// Renders `out.len()` samples (mono).
    pub fn render(&mut self, out: &mut [f32], ctx: &Ctx, scratch: &mut [f32]) {
        let sr = ctx.sr;
        match self {
            Inst::None => out.fill(0.0),
            Inst::Drum(v) => {
                for x in out.iter_mut() {
                    *x = v.next(sr);
                }
            }
            Inst::Acid(a) => {
                for x in out.iter_mut() {
                    *x = a.next(sr);
                }
            }
            Inst::Bass(b) => {
                for x in out.iter_mut() {
                    *x = b.next(sr);
                }
            }
            Inst::Poly(p) => {
                for x in out.iter_mut() {
                    *x = p.next(sr);
                }
            }
            Inst::Sampler(s) => {
                for x in out.iter_mut() {
                    *x = s.next(ctx.bank);
                }
            }
            Inst::Fm(f) => {
                for x in out.iter_mut() {
                    *x = f.next(sr);
                }
            }
            Inst::Super(s) => {
                for x in out.iter_mut() {
                    *x = s.next(sr);
                }
            }
            Inst::Pluck(p) => {
                for x in out.iter_mut() {
                    *x = p.next(scratch);
                }
            }
        }
    }
}
