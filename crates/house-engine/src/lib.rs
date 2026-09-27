//! Motor de audio de HOUSE.
//!
//! One engine, two hosts: compiled to WebAssembly it runs inside an
//! AudioWorklet (browser build); compiled natively it runs inside the `cpal`
//! callback of the desktop app. Both talk to it with the same numeric
//! command protocol (see [`command`]).

// DSP loops index several fixed arrays in lockstep; `next()` is the per-sample
// tick of each generator (not an iterator); instruments live inline in an enum
// on purpose, so switching them never allocates on the audio thread.
#![allow(clippy::needless_range_loop, clippy::should_implement_trait, clippy::large_enum_variant)]

pub mod analysis;
pub mod command;
pub mod drums;
pub mod dsp;
mod engine;
pub mod fx;
pub mod sampler;
pub mod synths;
pub mod trackfx;

pub use command::{decode, Command};
pub use engine::*;

#[cfg(target_arch = "wasm32")]
mod wasm;
