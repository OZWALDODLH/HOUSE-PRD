//! The engine: tracks, step sequencer, song sections, automation, mixer and
//! master chain.
//!
//! Real-time rules: `process` and `apply` never allocate, lock or block.
//! The only allocating calls are `Engine::new` and `load_sample`, which hosts
//! run outside the audio callback (or hand over already-allocated buffers).

use crate::analysis::{Analyzer, BANDS};
use crate::automation::{
    master_param, target, track_param, volume_gain, Lane, Point, MAX_LANES, MAX_POINTS,
};
use crate::command::{master, mix, Command};
use crate::drums::{DrumModel, DrumVoice};
use crate::dsp::*;
use crate::fx::{Glue, Limiter, PingPong, Reverb};
use crate::inserts::{FxCtx, Insert, INSERT_PARAMS, INSERT_SLOTS};
use crate::inst::{Ctx, Inst};
use crate::pluck::PLUCK_SCRATCH;
use crate::sampler::SampleBuf;
use crate::trackfx::{DjFilter, TrackFx};

pub const MAX_TRACKS: usize = 32;
pub const MAX_STEPS: usize = 64;
pub const MAX_SECTIONS: usize = 32;
pub const MAX_BLOCK: usize = 256;
pub const SAMPLE_SLOTS: usize = 64;
pub const NUM_PARAMS: usize = 8;
pub const STATUS_LEN: usize = 128;
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
    pub const FM: u8 = 6;
    pub const SUPER: u8 = 7;
    pub const PLUCK: u8 = 8;
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
    /// Tracks 0..15 that played since the last read (bit mask).
    pub const TRIGGERS: usize = 7;
    pub const PEAK_L: usize = 8;
    pub const PEAK_R: usize = 9;
    pub const RMS: usize = 10;
    pub const KICK: usize = 11;
    pub const SNARE: usize = 12;
    pub const HAT: usize = 13;
    pub const LIMITER_GR: usize = 14;
    pub const BARS_TO_NEXT: usize = 15;
    pub const BANDS: usize = 32;
    pub const NEXT_KIND: usize = 48;
    pub const CUR_KIND: usize = 49;
    pub const STEP_FRACTION: usize = 50;
    pub const BPM: usize = 51;
    pub const SONG_BARS: usize = 52;
    pub const MODE: usize = 53;
    pub const BAR_IN_SECTION: usize = 54;
    /// Tracks 16..31 that played since the last read (bit mask).
    pub const TRIGGERS_HI: usize = 55;
    /// Peak level of each of the 32 tracks since the last read.
    pub const TRACK_PEAKS: usize = 64;
}

/// Folds a newer status snapshot into `acc`, for hosts that read snapshots
/// less often than the engine writes them: the newest position and levels,
/// the highest peaks and every trigger since `acc` was last read.
pub fn merge_status(acc: &mut [f32; STATUS_LEN], next: &[f32; STATUS_LEN]) {
    for (i, (a, n)) in acc.iter_mut().zip(next).enumerate() {
        *a = match i {
            st::TRIGGERS | st::TRIGGERS_HI => ((*a as u32) | (*n as u32)) as f32,
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
    /// Length of each note in steps; 0 = the step's `len`.
    pub lens: [u8; 4],
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
            lens: [0; 4],
        }
    }
}

impl Step {
    #[inline]
    fn note_len(&self, k: usize) -> u8 {
        if self.lens[k] > 0 {
            self.lens[k]
        } else {
            self.len
        }
    }
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

/// What automation changes on a track during the current block.
#[derive(Clone, Copy)]
struct TrackAuto {
    gain: f32,
    filter: Option<f32>,
    pan: Option<f32>,
    rev: Option<f32>,
    del: Option<f32>,
    params: [Option<f32>; NUM_PARAMS],
    fx: [[Option<f32>; INSERT_PARAMS]; INSERT_SLOTS],
}

impl Default for TrackAuto {
    fn default() -> Self {
        TrackAuto {
            gain: 1.0,
            filter: None,
            pan: None,
            rev: None,
            del: None,
            params: [None; NUM_PARAMS],
            fx: [[None; INSERT_PARAMS]; INSERT_SLOTS],
        }
    }
}

pub struct Track {
    pub inst: Inst,
    pub kind: u8,
    pub model: u8,
    /// The knobs as the interface set them.
    pub params: [f32; NUM_PARAMS],
    /// What the instrument uses now (the knobs, or automation on top).
    applied: [f32; NUM_PARAMS],
    pub steps: [Step; MAX_STEPS],
    pub length: usize,
    pub vol_db: f32,
    pub pan: f32,
    pan_applied: f32,
    pub mute: bool,
    pub solo: bool,
    pub send_rev: f32,
    pub send_del: f32,
    pub duck: f32,
    pub active: bool,
    pub once: bool,
    filter_knob: f32,
    pub fx: TrackFx,
    pub inserts: [Insert; INSERT_SLOTS],
    auto: TrackAuto,
    gain: Smooth,
    pl: f32,
    pr: f32,
    offs: [PendingOff; 8],
    audible: bool,
    scratch: Box<[f32]>,
}

impl Track {
    fn new(sr: f32) -> Self {
        Track {
            inst: Inst::None,
            kind: kind::NONE,
            model: 0,
            params: [0.5; NUM_PARAMS],
            applied: [0.5; NUM_PARAMS],
            steps: [Step::default(); MAX_STEPS],
            length: 16,
            vol_db: 0.0,
            pan: 0.0,
            pan_applied: 0.0,
            mute: false,
            solo: false,
            send_rev: 0.0,
            send_del: 0.0,
            duck: 0.0,
            active: false,
            once: false,
            filter_knob: 0.5,
            fx: TrackFx::new(sr),
            inserts: [Insert::new(), Insert::new()],
            auto: TrackAuto::default(),
            gain: Smooth::new(1.0, 0.015, sr),
            pl: core::f32::consts::FRAC_1_SQRT_2,
            pr: core::f32::consts::FRAC_1_SQRT_2,
            offs: [NO_OFF; 8],
            audible: true,
            scratch: vec![0.0; PLUCK_SCRATCH].into_boxed_slice(),
        }
    }

    /// Schedules the release of a note; a note already waiting is replaced, so
    /// a new, longer note never gets cut by the previous one's release.
    fn schedule_off(&mut self, note: u8, samples: i64) {
        let n = note as i16;
        if let Some(o) = self.offs.iter_mut().find(|o| o.note == n) {
            o.samples = samples;
            return;
        }
        if let Some(o) = self.offs.iter_mut().find(|o| o.note < 0) {
            *o = PendingOff { note: n, samples };
            return;
        }
        // All slots busy: replace the one that ends first.
        let mut idx = 0;
        for (i, o) in self.offs.iter().enumerate() {
            if o.samples < self.offs[idx].samples {
                idx = i;
            }
        }
        self.offs[idx] = PendingOff { note: n, samples };
    }

    fn effective_params(&self) -> [f32; NUM_PARAMS] {
        let mut p = self.params;
        for (v, a) in p.iter_mut().zip(self.auto.params) {
            if let Some(x) = a {
                *v = x;
            }
        }
        p
    }

    /// Brings the instrument, filter, pan and effects to the values in use.
    fn apply_values(&mut self, sr: f32) {
        let f = self.auto.filter.unwrap_or(self.filter_knob);
        if f != self.fx.filter {
            self.fx.set_filter(f, sr);
        }
        let pan = self.auto.pan.unwrap_or(self.pan);
        if pan != self.pan_applied {
            let (l, r) = pan_gains(pan);
            self.pl = l;
            self.pr = r;
            self.pan_applied = pan;
        }
        let eff = self.effective_params();
        if eff != self.applied {
            self.inst.set_params(&eff, sr);
            self.applied = eff;
        }
        for (k, ins) in self.inserts.iter_mut().enumerate() {
            if !ins.is_on() {
                continue;
            }
            let mut v = ins.knobs;
            for (x, a) in v.iter_mut().zip(self.auto.fx[k]) {
                if let Some(y) = a {
                    *x = y;
                }
            }
            ins.apply(&v, sr);
        }
    }

    /// Note-offs due within the next `n` samples.
    fn run_offs(&mut self, n: usize) {
        for k in 0..self.offs.len() {
            if self.offs[k].note >= 0 {
                if self.offs[k].samples <= 0 {
                    let note = self.offs[k].note as u8;
                    self.offs[k] = NO_OFF;
                    self.inst.stop(note);
                } else {
                    self.offs[k].samples -= n as i64;
                }
            }
        }
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

/// What automation changes on the master during the current block.
#[derive(Clone, Copy)]
struct MasterAuto {
    filter: Option<f32>,
    gain: f32,
    rev: f32,
    del: f32,
}

impl Default for MasterAuto {
    fn default() -> Self {
        MasterAuto {
            filter: None,
            gain: 1.0,
            rev: 1.0,
            del: 1.0,
        }
    }
}

pub struct Engine {
    pub sr: f32,
    pub tracks: [Track; MAX_TRACKS],
    preview: Track,
    shots: [Shot; SHOT_VOICES],
    shot_scratch: [Box<[f32]>; SHOT_VOICES],
    next_shot: usize,
    click: DrumVoice,
    playing: bool,
    bpm: f32,
    swing: f32,
    global_step: u64,
    last_step: u64,
    samples_to_next: f64,
    cur_dur: f64,
    /// Song position in beats, for effects that follow the tempo. Runs even
    /// when stopped so a wobble keeps moving while you play live.
    beat_clock: f64,
    mode: u8,
    sections: [Section; MAX_SECTIONS],
    section_count: usize,
    lanes: [Lane; MAX_LANES],
    master_auto: MasterAuto,
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
    auto_gain: Smooth,
    master_filter: DjFilter,
    master_filter_knob: f32,
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
            shot_scratch: core::array::from_fn(|_| vec![0.0; PLUCK_SCRATCH].into_boxed_slice()),
            next_shot: 0,
            click: DrumVoice::new(DrumModel::Click, 99),
            playing: false,
            bpm: 124.0,
            swing: 0.5,
            global_step: 0,
            last_step: 0,
            samples_to_next: 0.0,
            cur_dur: 1.0,
            beat_clock: 0.0,
            mode: 0,
            sections: [Section::default(); MAX_SECTIONS],
            section_count: 0,
            lanes: [Lane::default(); MAX_LANES],
            master_auto: MasterAuto::default(),
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
            auto_gain: Smooth::new(1.0, 0.01, sr),
            master_filter: DjFilter::default(),
            master_filter_knob: 0.5,
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
            t.inst.stop(255);
            t.inst.choke(sr);
            t.offs = [NO_OFF; 8];
        }
        self.preview.inst.stop(255);
    }

    /// Fraction of the current step already played (0..1).
    fn step_fraction(&self) -> f64 {
        if self.playing && self.cur_dur > 0.0 {
            (1.0 - self.samples_to_next / self.cur_dur).clamp(0.0, 1.0)
        } else {
            0.0
        }
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
                lens,
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
                            lens,
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
                    t.inst = Inst::new(kind, model, sr, track as u32 + 1);
                    let eff = t.effective_params();
                    t.inst.set_params(&eff, sr);
                    t.applied = eff;
                    t.offs = [NO_OFF; 8];
                    t.active = kind != kind::NONE;
                }
            }
            Command::SetParam { track, idx, value } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    if (idx as usize) < NUM_PARAMS {
                        t.params[idx as usize] = value.clamp(0.0, 1.0);
                        let eff = t.effective_params();
                        t.inst.set_params(&eff, sr);
                        t.applied = eff;
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
                            t.apply_values(sr);
                        }
                        mix::MUTE => t.mute = value > 0.5,
                        mix::SOLO => t.solo = value > 0.5,
                        mix::SEND_REVERB => t.send_rev = value.clamp(0.0, 1.0),
                        mix::SEND_DELAY => t.send_del = value.clamp(0.0, 1.0),
                        mix::DUCK => t.duck = value.clamp(0.0, 1.0),
                        mix::ACTIVE => t.active = value > 0.5 && t.kind != kind::NONE,
                        mix::ONCE_PER_SECTION => t.once = value > 0.5,
                        mix::FILTER => {
                            t.filter_knob = value.clamp(0.0, 1.0);
                            t.apply_values(sr);
                        }
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
                    t.inst.stop(note);
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
                master::FILTER => {
                    self.master_filter_knob = value.clamp(0.0, 1.0);
                    let f = self.master_auto.filter.unwrap_or(self.master_filter_knob);
                    self.master_filter.set(f, sr);
                }
                _ => {}
            },
            Command::SetSidechainSource(t) => {
                self.sidechain = if (t as usize) < MAX_TRACKS {
                    Some(t as usize)
                } else {
                    None
                }
            }
            Command::Seek { bar, step } => {
                let total = self.song_bars();
                let b = if self.mode == 1 && total > 0 {
                    bar % total
                } else {
                    bar
                };
                self.global_step = b as u64 * 16 + (step.min(15)) as u64;
                // The status shows the new place right away, playing or not.
                self.last_step = self.global_step;
                self.beat_clock = self.global_step as f64 / 4.0;
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
                    p.inst = Inst::new(kind, model, sr, 777);
                }
                p.params = params;
                p.applied = params;
                p.inst.set_params(&params, sr);
                p.active = true;
                let ctx = Ctx {
                    sr,
                    bpm: self.bpm,
                    bank: &self.bank,
                };
                p.inst
                    .start(note, vel, false, false, &params, &ctx, &mut p.scratch);
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
                let ctx = Ctx {
                    sr,
                    bpm: self.bpm,
                    bank: &self.bank,
                };
                let s = &mut self.shots[i];
                s.inst = Inst::new(kind, model, sr, 900 + i as u32);
                s.params = params;
                if let Inst::Sampler(sm) = &mut s.inst {
                    sm.slot = (slot as usize).min(SAMPLE_SLOTS - 1);
                }
                s.inst.set_params(&params, sr);
                s.note = note;
                s.life = (6.0 * sr) as i64;
                s.off = (0.6 * sr) as i64;
                s.active = kind != kind::NONE;
                let vel = vel.clamp(0.0, 1.0);
                s.inst.start(
                    note,
                    vel,
                    false,
                    false,
                    &params,
                    &ctx,
                    &mut self.shot_scratch[i],
                );
                if matches!(s.inst, Inst::Sampler(_)) {
                    // A recorded sound plays to its end.
                    s.off = s.life;
                }
                if let Some(m) = s.inst.drum_model() {
                    let c = m.hit_class();
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
            Command::SetFx { track, slot, kind } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    if let Some(ins) = t.inserts.get_mut(slot as usize) {
                        ins.set_kind(kind, sr);
                    }
                }
            }
            Command::SetFxParam {
                track,
                slot,
                idx,
                value,
            } => {
                if let Some(t) = self.tracks.get_mut(track as usize) {
                    if let Some(ins) = t.inserts.get_mut(slot as usize) {
                        ins.set_knob(idx as usize, value, sr);
                    }
                }
            }
            Command::AutoLane {
                lane,
                target,
                track,
                param,
                count,
            } => {
                if let Some(l) = self.lanes.get_mut(lane as usize) {
                    l.target = target;
                    l.track = track;
                    l.param = param;
                    l.count = (count as usize).min(MAX_POINTS);
                }
            }
            Command::AutoPoint {
                lane,
                index,
                pos,
                value,
                tension,
            } => {
                if let Some(l) = self.lanes.get_mut(lane as usize) {
                    if let Some(p) = l.points.get_mut(index as usize) {
                        *p = Point {
                            pos: pos.max(0.0),
                            value: value.clamp(0.0, 1.0),
                            tension: tension.clamp(-1.0, 1.0),
                        };
                    }
                }
            }
        }
    }

    fn mark_hit(&mut self, ti: usize, vel: f32) {
        self.trig_acc |= 1 << ti;
        if let Some(m) = self.tracks[ti].inst.drum_model() {
            let c = m.hit_class();
            if c > 0 {
                let h = &mut self.hits[(c - 1) as usize];
                *h = h.max(vel);
            }
        }
    }

    /// Starts a sound on a track. `step` carries the pattern step when the
    /// sequencer is the one triggering (used for chords, note lengths and slides).
    fn trigger(
        &mut self,
        ti: usize,
        note: u8,
        vel: f32,
        accent: bool,
        slide: bool,
        step: Option<(Step, u64)>,
    ) {
        let base = self.base_step();
        let is_sidechain = self.sidechain == Some(ti);
        let ctx = Ctx {
            sr: self.sr,
            bpm: self.bpm,
            bank: &self.bank,
        };
        let t = &mut self.tracks[ti];
        if !t.active || matches!(t.inst, Inst::None) {
            return;
        }
        let params = t.applied;
        let poly = t.inst.is_poly();
        match step {
            Some((s, _)) if poly => {
                for n in s.notes.iter().filter(|n| **n >= 0) {
                    t.inst
                        .start(*n as u8, vel, false, accent, &params, &ctx, &mut t.scratch);
                }
            }
            _ => t
                .inst
                .start(note, vel, slide, accent, &params, &ctx, &mut t.scratch),
        }
        // Note lengths from the pattern (live notes wait for the key release).
        if let Some((s, index)) = step {
            let gate = match t.kind {
                kind::ACID => 0.55,
                kind::BASS808 => 0.95,
                kind::POLY | kind::FM | kind::SUPER | kind::PLUCK => 0.9,
                _ => 0.0,
            };
            if gate > 0.0 {
                if poly {
                    for (k, n) in s.notes.iter().enumerate() {
                        if *n >= 0 {
                            let samples = (s.note_len(k) as f64 * base * gate) as i64;
                            t.schedule_off(*n as u8, samples);
                        }
                    }
                } else {
                    let len = s.note_len(0);
                    let next = t.steps[((index + len as u64) % t.length as u64) as usize];
                    let tie = next.on && next.slide && matches!(t.kind, kind::ACID | kind::BASS808);
                    if !tie {
                        t.schedule_off(note, (len as f64 * base * gate) as i64);
                    }
                }
            }
        }
        if t.inst.drum_model() == Some(DrumModel::HatClosed) {
            let sr = self.sr;
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
        self.beat_clock = index as f64 / 4.0;
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

    /// Evaluates the automation lanes at the song position and brings every
    /// track and the master to the values in use. Curves play in song mode.
    fn automate(&mut self) {
        for t in self.tracks.iter_mut() {
            t.auto = TrackAuto::default();
        }
        let mut m = MasterAuto::default();
        if self.mode == 1 && self.playing {
            let pos = self.last_step as f32 + self.step_fraction() as f32;
            for lane in self.lanes.iter() {
                let Some(v) = lane.eval(pos) else {
                    continue;
                };
                match lane.target {
                    target::MASTER => match lane.param {
                        master_param::FILTER => m.filter = Some(v),
                        master_param::VOLUME => m.gain = volume_gain(v),
                        master_param::REVERB => m.rev = v * 2.0,
                        master_param::DELAY => m.del = v * 2.0,
                        _ => {}
                    },
                    target::TRACK => {
                        if let Some(t) = self.tracks.get_mut(lane.track as usize) {
                            let a = &mut t.auto;
                            match lane.param {
                                track_param::VOLUME => a.gain = volume_gain(v),
                                track_param::FILTER => a.filter = Some(v),
                                track_param::PAN => a.pan = Some(v * 2.0 - 1.0),
                                track_param::SEND_REVERB => a.rev = Some(v),
                                track_param::SEND_DELAY => a.del = Some(v),
                                p if (track_param::INST..track_param::INST + NUM_PARAMS as u8)
                                    .contains(&p) =>
                                {
                                    a.params[(p - track_param::INST) as usize] = Some(v)
                                }
                                p if (track_param::FX
                                    ..track_param::FX + (INSERT_SLOTS * INSERT_PARAMS) as u8)
                                    .contains(&p) =>
                                {
                                    let k = (p - track_param::FX) as usize;
                                    a.fx[k / INSERT_PARAMS][k % INSERT_PARAMS] = Some(v);
                                }
                                _ => {}
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
        let sr = self.sr;
        for t in self.tracks.iter_mut() {
            if t.active {
                t.apply_values(sr);
            }
        }
        self.master_auto = m;
        let f = m.filter.unwrap_or(self.master_filter_knob);
        if f != self.master_filter.value {
            self.master_filter.set(f, sr);
        }
        self.auto_gain.set(m.gain);
    }

    fn update_audibility(&mut self) {
        let any_solo = self.tracks.iter().any(|t| t.active && t.solo);
        for t in self.tracks.iter_mut() {
            t.audible = t.active && !t.mute && (!any_solo || t.solo);
            let g = if t.audible {
                db_to_gain(t.vol_db) * t.auto.gain
            } else {
                0.0
            };
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
        self.automate();
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
        let beat0 = self.beat_clock;
        let beat_inc = self.bpm as f64 / 60.0 / sr as f64;
        let ctx = Ctx {
            sr,
            bpm: self.bpm,
            bank: &self.bank,
        };
        for ti in 0..MAX_TRACKS {
            let t = &mut self.tracks[ti];
            if !t.active {
                continue;
            }
            t.run_offs(n);
            let buf = &mut self.buf[..n];
            t.inst.render(buf, &ctx, &mut t.scratch);
            if !t.fx.is_neutral() {
                for x in buf.iter_mut() {
                    *x = t.fx.process(*x);
                }
            }
            let inserts = t.inserts.iter().any(|x| x.is_on());
            let send_rev = t.auto.rev.unwrap_or(t.send_rev);
            let send_del = t.auto.del.unwrap_or(t.send_del);
            let mut peak = 0.0f32;
            for i in 0..n {
                let x = self.buf[i];
                let (mut l, mut r) = (x, x);
                if inserts {
                    let fx = FxCtx {
                        sr,
                        bpm: ctx.bpm,
                        beat: beat0 + i as f64 * beat_inc,
                    };
                    for ins in t.inserts.iter_mut() {
                        if ins.is_on() {
                            (l, r) = ins.process(l, r, &fx);
                        }
                    }
                }
                let g = t.gain.next();
                let d = if t.duck > 0.0 {
                    1.0 - t.duck * self.duck_buf[i]
                } else {
                    1.0
                };
                let gl = l * g * d;
                let gr = r * g * d;
                peak = peak.max(gl.abs().max(gr.abs()));
                let j = offset + i;
                self.mix_l[j] += gl * t.pl;
                self.mix_r[j] += gr * t.pr;
                let mono = (gl + gr) * 0.5;
                self.rev_in[j] += mono * send_rev;
                self.del_in[j] += mono * send_del;
            }
            let acc = &mut self.track_peak_acc[ti];
            *acc = acc.max(peak);
        }
        // Soundboard one-shots go to the master bus, with a touch of reverb.
        for (s, scratch) in self.shots.iter_mut().zip(self.shot_scratch.iter_mut()) {
            if !s.active {
                continue;
            }
            let buf = &mut self.buf[..n];
            s.inst.render(buf, &ctx, scratch);
            for i in 0..n {
                let x = buf[i] * 0.8;
                self.mix_l[offset + i] += x;
                self.mix_r[offset + i] += x;
                self.rev_in[offset + i] += x * 0.12;
            }
            if s.off > 0 {
                s.off -= n as i64;
                if s.off <= 0 {
                    let note = s.note;
                    s.inst.stop(note);
                }
            }
            s.life -= n as i64;
            if s.life <= 0 {
                *s = SHOT_IDLE;
            }
        }
        // Preview (sounds auditioned from the browser) and metronome go to the cue bus.
        {
            let p = &mut self.preview;
            if p.active {
                p.run_offs(n);
                let buf = &mut self.buf[..n];
                p.inst.render(buf, &ctx, &mut p.scratch);
                for i in 0..n {
                    let x = buf[i] * 0.8;
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
        self.beat_clock += n as f64 * beat_inc;
    }

    fn master(&mut self, frames: usize) {
        let mut pk = [0.0f32; 2];
        let mut rms = 0.0f64;
        let rev_mul = self.master_auto.rev;
        let del_mul = self.master_auto.del;
        for i in 0..frames {
            let (rl, rr) = self.reverb.process(self.rev_in[i]);
            let (dl, dr) = self.delay.process(self.del_in[i]);
            let mut l = self.mix_l[i] + rl * rev_mul + dl * del_mul;
            let mut r = self.mix_r[i] + rr * rev_mul + dr * del_mul;
            if self.build_active {
                l = self.build_hp[0].hp(l);
                r = self.build_hp[1].hp(r);
            }
            (l, r) = self.master_filter.process(l, r);
            if self.cue_to_master {
                l += self.cue_l[i];
                r += self.cue_r[i];
            }
            let (gl, gr) = self.glue.process(l, r);
            let g = self.master_gain.next() * self.auto_gain.next();
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
        let frac = self.step_fraction() as f32;
        let s = &mut self.status;
        s[st::PLAYING] = if self.playing { 1.0 } else { 0.0 };
        s[st::STEP] = step as f32;
        s[st::BAR] = (step / 16) as f32;
        s[st::STEP_IN_BAR] = (step % 16) as f32;
        s[st::STEP_FRACTION] = frac;
        s[st::BEAT_PHASE] = (((step % 4) as f32) + frac) / 4.0;
        s[st::TRIGGERS] = (self.trig_acc & 0xFFFF) as f32;
        s[st::TRIGGERS_HI] = ((self.trig_acc >> 16) & 0xFFFF) as f32;
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
