//! Command protocol between the interface and the engine.
//!
//! Every command travels as a flat list of numbers `[opcode, a, b, ...]`.
//! The same encoding is used by the WebAssembly worklet and by the desktop app
//! (through a lock-free queue), so both hosts behave identically.

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Command {
    Play,
    Stop,
    SetBpm(f32),
    SetSwing(f32),
    SetStep {
        track: u8,
        step: u8,
        on: bool,
        vel: f32,
        len: u8,
        accent: bool,
        slide: bool,
        notes: [i8; 4],
    },
    SetTrackKind {
        track: u8,
        kind: u8,
        model: u8,
    },
    SetParam {
        track: u8,
        idx: u8,
        value: f32,
    },
    SetMix {
        track: u8,
        param: u8,
        value: f32,
    },
    NoteOn {
        track: u8,
        note: u8,
        vel: f32,
    },
    NoteOff {
        track: u8,
        note: u8,
    },
    SetLength {
        track: u8,
        steps: u8,
    },
    SetMode(u8),
    SetSectionCount(u8),
    SetSection {
        index: u8,
        bars: u8,
        mask: u32,
        kind: u8,
    },
    SetMaster {
        param: u8,
        value: f32,
    },
    SetSidechainSource(u8),
    Seek {
        bar: u32,
    },
    AllNotesOff,
    Preview {
        kind: u8,
        model: u8,
        note: u8,
        vel: f32,
        params: [f32; 8],
    },
    SetSampleSlot {
        track: u8,
        slot: u8,
    },
    ClearSteps {
        track: u8,
    },
}

pub mod op {
    pub const PLAY: u32 = 1;
    pub const STOP: u32 = 2;
    pub const SET_BPM: u32 = 3;
    pub const SET_SWING: u32 = 4;
    pub const SET_STEP: u32 = 5;
    pub const SET_TRACK_KIND: u32 = 6;
    pub const SET_PARAM: u32 = 7;
    pub const SET_MIX: u32 = 8;
    pub const NOTE_ON: u32 = 9;
    pub const NOTE_OFF: u32 = 10;
    pub const SET_LENGTH: u32 = 11;
    pub const SET_MODE: u32 = 12;
    pub const SET_SECTION_COUNT: u32 = 13;
    pub const SET_SECTION: u32 = 14;
    pub const SET_MASTER: u32 = 15;
    pub const SET_SIDECHAIN: u32 = 16;
    pub const SEEK: u32 = 17;
    pub const ALL_NOTES_OFF: u32 = 18;
    pub const PREVIEW: u32 = 19;
    pub const SET_SAMPLE_SLOT: u32 = 20;
    pub const CLEAR_STEPS: u32 = 21;
}

/// Mixer parameter ids for `SetMix`.
pub mod mix {
    pub const VOLUME_DB: u8 = 0;
    pub const PAN: u8 = 1;
    pub const MUTE: u8 = 2;
    pub const SOLO: u8 = 3;
    pub const SEND_REVERB: u8 = 4;
    pub const SEND_DELAY: u8 = 5;
    pub const DUCK: u8 = 6;
    pub const ACTIVE: u8 = 7;
    /// Only plays in the first bar of each song section (risers, impacts).
    pub const ONCE_PER_SECTION: u8 = 8;
    /// One-knob DJ filter: 0.5 = open, lower = low-pass, higher = high-pass.
    pub const FILTER: u8 = 9;
    /// EQ gains in dB (-24..+12): lows (shelf 180 Hz), mids (bell 1.2 kHz), highs (shelf 5 kHz).
    pub const EQ_LOW: u8 = 10;
    pub const EQ_MID: u8 = 11;
    pub const EQ_HIGH: u8 = 12;
    /// Saturation amount 0..1.
    pub const DRIVE: u8 = 13;
}

/// Master parameter ids for `SetMaster`.
pub mod master {
    pub const VOLUME_DB: u8 = 0;
    pub const GLUE: u8 = 1;
    pub const CEILING_DB: u8 = 2;
    pub const REVERB_SIZE: u8 = 3;
    pub const DELAY_STEPS: u8 = 4;
    pub const DELAY_FEEDBACK: u8 = 5;
    pub const METRONOME: u8 = 6;
    pub const AUTO_BUILD: u8 = 7;
    pub const REVERB_DAMP: u8 = 8;
    pub const METRONOME_TO_MASTER: u8 = 9;
}

#[inline]
fn u8_at(a: &[f64], i: usize) -> u8 {
    a.get(i).copied().unwrap_or(0.0).clamp(0.0, 255.0) as u8
}

#[inline]
fn f_at(a: &[f64], i: usize) -> f32 {
    let v = a.get(i).copied().unwrap_or(0.0);
    if v.is_finite() {
        v as f32
    } else {
        0.0
    }
}

#[inline]
fn note_at(a: &[f64], i: usize) -> i8 {
    let v = a.get(i).copied().unwrap_or(-1.0);
    if (0.0..=127.0).contains(&v) {
        v as i8
    } else {
        -1
    }
}

/// Decodes one command. Returns `None` for unknown or malformed input, so a
/// bad message can never crash the audio thread.
pub fn decode(a: &[f64]) -> Option<Command> {
    let code = *a.first()? as u32;
    Some(match code {
        op::PLAY => Command::Play,
        op::STOP => Command::Stop,
        op::SET_BPM => Command::SetBpm(f_at(a, 1)),
        op::SET_SWING => Command::SetSwing(f_at(a, 1)),
        op::SET_STEP => {
            if a.len() < 12 {
                return None;
            }
            Command::SetStep {
                track: u8_at(a, 1),
                step: u8_at(a, 2),
                on: f_at(a, 3) > 0.5,
                vel: f_at(a, 4),
                len: u8_at(a, 5).max(1),
                accent: f_at(a, 6) > 0.5,
                slide: f_at(a, 7) > 0.5,
                notes: [note_at(a, 8), note_at(a, 9), note_at(a, 10), note_at(a, 11)],
            }
        }
        op::SET_TRACK_KIND => Command::SetTrackKind {
            track: u8_at(a, 1),
            kind: u8_at(a, 2),
            model: u8_at(a, 3),
        },
        op::SET_PARAM => Command::SetParam {
            track: u8_at(a, 1),
            idx: u8_at(a, 2),
            value: f_at(a, 3),
        },
        op::SET_MIX => Command::SetMix {
            track: u8_at(a, 1),
            param: u8_at(a, 2),
            value: f_at(a, 3),
        },
        op::NOTE_ON => Command::NoteOn {
            track: u8_at(a, 1),
            note: u8_at(a, 2),
            vel: f_at(a, 3),
        },
        op::NOTE_OFF => Command::NoteOff {
            track: u8_at(a, 1),
            note: u8_at(a, 2),
        },
        op::SET_LENGTH => Command::SetLength {
            track: u8_at(a, 1),
            steps: u8_at(a, 2),
        },
        op::SET_MODE => Command::SetMode(u8_at(a, 1)),
        op::SET_SECTION_COUNT => Command::SetSectionCount(u8_at(a, 1)),
        op::SET_SECTION => Command::SetSection {
            index: u8_at(a, 1),
            bars: u8_at(a, 2),
            mask: a.get(3).copied().unwrap_or(0.0).clamp(0.0, u32::MAX as f64) as u32,
            kind: u8_at(a, 4),
        },
        op::SET_MASTER => Command::SetMaster {
            param: u8_at(a, 1),
            value: f_at(a, 2),
        },
        op::SET_SIDECHAIN => Command::SetSidechainSource(u8_at(a, 1)),
        op::SEEK => Command::Seek {
            bar: a.get(1).copied().unwrap_or(0.0).max(0.0) as u32,
        },
        op::ALL_NOTES_OFF => Command::AllNotesOff,
        op::PREVIEW => {
            let mut params = [0.5f32; 8];
            for (i, p) in params.iter_mut().enumerate() {
                if let Some(v) = a.get(5 + i) {
                    *p = (*v as f32).clamp(0.0, 1.0);
                }
            }
            Command::Preview {
                kind: u8_at(a, 1),
                model: u8_at(a, 2),
                note: u8_at(a, 3),
                vel: f_at(a, 4),
                params,
            }
        }
        op::SET_SAMPLE_SLOT => Command::SetSampleSlot {
            track: u8_at(a, 1),
            slot: u8_at(a, 2),
        },
        op::CLEAR_STEPS => Command::ClearSteps { track: u8_at(a, 1) },
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_step() {
        let c = decode(&[
            5.0, 2.0, 7.0, 1.0, 0.8, 2.0, 1.0, 0.0, 57.0, -1.0, -1.0, -1.0,
        ])
        .unwrap();
        assert_eq!(
            c,
            Command::SetStep {
                track: 2,
                step: 7,
                on: true,
                vel: 0.8,
                len: 2,
                accent: true,
                slide: false,
                notes: [57, -1, -1, -1]
            }
        );
    }

    #[test]
    fn rejects_garbage() {
        assert!(decode(&[]).is_none());
        assert!(decode(&[999.0]).is_none());
        assert!(decode(&[5.0, 1.0]).is_none());
        // NaN never becomes a crash.
        assert_eq!(decode(&[3.0, f64::NAN]), Some(Command::SetBpm(0.0)));
    }
}
