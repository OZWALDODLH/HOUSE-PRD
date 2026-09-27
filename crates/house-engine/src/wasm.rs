//! C-ABI exports for the WebAssembly build. The AudioWorklet owns exactly one
//! engine; everything runs on the worklet thread, so plain statics are enough.

use crate::command::decode;
use crate::engine::{Engine, MAX_BLOCK, STATUS_LEN};
use core::ptr::{addr_of, addr_of_mut, null, null_mut};

const CMD_LEN: usize = 64;

static mut ENGINE: *mut Engine = null_mut();
static mut CMD: [f64; CMD_LEN] = [0.0; CMD_LEN];
static mut PENDING: *mut f32 = null_mut();
static mut PENDING_LEN: usize = 0;

fn eng() -> Option<&'static mut Engine> {
    // SAFETY: single-threaded worklet; the pointer is either null or a leaked Box.
    unsafe { ENGINE.as_mut() }
}

#[no_mangle]
pub extern "C" fn he_init(sample_rate: f32) {
    unsafe {
        if !ENGINE.is_null() {
            drop(Box::from_raw(ENGINE));
        }
        ENGINE = Box::into_raw(Box::new(Engine::new(sample_rate)));
    }
}

/// Where the host writes a command before calling `he_cmd`.
#[no_mangle]
pub extern "C" fn he_cmd_ptr() -> *mut f64 {
    addr_of_mut!(CMD) as *mut f64
}

#[no_mangle]
pub extern "C" fn he_cmd(len: u32) {
    if let Some(e) = eng() {
        let n = (len as usize).min(CMD_LEN);
        let s = unsafe { core::slice::from_raw_parts(addr_of!(CMD) as *const f64, n) };
        if let Some(c) = decode(s) {
            e.apply(c);
        }
    }
}

#[no_mangle]
pub extern "C" fn he_process(frames: u32) {
    if let Some(e) = eng() {
        e.process(frames as usize);
    }
}

/// 0 = master left, 1 = master right, 2 = cue left, 3 = cue right.
#[no_mangle]
pub extern "C" fn he_out_ptr(channel: u32) -> *const f32 {
    match eng() {
        Some(e) => match channel {
            0 => e.out_l.as_ptr(),
            1 => e.out_r.as_ptr(),
            2 => e.out_cue_l.as_ptr(),
            _ => e.out_cue_r.as_ptr(),
        },
        None => null(),
    }
}

#[no_mangle]
pub extern "C" fn he_status_ptr() -> *const f32 {
    eng().map(|e| e.status.as_ptr()).unwrap_or(null())
}

#[no_mangle]
pub extern "C" fn he_status_ack() {
    if let Some(e) = eng() {
        e.ack_status();
    }
}

#[no_mangle]
pub extern "C" fn he_max_block() -> u32 {
    MAX_BLOCK as u32
}

#[no_mangle]
pub extern "C" fn he_status_len() -> u32 {
    STATUS_LEN as u32
}

/// Reserves memory for a sample; the host copies PCM there, then commits it.
#[no_mangle]
pub extern "C" fn he_sample_alloc(len: u32) -> *mut f32 {
    unsafe {
        free_pending();
        let b = vec![0.0f32; len.max(1) as usize].into_boxed_slice();
        PENDING_LEN = b.len();
        PENDING = Box::into_raw(b) as *mut f32;
        PENDING
    }
}

#[no_mangle]
pub extern "C" fn he_sample_commit(slot: u32, sample_rate: f32) {
    unsafe {
        if PENDING.is_null() {
            return;
        }
        let b: Box<[f32]> = Box::from_raw(core::ptr::slice_from_raw_parts_mut(PENDING, PENDING_LEN));
        PENDING = null_mut();
        PENDING_LEN = 0;
        if let Some(e) = eng() {
            // The previous buffer (if any) is dropped here, outside `process`.
            let _old = e.load_sample(slot as usize, b, sample_rate);
        }
    }
}

unsafe fn free_pending() {
    if !PENDING.is_null() {
        drop(Box::from_raw(core::ptr::slice_from_raw_parts_mut(PENDING, PENDING_LEN)));
        PENDING = null_mut();
        PENDING_LEN = 0;
    }
}
