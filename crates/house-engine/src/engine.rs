//! The engine: tracks, step sequencer, song sections, mixer and master chain.
//!
//! Real-time rules: `process` and `apply` never allocate, lock or block.
//! The only allocating calls are `Engine::new` and `load_sample`, which hosts
//! run outside the audio callback (or hand over already-allocated buffers).

use crate::analysis::{Analyzer, BANDS};
use crate::command::{master, mix, Command};
use crate::drums::{DrumModel, DrumVoice};
use crate::dsp::*;
use crate::fx::{Glue, Limiter, PingPong, Reverb};
use crate::sampler::{SampleBuf, Sampler};
use crate::synths::{Acid, Bass808, Poly};
use crate::trackfx::TrackFx;

pub const MAX_TRACKS: usize = 16;
pub const MAX_STEPS: usize = 64;
pub const MAX_SECTIONS: usize = 32;
pub const MAX_BLOCK: usize = 256;
pub const SAMPLE_SLOTS: usize = 32;
pub const NUM_PARAMS: usize = 8;
pub const STATUS_LEN: usize = 64;
/// Soundboard voices (one-shots on the master bus).
pub const SHOT_VOICES: usize = 6;

/// Instrument kinds used by `SetTrackKind`.
pub mod kind {
    pub const NONE: u8 = 0;
    pub const DRUM: u8 = 1;
    pub const ACID: u8 = 2;
    pub const BASS808: u8 = 3;
    pub const POLY: u8 = 4;
    pub const SAMPLER: u8 = 5;
}

/// Section kinds, shared with the interface and the visuals.
pub mod section {
    pub const NONE: u8 = 0;
    pub const INTRO: u8 = 1;
    pub const BUILD: u8 = 2;
    pub const DROP: u8 = 3;
    pub const BREAK: u8 = 4;
    pub const OUTRO: u8 = 5;
    pub const VERSE: u8 = 6;
    pub const CHORUS: u8 = 7;
    pub const BRIDGE: u8 = 8;
    pub const PRECHORUS: u8 = 9;
}

/// Positions inside the status array that hosts read after each block.
pub mod st {
    pub const PLAYING: usize = 0;
    pub const STEP: usize = 1;
    pub const BAR: usize = 2;
    pub const STEP_IN_BAR: usize = 3;
    pub const SECTION: usize = 4;
    pub const SECTION_PROGRESS: usize = 5;
    pub const BEAT_PHASE: usize = 6;
    pub const TRIGGERS: usize = 7;
    pub const PEAK_L: usize = 8;
    pub const PEAK_R: usize = 9;
    pub const RMS: usize = 10;
    pub const KICK: usize = 11;
    pub const SNARE: usize = 12;
    pub const HAT: usize = 13;
    pub const LIMITER_GR: usize = 14;
    pub const BARS_TO_NEXT: usize = 15;
    pub const TRACK_PEAKS: usize = 16;
    pub const BANDS: usize = 32;
    pub const NEXT_KIND: usize = 48;
    pub const CUR_KIND: usize = 49;
    pub const STEP_FRACTION: usize = 50;
    pub const BPM: usize = 51;
    pub const SONG_BARS: usize = 52;
    pub const MODE: usize = 53;
    pub const BAR_IN_SECTION: usize = 54;
}

/// Folds a newer status snapshot into `acc`, for hosts that read snapshots
/// less often than the engine writes them: the newest position and levels,
/// the highest peaks and every trigger since `acc` was last read.
pub fn merge_status(acc: &mut [f32; STATUS_LEN], next: &[f32; STATUS_LEN]) {
    for (i, (a, n)) in acc.iter_mut().zip(next).enumerate() {
        *a = match i {
            st::TRIGGERS => ((*a as u32) | (*n as u32)) as f32,
            st::PEAK_L..=st::HAT => a.max(*n),
            _ if (st::TRACK_PEAKS..st::TRACK_PEAKS + MAX_TRACKS).contains(&i) => a.max(*n),
            _ => *n,
        };
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Step {
    pub on: bool,
    pub vel: f32,
    pub len: u8,
    pub accent: bool,
    pub slide: bool,
    pub notes: [i8; 4],
}

impl Default for Step {
    fn default() -> Self {
        Step {
            on: false,
            vel: 0.8,
            len: 1,
            accent: false,
            slide: false,
            notes: [-1; 4],
        }
    }
}

#[derive(Clone, Copy)]
pub enum Inst {
    None,
    Drum(DrumVoice),
    Acid(Acid),
    Bass(Bass808),
    Poly(Poly),
    Sampler(Sampler),
}

#[derive(Clone, Copy)]
struct PendingOff {
    note: i16,
    samples: i64,
}

const NO_OFF: PendingOff = PendingOff {
    note: -1,
    samples: 0,
};

pub struct Track {
    pub inst: Inst,
    pub kind: u8,
    pub model: u8,
    pub params: [f32; NUM_PARAMS],
    pub steps: [Step; MAX_STEPS],
    pub length: usize,
    pub vol_db: f32,
    pub pan: f32,
    pub mute: bool,
    pub solo: bool,
    pub send_rev: f32,
    pub send_del: f32,
    pub duck: f32,
    pub active: bool,
    pub once: bool,
    pub fx: TrackFx,
    gain: Smooth,
    pl: f32,
    pr: f32,
    offs: [PendingOff; 8],
    audible: bool,
}

impl Track {
    fn new(sr: f32) -> Self {
        Track {
            inst: Inst::None,
            kind: kind::NONE,
            model: 0,
            params: [0.5; NUM_PARAMS],
            steps: [Step::default(); MAX_STEPS],
            length: 16,
            vol_db: 0.0,
            pan: 0.0,
            mute: false,
            solo: false,
            send_rev: 0.0,
            send_del: 0.0,
            duck: 0.0,
            active: false,
            once: false,
            fx: TrackFx::new(sr),
            gain: Smooth::new(1.0, 0.015, sr),
            pl: core::f32::consts::FRAC_1_SQRT_2,
            pr: core::f32::consts::FRAC_1_SQRT_2,
            offs: [NO_OFF; 8],
            audible: true,
        }
    }

    fn schedule_off(&mut self, note: u8, samples: i64) {
        for o in self.offs.iter_mut() {
            if o.note < 0 {
                *o = PendingOff {
                    note: note as i16,
                    samples,
                };
                return;
            }
        }
        // All slots busy: replace the one that ends first.
        let mut idx = 0;
        for (i, o) in self.offs.iter().enumerate() {
            if o.samples < self.offs[idx].samples {
                idx = i;
            }
        }
        self.offs[idx] = PendingOff {
            note: note as i16,
            samples,
        };
    }
}

fn make_inst(k: u8, model: u8, sr: f32, seed: u32) -> Inst {
    match k {
        kind::DRUM => Inst::Drum(DrumVoice::new(DrumModel::from_u8(model), seed)),
        kind::ACID => Inst::Acid(Acid::new(sr)),
        kind::BASS808 => Inst::Bass(Bass808::new(sr)),
        kind::POLY => Inst::Poly(Poly::new(sr)),
        kind::SAMPLER => Inst::Sampler(Sampler::new(sr)),
        _ => Inst::None,
    }
}

fn apply_params(inst: &mut Inst, params: &[f32; NUM_PARAMS], sr: f32) {
    match inst {
        Inst::Acid(a) => a.set_params(params),
        Inst::Bass(b) => b.set_params(params, sr),
        Inst::Poly(p) => p.set_params(params, sr),
        Inst::Sampler(s) => s.set_params(params, sr),
        _ => {}
    }
}

fn note_off(inst: &mut Inst, note: u8) {
    match inst {
        Inst::Acid(a) => a.note_off(note),
        Inst::Bass(b) => b.note_off(note),
        Inst::Poly(p) => p.note_off(note),
        Inst::Sampler(s) => s.note_off(note),
        _ => {}
    }
}

/// A soundboard one-shot: its own instrument, freed after `life` samples.
#[derive(Clone, Copy)]
struct Shot {
    inst: Inst,
    params: [f32; NUM_PARAMS],
    note: u8,
    /// Samples until the note is released (synths); negative when done.
    off: i64,
    /// Samples until the voice is free again.
    life: i64,
    active: bool,
}

const SHOT_IDLE: Shot = Shot {
    inst: Inst::None,
    params: [0.5; NUM_PARAMS],
    note: 60,
    off: -1,
    life: 0,
    active: false,
};

#[derive(Clone, Copy, Default)]
struct Section {
    bars: u32,
    mask: u32,
    kind: u8,
}

pub struct Engine {
    pub sr: f32,
    pub tracks: [Track; MAX_TRACKS],
    preview: Track,
    shots: [Shot; SHOT_VOICES],
    next_shot: usize,
    click: DrumVoice,
    playing: bool,
    bpm: f32,
    swing: f32,
    global_step: u64,
    last_step: u64,
    samples_to_next: f64,
    cur_dur: f64,
    mode: u8,
    sections: [Section; MAX_SECTIONS],
    section_count: usize,
    sidechain: Option<usize>,
    duck_env: f32,
    duck_attacking: bool,
    duck_att: f32,
    duck_rel: f32,
    reverb: Reverb,
    delay: PingPong,
    delay_steps: f32,
    glue: Glue,
    limiter: Limiter,
    build_hp: [Svf; 2],
    build_active: bool,
    master_gain: Smooth,
    metronome: bool,
    cue_to_master: bool,
    auto_build: bool,
    reverb_size: f32,
    reverb_damp: f32,
    analyzer: Analyzer,
    bank: [Option<SampleBuf>; SAMPLE_SLOTS],
    // Scratch buffers (fixed size, never reallocated).
    buf: [f32; MAX_BLOCK],
    duck_buf: [f32; MAX_BLOCK],
    mix_l: [f32; MAX_BLOCK],
    mix_r: [f32; MAX_BLOCK],
    rev_in: [f32; MAX_BLOCK],
    del_in: [f32; MAX_BLOCK],
    cue_l: [f32; MAX_BLOCK],
    cue_r: [f32; MAX_BLOCK],
    pub out_l: [f32; MAX_BLOCK],
    pub out_r: [f32; MAX_BLOCK],
    pub out_cue_l: [f32; MAX_BLOCK],
    pub out_cue_r: [f32; MAX_BLOCK],
    // Status and accumulators (reset by `ack_status`).
    pub status: [f32; STATUS_LEN],
    trig_acc: u32,
    track_peak_acc: [f32; MAX_TRACKS],
    peak_acc: [f32; 2],
    rms_sum: f64,
    rms_n: u32,
    hits: [f32; 3],
}

impl Engine {
    pub fn new(sr: f32) -> Self {
        let sr = if sr.is_finite() && sr > 8000.0 {
            sr
        } else {
            48_000.0
        };
        let mut e = Engine {
            sr,
            tracks: core::array::from_fn(|_| Track::new(sr)),
            preview: Track::new(sr),
            shots: [SHOT_IDLE; SHOT_VOICES],
            next_shot: 0,
            click: DrumVoice::new(DrumModel::Click, 99),
            playing: false,
            bpm: 124.0,
            swing: 0.5,
            global_step: 0,
            last_step: 0,
            samples_to_next: 0.0,
            cur_dur: 1.0,
            mode: 0,
            sections: [Section::default(); MAX_SECTIONS],
            section_count: 0,
            sidechain: None,
            duck_env: 0.0,
            duck_attacking: false,
            duck_att: 1.0 - tau_coef(0.0025, sr),
            duck_rel: tau_coef(0.12, sr),
            reverb: Reverb::new(sr),
            delay: PingPong::new(sr),
            delay_steps: 3.0,
            glue: Glue::new(sr),
            limiter: Limiter::new(sr),
            build_hp: [Svf::default(); 2],
            build_active: false,
            master_gain: Smooth::new(db_to_gain(-1.0), 0.03, sr),
            metronome: false,
            cue_to_master: true,
            auto_build: true,
            reverb_size: 0.55,
            reverb_damp: 0.5,
            analyzer: Analyzer::new(sr),
            bank: core::array::from_fn(|_| None),
            buf: [0.0; MAX_BLOCK],
            duck_buf: [0.0; MAX_BLOCK],
            mix_l: [0.0; MAX_BLOCK],
            mix_r: [0.0; MAX_BLOCK],
            rev_in: [0.0; MAX_BLOCK],
            del_in: [0.0; MAX_BLOCK],
            cue_l: [0.0; MAX_BLOCK],
            cue_r: [0.0; MAX_BLOCK],
            out_l: [0.0; MAX_BLOCK],
            out_r: [0.0; MAX_BLOCK],
            out_cue_l: [0.0; MAX_BLOCK],
            out_cue_r: [0.0; MAX_BLOCK],
            status: [0.0; STATUS_LEN],
            trig_acc: 0,
            track_peak_acc: [0.0; MAX_TRACKS],
            peak_acc: [0.0; 2],
            rms_sum: 0.0,
            rms_n: 0,
            hits: [0.0; 3],
        };
        e.set_bpm(124.0);
        e
    }

    pub fn sample_rate(&self) -> f32 {
        self.sr
    }

    pub fn is_playing(&self) -> bool {
        self.playing
    }

    /// Loads audio into a bank slot and returns the previous buffer so the host
    /// can free it outside the audio thread.
    pub fn load_sample(&mut self, slot: usize, data: Box<[f32]>, sr: f32) -> Option<Box<[f32]>> {
        if slot >= SAMPLE_SLOTS {
            return Some(data);
        }
        let old = self.bank[slot].take();
        self.bank[slot] = Some(SampleBuf {
            data,
            sr: if sr > 1000.0 { sr } else { self.sr },
        });
        old.map(|b| b.data)
    }

    fn set_bpm(&mut self, bpm: f32) {
        self.bpm = bpm.clamp(40.0, 240.0);
        let beat = 60.0 / self.bpm;
        self.duck_rel = tau_coef(0.23 * beat, self.sr);
        let step = beat / 4.0 * self.sr;
        self.delay.set_time(step * self.delay_steps);
    }

    fn base_step(&self) -> f64 {
        self.sr as f64 * 60.0 / self.bpm as f64 / 4.0
    }

    fn step_duration(&self, index: u64) -> f64 {
        let base = self.base_step();
        let s = self.swing as f64;
        if index.is_multiple_of(2) {
            2.0 * s * base
        } else {
            2.0 * (1.0 - s) * base
        }
    }

    fn song_bars(&self) -> u32 {
        self.sections[..self.section_count]
            .iter()
            .map(|s| s.bars)
            .sum()
    }

    /// Section index, its first bar and length for a bar of the song.
    fn section_at(&self, bar: u64) -> Option<(usize, u64, u32)> {
        let total = self.song_bars() as u64;
        if self.mode != 1 || total == 0 {
            return None;
        }
        let b = bar % total;
        let mut start = 0u64;
        for i in 0..self.section_count {
            let len = self.sections[i].bars as u64;
            if b < start + len {
                return Some((i, start, self.sections[i].bars));
            }
            start += len;
        }
        None
    }

    fn all_notes_off(&mut self) {
        let sr = self.sr;
        for t in self.tracks.iter_mut() {
            note_off(&mut t.inst, 255);
            if let Inst::Drum(v) = &mut t.inst {
                v.choke(sr);
            }
            t.offs = [NO_OFF; 8];
        }
        note_off(&mut self.preview.inst, 255);
    }

    pub fn apply(&mut self, cmd: Command) {
        let sr = self.sr;
        match cmd {
            Command::Play => {
                if !self.playing {
                    self.playing = true;
                    self.samples_to_next = 0.0;
                }
            }
            Command::Stop => {
                self.playing = false;
                self.global_step = 0;
                self.last_step = 0;
                self.samples_to_next = 0.0;
                self.all_notes_off();
            }
            Command::SetBpm(b) => {
                if b > 0.0 {
                    self.set_bpm(b)
                }
            }
            Command::SetSwing(s) => self.swing = s.clamp(0.5, 0.75),
            Command::SetStep {
                track,
                step,
                on,
                vel,
                len,
                accent,
                slide,
                notes,
            } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    if let Some(s) = t.steps.get_mut(step as usize) {
                        *s = Step {
                            on,
                            vel: vel.clamp(0.0, 1.0),
                            len: len.max(1),
                            accent,
                            slide,
                            notes,
                        };
                    }
                }
            }
            Command::ClearSteps { track } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    t.steps = [Step::default(); MAX_STEPS];
                }
            }
            Command::SetTrackKind { track, kind, model } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    t.kind = kind;
                    t.model = model;
                    t.inst = make_inst(kind, model, sr, track as u32 + 1);
                    apply_params(&mut t.inst, &t.params, sr);
                    t.offs = [NO_OFF; 8];
                    t.active = kind != kind::NONE;
                }
            }
            Command::SetParam { track, idx, value } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    if (idx as usize) < NUM_PARAMS {
                        t.params[idx as usize] = value.clamp(0.0, 1.0);
                        apply_params(&mut t.inst, &t.params, sr);
                    }
                }
            }
            Command::SetMix {
                track,
                param,
                value,
            } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    match param {
                        mix::VOLUME_DB => t.vol_db = value.clamp(-90.0, 12.0),
                        mix::PAN => {
                            t.pan = value.clamp(-1.0, 1.0);
                            let (l, r) = pan_gains(t.pan);
                            t.pl = l;
                            t.pr = r;
                        }
                        mix::MUTE => t.mute = value > 0.5,
                        mix::SOLO => t.solo = value > 0.5,
                        mix::SEND_REVERB => t.send_rev = value.clamp(0.0, 1.0),
                        mix::SEND_DELAY => t.send_del = value.clamp(0.0, 1.0),
                        mix::DUCK => t.duck = value.clamp(0.0, 1.0),
                        mix::ACTIVE => t.active = value > 0.5 && t.kind != kind::NONE,
                        mix::ONCE_PER_SECTION => t.once = value > 0.5,
                        mix::FILTER => t.fx.set_filter(value, sr),
                        mix::EQ_LOW => t.fx.set_eq(0, value),
                        mix::EQ_MID => t.fx.set_eq(1, value),
                        mix::EQ_HIGH => t.fx.set_eq(2, value),
                        mix::DRIVE => t.fx.set_drive(value),
                        _ => {}
                    }
                }
            }
            Command::NoteOn { track, note, vel } => {
                let ti = track as usize;
                if ti < MAX_TRACKS {
                    self.trigger(ti, note, vel.clamp(0.0, 1.0), false, false, None);
                    self.mark_hit(ti, vel);
                }
            }
            Command::NoteOff { track, note } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    note_off(&mut t.inst, note);
                }
            }
            Command::SetLength { track, steps } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    t.length = (steps as usize).clamp(1, MAX_STEPS);
                }
            }
            Command::SetMode(m) => {
                self.mode = if m == 1 { 1 } else { 0 };
                if self.mode == 0 {
                    self.build_active = false;
                }
            }
            Command::SetSectionCount(c) => self.section_count = (c as usize).min(MAX_SECTIONS),
            Command::SetSection {
                index,
                bars,
                mask,
                kind,
            } => {
                if let Some(s) = self.sections.get_mut(index as usize) {
                    *s = Section {
                        bars: (bars as u32).max(1),
                        mask,
                        kind,
                    };
                }
            }
            Command::SetMaster { param, value } => match param {
                master::VOLUME_DB => self.master_gain.set(db_to_gain(value.clamp(-90.0, 6.0))),
                master::GLUE => self.glue.set_amount(value),
                master::CEILING_DB => self.limiter.ceiling = db_to_gain(value.clamp(-12.0, 0.0)),
                master::REVERB_SIZE => {
                    self.reverb_size = value.clamp(0.0, 1.0);
                    self.reverb.set(self.reverb_size, self.reverb_damp, sr);
                }
                master::REVERB_DAMP => {
                    self.reverb_damp = value.clamp(0.0, 1.0);
                    self.reverb.set(self.reverb_size, self.reverb_damp, sr);
                }
                master::DELAY_STEPS => {
                    self.delay_steps = value.clamp(0.5, 16.0);
                    let b = self.bpm;
                    self.set_bpm(b);
                }
                master::DELAY_FEEDBACK => self.delay.feedback = value.clamp(0.0, 0.92),
                master::METRONOME => self.metronome = value > 0.5,
                master::AUTO_BUILD => self.auto_build = value > 0.5,
                master::METRONOME_TO_MASTER => self.cue_to_master = value > 0.5,
                _ => {}
            },
            Command::SetSidechainSource(t) => {
                self.sidechain = if (t as usize) < MAX_TRACKS {
                    Some(t as usize)
                } else {
                    None
                }
            }
            Command::Seek { bar } => {
                let total = self.song_bars();
                let b = if self.mode == 1 && total > 0 {
                    bar % total
                } else {
                    bar
                };
                self.global_step = b as u64 * 16;
                self.samples_to_next = 0.0;
                self.all_notes_off();
            }
            Command::AllNotesOff => self.all_notes_off(),
            Command::Preview {
                kind,
                model,
                note,
                vel,
                params,
            } => {
                let p = &mut self.preview;
                if p.kind != kind || p.model != model {
                    p.kind = kind;
                    p.model = model;
                    p.inst = make_inst(kind, model, sr, 777);
                }
                p.params = params;
                apply_params(&mut p.inst, &p.params, sr);
                p.active = true;
                let bpm = self.bpm;
                let bank = &self.bank;
                match &mut p.inst {
                    Inst::Drum(v) => v.trigger(vel, &p.params, sr, bpm),
                    Inst::Acid(a) => a.note_on(note, vel, false, false, sr),
                    Inst::Bass(b) => b.note_on(note, vel, false, sr),
                    Inst::Poly(pl) => pl.note_on(note, vel),
                    Inst::Sampler(s) => s.note_on(note, vel, bank, sr),
                    Inst::None => {}
                }
                p.offs = [NO_OFF; 8];
                p.schedule_off(note, (0.45 * sr) as i64);
            }
            Command::Shot {
                kind,
                model,
                note,
                vel,
                slot,
                params,
            } => {
                let i = self.next_shot;
                self.next_shot = (i + 1) % SHOT_VOICES;
                let bpm = self.bpm;
                let bank = &self.bank;
                let s = &mut self.shots[i];
                s.inst = make_inst(kind, model, sr, 900 + i as u32);
                s.params = params;
                apply_params(&mut s.inst, &s.params, sr);
                s.note = note;
                s.life = (6.0 * sr) as i64;
                s.off = (0.6 * sr) as i64;
                s.active = kind != kind::NONE;
                let vel = vel.clamp(0.0, 1.0);
                match &mut s.inst {
                    Inst::Drum(v) => v.trigger(vel, &s.params, sr, bpm),
                    Inst::Acid(a) => a.note_on(note, vel, false, false, sr),
                    Inst::Bass(b) => b.note_on(note, vel, false, sr),
                    Inst::Poly(p) => p.note_on(note, vel),
                    Inst::Sampler(sm) => {
                        sm.slot = (slot as usize).min(SAMPLE_SLOTS - 1);
                        sm.note_on(note, vel, bank, sr);
                        // A recorded sound plays to its end.
                        s.off = s.life;
                    }
                    Inst::None => {}
                }
                if let Inst::Drum(v) = &s.inst {
                    let c = v.model.hit_class();
                    if c > 0 {
                        let h = &mut self.hits[(c - 1) as usize];
                        *h = h.max(vel);
                    }
                }
            }
            Command::SetSampleSlot { track, slot } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    if let Inst::Sampler(s) = &mut t.inst {
                        s.slot = (slot as usize).min(SAMPLE_SLOTS - 1);
                    }
                }
            }
        }
    }

    fn mark_hit(&mut self, ti: usize, vel: f32) {
        self.trig_acc |= 1 << ti;
        if let Inst::Drum(v) = &self.tracks[ti].inst {
            let c = v.model.hit_class();
            if c > 0 {
                let h = &mut self.hits[(c - 1) as usize];
                *h = h.max(vel);
            }
        }
    }

    /// Starts a sound on a track. `step` carries the pattern step when the
    /// sequencer is the one triggering (used for note lengths and slides).
    fn trigger(
        &mut self,
        ti: usize,
        note: u8,
        vel: f32,
        accent: bool,
        slide: bool,
        step: Option<(Step, u64)>,
    ) {
        let sr = self.sr;
        let bpm = self.bpm;
        let base = self.base_step();
        let is_sidechain = self.sidechain == Some(ti);
        let bank = &self.bank;
        let t = &mut self.tracks[ti];
        if !t.active {
            return;
        }
        let mut chokes_open_hat = false;
        match &mut t.inst {
            Inst::None => return,
            Inst::Drum(v) => {
                v.trigger(vel, &t.params, sr, bpm);
                chokes_open_hat = v.model == DrumModel::HatClosed;
            }
            Inst::Acid(a) => a.note_on(note, vel, slide, accent, sr),
            Inst::Bass(b) => b.note_on(note, vel, slide, sr),
            Inst::Poly(p) => {
                if let Some((s, _)) = step {
                    for n in s.notes.iter().filter(|n| **n >= 0) {
                        p.note_on(*n as u8, vel);
                    }
                } else {
                    p.note_on(note, vel);
                }
            }
            Inst::Sampler(s) => s.note_on(note, vel, bank, sr),
        }
        // Note lengths from the pattern (live notes wait for the key release).
        if let Some((s, index)) = step {
            let gate = match t.kind {
                kind::ACID => 0.55,
                kind::BASS808 => 0.95,
                kind::POLY => 0.9,
                _ => 0.0,
            };
            if gate > 0.0 {
                let next = t.steps[((index + s.len as u64) % t.length as u64) as usize];
                let tie = next.on && next.slide && matches!(t.kind, kind::ACID | kind::BASS808);
                if !tie {
                    let samples = (s.len as f64 * base * gate) as i64;
                    if t.kind == kind::POLY {
                        for n in s.notes.iter().filter(|n| **n >= 0) {
                            t.schedule_off(*n as u8, samples);
                        }
                    } else {
                        t.schedule_off(note, samples);
                    }
                }
            }
        }
        if chokes_open_hat {
            for other in self.tracks.iter_mut() {
                if let Inst::Drum(v) = &mut other.inst {
                    if v.model == DrumModel::HatOpen {
                        v.choke(sr);
                    }
                }
            }
        }
        if is_sidechain {
            self.duck_attacking = true;
        }
    }

    fn fire_step(&mut self) {
        let index = self.global_step;
        let bar = index / 16;
        let step_in_bar = index % 16;
        let sec = self.section_at(bar);
        let mask = match sec {
            Some((si, _, _)) => self.sections[si].mask,
            None => u32::MAX,
        };
        // Risers and impacts only fire in the first bar of a section.
        let first_bar_of_section = match sec {
            Some((_, start, _)) => {
                let total = self.song_bars().max(1) as u64;
                bar % total == start
            }
            None => false,
        };
        for ti in 0..MAX_TRACKS {
            let (s, local) = {
                let t = &self.tracks[ti];
                if !t.active || mask & (1 << ti) == 0 || (t.once && !first_bar_of_section) {
                    continue;
                }
                let local = index % t.length as u64;
                (t.steps[local as usize], local)
            };
            if !s.on {
                continue;
            }
            let note = if s.notes[0] >= 0 {
                s.notes[0] as u8
            } else {
                60
            };
            self.trigger(ti, note, s.vel, s.accent, s.slide, Some((s, local)));
            if self.tracks[ti].audible {
                self.mark_hit(ti, s.vel);
            }
        }
        if self.metronome && step_in_bar.is_multiple_of(4) {
            let p = [if step_in_bar == 0 { 1.0 } else { 0.0 }, 0.5, 0.5, 0.0];
            self.click.trigger(0.9, &p, self.sr, self.bpm);
        }
        self.last_step = index;
        self.cur_dur = self.step_duration(index);
        self.samples_to_next += self.cur_dur;
        self.global_step += 1;
        if self.mode == 1 {
            let total = self.song_bars() as u64 * 16;
            if total > 0 && self.global_step >= total {
                self.global_step = 0;
            }
        }
    }

    fn update_audibility(&mut self) {
        let any_solo = self.tracks.iter().any(|t| t.active && t.solo);
        for t in self.tracks.iter_mut() {
            t.audible = t.active && !t.mute && (!any_solo || t.solo);
            let g = if t.audible { db_to_gain(t.vol_db) } else { 0.0 };
            t.gain.set(g);
        }
    }

    fn update_build_filter(&mut self) {
        self.build_active = false;
        if self.mode != 1 || !self.auto_build || !self.playing {
            return;
        }
        let bar = self.last_step / 16;
        if let Some((si, start, len)) = self.section_at(bar) {
            if self.sections[si].kind == section::BUILD {
                let total = self.song_bars() as u64;
                let b = if total > 0 { bar % total } else { bar };
                let prog = ((b - start) as f32 + (self.last_step % 16) as f32 / 16.0) / len as f32;
                let cut = 20.0 * 2f32.powf(prog.clamp(0.0, 1.0) * 4.6);
                for f in self.build_hp.iter_mut() {
                    f.set_q(cut, 0.8, self.sr);
                }
                self.build_active = true;
            }
        }
    }

    /// Renders `frames` (≤ MAX_BLOCK) into `out_l/out_r` and `out_cue_l/r`.
    pub fn process(&mut self, frames: usize) {
        let frames = frames.min(MAX_BLOCK);
        for b in [
            &mut self.mix_l,
            &mut self.mix_r,
            &mut self.rev_in,
            &mut self.del_in,
            &mut self.cue_l,
            &mut self.cue_r,
        ] {
            b[..frames].fill(0.0);
        }
        self.update_audibility();
        let mut offset = 0;
        while offset < frames {
            let mut chunk = frames - offset;
            if self.playing {
                while self.samples_to_next <= 0.0 {
                    self.fire_step();
                }
                let until = self.samples_to_next.ceil() as usize;
                chunk = chunk.min(until.max(1));
            }
            self.render_chunk(offset, chunk);
            if self.playing {
                self.samples_to_next -= chunk as f64;
            }
            offset += chunk;
        }
        self.update_build_filter();
        self.master(frames);
        self.write_status(frames);
    }

    fn render_chunk(&mut self, offset: usize, n: usize) {
        let sr = self.sr;
        // Shared sidechain envelope for this chunk.
        for i in 0..n {
            if self.duck_attacking {
                self.duck_env += (1.0 - self.duck_env) * self.duck_att;
                if self.duck_env > 0.97 {
                    self.duck_attacking = false;
                }
            } else {
                self.duck_env *= self.duck_rel;
            }
            self.duck_buf[i] = self.duck_env;
        }
        for ti in 0..MAX_TRACKS {
            if !self.tracks[ti].active {
                continue;
            }
            // Note-offs due in this chunk.
            {
                let t = &mut self.tracks[ti];
                for k in 0..t.offs.len() {
                    if t.offs[k].note >= 0 {
                        if t.offs[k].samples <= 0 {
                            let note = t.offs[k].note as u8;
                            t.offs[k] = NO_OFF;
                            note_off(&mut t.inst, note);
                        } else {
                            t.offs[k].samples -= n as i64;
                        }
                    }
                }
            }
            let bank = &self.bank;
            let t = &mut self.tracks[ti];
            let buf = &mut self.buf[..n];
            match &mut t.inst {
                Inst::None => buf.fill(0.0),
                Inst::Drum(v) => {
                    for x in buf.iter_mut() {
                        *x = v.next(sr);
                    }
                }
                Inst::Acid(a) => {
                    for x in buf.iter_mut() {
                        *x = a.next(sr);
                    }
                }
                Inst::Bass(b) => {
                    for x in buf.iter_mut() {
                        *x = b.next(sr);
                    }
                }
                Inst::Poly(p) => {
                    for x in buf.iter_mut() {
                        *x = p.next(sr);
                    }
                }
                Inst::Sampler(s) => {
                    for x in buf.iter_mut() {
                        *x = s.next(bank);
                    }
                }
            }
            if !t.fx.is_neutral() {
                for x in buf.iter_mut() {
                    *x = t.fx.process(*x);
                }
            }
            let mut peak = 0.0f32;
            for i in 0..n {
                let g = t.gain.next();
                let d = if t.duck > 0.0 {
                    1.0 - t.duck * self.duck_buf[i]
                } else {
                    1.0
                };
                let x = self.buf[i] * g * d;
                peak = peak.max(x.abs());
                let j = offset + i;
                self.mix_l[j] += x * t.pl;
                self.mix_r[j] += x * t.pr;
                self.rev_in[j] += x * t.send_rev;
                self.del_in[j] += x * t.send_del;
            }
            let acc = &mut self.track_peak_acc[ti];
            *acc = acc.max(peak);
        }
        // Soundboard one-shots go to the master bus, with a touch of reverb.
        {
            let bank = &self.bank;
            for s in self.shots.iter_mut() {
                if !s.active {
                    continue;
                }
                for i in 0..n {
                    let x = match &mut s.inst {
                        Inst::Drum(v) => v.next(sr),
                        Inst::Acid(a) => a.next(sr),
                        Inst::Bass(b) => b.next(sr),
                        Inst::Poly(pl) => pl.next(sr),
                        Inst::Sampler(sm) => sm.next(bank),
                        Inst::None => 0.0,
                    } * 0.8;
                    self.mix_l[offset + i] += x;
                    self.mix_r[offset + i] += x;
                    self.rev_in[offset + i] += x * 0.12;
                }
                if s.off > 0 {
                    s.off -= n as i64;
                    if s.off <= 0 {
                        let note = s.note;
                        note_off(&mut s.inst, note);
                    }
                }
                s.life -= n as i64;
                if s.life <= 0 {
                    *s = SHOT_IDLE;
                }
            }
        }
        // Preview (sounds auditioned from the browser) and metronome go to the cue bus.
        {
            let bank = &self.bank;
            let p = &mut self.preview;
            if p.active {
                for k in 0..p.offs.len() {
                    if p.offs[k].note >= 0 {
                        if p.offs[k].samples <= 0 {
                            let note = p.offs[k].note as u8;
                            p.offs[k] = NO_OFF;
                            note_off(&mut p.inst, note);
                        } else {
                            p.offs[k].samples -= n as i64;
                        }
                    }
                }
                for i in 0..n {
                    let x = match &mut p.inst {
                        Inst::Drum(v) => v.next(sr),
                        Inst::Acid(a) => a.next(sr),
                        Inst::Bass(b) => b.next(sr),
                        Inst::Poly(pl) => pl.next(sr),
                        Inst::Sampler(s) => s.next(bank),
                        Inst::None => 0.0,
                    } * 0.8;
                    self.cue_l[offset + i] += x;
                    self.cue_r[offset + i] += x;
                }
            }
        }
        for i in 0..n {
            let c = self.click.next(sr);
            self.cue_l[offset + i] += c;
            self.cue_r[offset + i] += c;
        }
    }

    fn master(&mut self, frames: usize) {
        let mut pk = [0.0f32; 2];
        let mut rms = 0.0f64;
        for i in 0..frames {
            let (rl, rr) = self.reverb.process(self.rev_in[i]);
            let (dl, dr) = self.delay.process(self.del_in[i]);
            let mut l = self.mix_l[i] + rl + dl;
            let mut r = self.mix_r[i] + rr + dr;
            if self.build_active {
                l = self.build_hp[0].hp(l);
                r = self.build_hp[1].hp(r);
            }
            if self.cue_to_master {
                l += self.cue_l[i];
                r += self.cue_r[i];
            }
            let (gl, gr) = self.glue.process(l, r);
            let g = self.master_gain.next();
            let (ol, or) = self.limiter.process(gl * g, gr * g);
            self.analyzer.feed((ol + or) * 0.5);
            pk[0] = pk[0].max(ol.abs());
            pk[1] = pk[1].max(or.abs());
            rms += (ol as f64 * ol as f64 + or as f64 * or as f64) * 0.5;
            self.out_l[i] = ol;
            self.out_r[i] = or;
            self.out_cue_l[i] = self.cue_l[i];
            self.out_cue_r[i] = self.cue_r[i];
        }
        self.peak_acc[0] = self.peak_acc[0].max(pk[0]);
        self.peak_acc[1] = self.peak_acc[1].max(pk[1]);
        self.rms_sum += rms;
        self.rms_n += frames as u32;
    }

    fn write_status(&mut self, frames: usize) {
        let step = self.last_step;
        let song_bars = self.song_bars();
        let sec = self.section_at(step / 16);
        let decay = (-(frames as f32) / (self.sr * 0.12)).exp();
        for h in self.hits.iter_mut() {
            *h *= decay;
        }
        let mut bands = [0.0f32; BANDS];
        self.analyzer.bands(&mut bands);
        let s = &mut self.status;
        s[st::PLAYING] = if self.playing { 1.0 } else { 0.0 };
        s[st::STEP] = step as f32;
        s[st::BAR] = (step / 16) as f32;
        s[st::STEP_IN_BAR] = (step % 16) as f32;
        let frac = if self.playing && self.cur_dur > 0.0 {
            (1.0 - self.samples_to_next / self.cur_dur).clamp(0.0, 1.0) as f32
        } else {
            0.0
        };
        s[st::STEP_FRACTION] = frac;
        s[st::BEAT_PHASE] = (((step % 4) as f32) + frac) / 4.0;
        s[st::TRIGGERS] = (self.trig_acc & 0xFFFF) as f32;
        s[st::PEAK_L] = self.peak_acc[0];
        s[st::PEAK_R] = self.peak_acc[1];
        s[st::RMS] = if self.rms_n > 0 {
            (self.rms_sum / self.rms_n as f64).sqrt() as f32
        } else {
            0.0
        };
        s[st::KICK] = self.hits[0];
        s[st::SNARE] = self.hits[1];
        s[st::HAT] = self.hits[2];
        s[st::LIMITER_GR] = self.limiter.gr_db;
        s[st::BPM] = self.bpm;
        s[st::SONG_BARS] = song_bars as f32;
        s[st::MODE] = self.mode as f32;
        s[st::TRACK_PEAKS..st::TRACK_PEAKS + MAX_TRACKS].copy_from_slice(&self.track_peak_acc);
        s[st::BANDS..st::BANDS + BANDS].copy_from_slice(&bands);
        match sec {
            Some((si, start, len)) => {
                let total = song_bars as u64;
                let bar = (step / 16) % total.max(1);
                let in_sec = (bar - start) as f32 + ((step % 16) as f32 + frac) / 16.0;
                s[st::SECTION] = si as f32;
                s[st::SECTION_PROGRESS] = (in_sec / len as f32).clamp(0.0, 1.0);
                s[st::BAR_IN_SECTION] = (bar - start) as f32;
                s[st::BARS_TO_NEXT] = len as f32 - in_sec;
                s[st::CUR_KIND] = self.sections[si].kind as f32;
                let ni = if si + 1 < self.section_count {
                    si + 1
                } else {
                    0
                };
                s[st::NEXT_KIND] = self.sections[ni].kind as f32;
            }
            None => {
                s[st::SECTION] = -1.0;
                s[st::SECTION_PROGRESS] = 0.0;
                s[st::BAR_IN_SECTION] = 0.0;
                s[st::BARS_TO_NEXT] = 0.0;
                s[st::CUR_KIND] = 0.0;
                s[st::NEXT_KIND] = 0.0;
            }
        }
    }

    /// Hosts call this after reading `status` so peaks and triggers restart.
    pub fn ack_status(&mut self) {
        self.trig_acc = 0;
        self.track_peak_acc = [0.0; MAX_TRACKS];
        self.peak_acc = [0.0; 2];
        self.rms_sum = 0.0;
        self.rms_n = 0;
    }

    /// Convenience for native hosts and tests: renders into caller buffers of
    /// any length, in MAX_BLOCK chunks.
    pub fn render(&mut self, left: &mut [f32], right: &mut [f32]) {
        let n = left.len().min(right.len());
        let mut pos = 0;
        while pos < n {
            let len = (n - pos).min(MAX_BLOCK);
            self.process(len);
            left[pos..pos + len].copy_from_slice(&self.out_l[..len]);
            right[pos..pos + len].copy_from_slice(&self.out_r[..len]);
            pos += len;
        }
    }
}
