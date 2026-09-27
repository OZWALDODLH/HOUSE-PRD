//! Motor de audio de HOUSE.
//!
//! One engine, two hosts: compiled to WebAssembly it runs inside an
//! AudioWorklet (browser build); compiled natively it runs inside the `cpal`
//! callback of the desktop app. Both talk to it with the same numeric
//! command protocol (see [`command`]).

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
