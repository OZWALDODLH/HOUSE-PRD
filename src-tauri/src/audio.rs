//! Native audio: the HOUSE engine inside a cpal output callback.
//!
//! Real-time rules (CLAUDE.md): the audio callbacks never allocate, lock,
//! touch files or log. The interface talks to them through lock-free
//! single-producer/single-consumer queues (rtrb):
//!
//! - commands and sample buffers go in (`Msg`),
//! - status snapshots come out (about 75 per second),
//! - replaced sample buffers come out too, to be freed off the audio thread.
//!
//! A second device (headphones, "pre-escucha") gets the cue bus through
//! another queue. Two devices never share a clock, so the cue side resamples
//! adaptively: a PI controller keeps the queue half full, which follows the
//! drift between the two clocks without clicks.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BufferSize, FromSample, SampleFormat, SizedSample, StreamConfig, SupportedBufferSize};
use house_engine::{Command, Engine, MAX_BLOCK, STATUS_LEN};
use rtrb::{Consumer, Producer, RingBuffer};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

/// Frames per callback we ask for (lower = less latency, more CPU).
const WANTED_BUFFER: u32 = 256;
/// Status snapshots per second sent to the interface.
const STATUS_RATE: f32 = 75.0;

pub enum Msg {
    Cmd(Command),
    Sample {
        slot: usize,
        data: Box<[f32]>,
        sr: f32,
    },
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Routing {
    pub master: Option<String>,
    pub cue: Option<String>,
    #[serde(default)]
    pub align_ms: f32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputDevice {
    pub id: String,
    pub name: String,
    pub bluetooth: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartInfo {
    pub sample_rate: u32,
    pub latency_ms: f32,
    pub cue: bool,
}

/// A running engine: its command queue and the thread that owns the streams.
pub struct Running {
    cmd: Producer<Msg>,
    pub sample_rate: u32,
    pub cue: bool,
    latency_us: Arc<AtomicU32>,
    stop: Arc<AtomicBool>,
    stop_tx: mpsc::Sender<()>,
    threads: Vec<thread::JoinHandle<()>>,
}

impl Running {
    pub fn latency_ms(&self) -> f32 {
        self.latency_us.load(Ordering::Relaxed) as f32 / 1000.0
    }

    pub fn info(&self) -> StartInfo {
        StartInfo {
            sample_rate: self.sample_rate,
            latency_ms: self.latency_ms(),
            cue: self.cue,
        }
    }

    /// Queues engine commands. Fails only if the audio thread stopped taking them.
    pub fn send(&mut self, msg: Msg) -> Result<(), String> {
        self.cmd.push(msg).map_err(|_| {
            "El audio no está respondiendo. Revisa tu salida de sonido en Salidas de audio."
                .to_string()
        })
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        let _ = self.stop_tx.send(());
        for t in self.threads.drain(..) {
            let _ = t.join();
        }
    }
}

fn err(e: impl std::fmt::Display) -> String {
    format!("No pude abrir el audio: {e}")
}

fn device_name(d: &cpal::Device) -> String {
    d.description()
        .map(|x| x.name().to_string())
        .unwrap_or_else(|_| "Salida de audio".into())
}

fn looks_bluetooth(d: &cpal::Device) -> bool {
    if let Ok(desc) = d.description() {
        if desc.interface_type() == cpal::InterfaceType::Bluetooth {
            return true;
        }
        let n = desc.name().to_lowercase();
        return [
            "bluetooth",
            "airpods",
            "buds",
            "jbl",
            "bose",
            "beats",
            "soundcore",
            "headset",
        ]
        .iter()
        .any(|k| n.contains(k));
    }
    false
}

pub fn outputs() -> Vec<OutputDevice> {
    let host = cpal::default_host();
    let Ok(devices) = host.output_devices() else {
        return vec![];
    };
    devices
        .filter_map(|d| {
            let id = d.id().ok()?.to_string();
            Some(OutputDevice {
                id,
                name: device_name(&d),
                bluetooth: looks_bluetooth(&d),
            })
        })
        .collect()
}

fn find_output(host: &cpal::Host, id: Option<&str>) -> Result<cpal::Device, String> {
    if let Some(id) = id.filter(|s| !s.is_empty() && *s != "default") {
        if let Ok(parsed) = id.parse::<cpal::DeviceId>() {
            if let Some(d) = host.device_by_id(&parsed) {
                return Ok(d);
            }
        }
    }
    host.default_output_device().ok_or_else(|| {
        "No encuentro una salida de audio. Conecta bocinas o audífonos y vuelve a intentar."
            .to_string()
    })
}

fn buffer_for(range: &SupportedBufferSize) -> BufferSize {
    match range {
        SupportedBufferSize::Range { min, max }
            if *min <= WANTED_BUFFER && WANTED_BUFFER <= *max =>
        {
            BufferSize::Fixed(WANTED_BUFFER)
        }
        _ => BufferSize::Default,
    }
}

/// Starts the engine on the chosen devices. The streams live on their own
/// thread (cpal streams cannot move between threads on every platform).
pub fn start(
    routing: &Routing,
    status_out: Arc<Mutex<Option<Channel<Vec<f32>>>>>,
) -> Result<Running, String> {
    let (cmd_tx, cmd_rx) = RingBuffer::<Msg>::new(1 << 15);
    let (st_tx, st_rx) = RingBuffer::<[f32; STATUS_LEN]>::new(16);
    let (gb_tx, gb_rx) = RingBuffer::<Box<[f32]>>::new(64);
    let latency_us = Arc::new(AtomicU32::new(0));
    let stop = Arc::new(AtomicBool::new(false));
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(u32, bool), String>>();

    let routing = routing.clone();
    let lat = latency_us.clone();
    let audio = thread::Builder::new()
        .name("house-audio".into())
        .spawn(move || match build(&routing, cmd_rx, st_tx, gb_tx, lat) {
            Ok((streams, sr, cue)) => {
                let _ = ready_tx.send(Ok((sr, cue)));
                let _ = stop_rx.recv();
                drop(streams);
            }
            Err(e) => {
                let _ = ready_tx.send(Err(e));
            }
        })
        .map_err(err)?;

    let (sample_rate, cue) = ready_rx.recv().map_err(err)??;

    // Status thread: forwards the latest snapshot to the interface at ~60 Hz
    // and frees sample buffers the engine gave back. Not the audio thread:
    // locks and allocation are fine here.
    let stop2 = stop.clone();
    let status = thread::Builder::new()
        .name("house-status".into())
        .spawn(move || status_loop(st_rx, gb_rx, status_out, stop2))
        .map_err(err)?;

    Ok(Running {
        cmd: cmd_tx,
        sample_rate,
        cue,
        latency_us,
        stop,
        stop_tx,
        threads: vec![audio, status],
    })
}

fn status_loop(
    mut st: Consumer<[f32; STATUS_LEN]>,
    mut gb: Consumer<Box<[f32]>>,
    out: Arc<Mutex<Option<Channel<Vec<f32>>>>>,
    stop: Arc<AtomicBool>,
) {
    while !stop.load(Ordering::Relaxed) {
        thread::sleep(Duration::from_millis(16));
        let mut latest: Option<[f32; STATUS_LEN]> = None;
        while let Ok(s) = st.pop() {
            latest = Some(s);
        }
        while gb.pop().is_ok() {}
        if let Some(s) = latest {
            if let Ok(guard) = out.lock() {
                if let Some(ch) = guard.as_ref() {
                    let _ = ch.send(s.to_vec());
                }
            }
        }
    }
}

type Streams = Vec<cpal::Stream>;

fn build(
    routing: &Routing,
    cmd_rx: Consumer<Msg>,
    st_tx: Producer<[f32; STATUS_LEN]>,
    gb_tx: Producer<Box<[f32]>>,
    latency: Arc<AtomicU32>,
) -> Result<(Streams, u32, bool), String> {
    let host = cpal::default_host();
    let master = find_output(&host, routing.master.as_deref())?;
    let supported = master.default_output_config().map_err(err)?;
    let sr = supported.sample_rate();
    let mut config: StreamConfig = supported.config();
    config.buffer_size = buffer_for(supported.buffer_size());

    // The cue device, if it is a different one.
    let cue_dev = routing
        .cue
        .as_deref()
        .and_then(|id| find_output(&host, Some(id)).ok())
        .filter(|d| *d != master);
    let (cue_tx, cue_rx) = match cue_dev {
        Some(_) => {
            // One second of stereo audio: plenty for drift and alignment.
            let (p, c) = RingBuffer::<f32>::new(sr as usize * 2);
            (Some(p), Some(c))
        }
        None => (None, None),
    };

    let engine = Box::new(Engine::new(sr as f32));
    let parts = MasterParts {
        engine,
        cmd_rx,
        st_tx,
        gb_tx,
        cue: cue_tx,
        latency,
        channels: config.channels as usize,
    };
    let master_stream = match supported.sample_format() {
        SampleFormat::F32 => master_stream::<f32>(&master, config, parts),
        SampleFormat::F64 => master_stream::<f64>(&master, config, parts),
        SampleFormat::I16 => master_stream::<i16>(&master, config, parts),
        SampleFormat::I32 => master_stream::<i32>(&master, config, parts),
        SampleFormat::U16 => master_stream::<u16>(&master, config, parts),
        other => Err(format!(
            "Tu salida usa un formato de audio que HOUSE todavía no maneja ({other})."
        )),
    }?;
    let mut streams = vec![master_stream];

    if let (Some(dev), Some(rx)) = (cue_dev, cue_rx) {
        let sup = dev.default_output_config().map_err(err)?;
        let mut cfg: StreamConfig = sup.config();
        cfg.buffer_size = buffer_for(sup.buffer_size());
        let cue = CueReader::new(
            rx,
            sr as f64,
            cfg.sample_rate as f64,
            routing.align_ms,
            cfg.channels as usize,
        );
        let s = match sup.sample_format() {
            SampleFormat::F32 => cue_stream::<f32>(&dev, cfg, cue),
            SampleFormat::F64 => cue_stream::<f64>(&dev, cfg, cue),
            SampleFormat::I16 => cue_stream::<i16>(&dev, cfg, cue),
            SampleFormat::I32 => cue_stream::<i32>(&dev, cfg, cue),
            SampleFormat::U16 => cue_stream::<u16>(&dev, cfg, cue),
            other => Err(format!(
                "Tus audífonos usan un formato de audio que HOUSE todavía no maneja ({other})."
            )),
        }?;
        streams.push(s);
    }
    for s in &streams {
        s.play().map_err(err)?;
    }
    let cue = streams.len() > 1;
    Ok((streams, sr, cue))
}

struct MasterParts {
    engine: Box<Engine>,
    cmd_rx: Consumer<Msg>,
    st_tx: Producer<[f32; STATUS_LEN]>,
    gb_tx: Producer<Box<[f32]>>,
    cue: Option<Producer<f32>>,
    latency: Arc<AtomicU32>,
    channels: usize,
}

fn master_stream<T>(
    dev: &cpal::Device,
    config: StreamConfig,
    parts: MasterParts,
) -> Result<cpal::Stream, String>
where
    T: SizedSample + FromSample<f32>,
{
    let MasterParts {
        mut engine,
        mut cmd_rx,
        mut st_tx,
        mut gb_tx,
        mut cue,
        latency,
        channels,
    } = parts;
    let status_every = (config.sample_rate as f32 / STATUS_RATE) as usize;
    let mut since_status = 0usize;
    let data_cb = move |data: &mut [T], info: &cpal::OutputCallbackInfo| {
        let ts = info.timestamp();
        if let Some(d) = ts.playback.checked_duration_since(ts.callback) {
            latency.store(d.as_micros() as u32, Ordering::Relaxed);
        }
        while let Ok(m) = cmd_rx.pop() {
            match m {
                Msg::Cmd(c) => engine.apply(c),
                Msg::Sample { slot, data, sr } => {
                    if let Some(old) = engine.load_sample(slot, data, sr) {
                        // Freed later by the status thread; if its queue is full the
                        // buffer is leaked rather than freed here.
                        if let Err(rtrb::PushError::Full(b)) = gb_tx.push(old) {
                            std::mem::forget(b);
                        }
                    }
                }
            }
        }
        for chunk in data.chunks_mut(MAX_BLOCK * channels) {
            let frames = chunk.len() / channels;
            engine.process(frames);
            for i in 0..frames {
                let base = i * channels;
                chunk[base] = T::from_sample(engine.out_l[i]);
                if channels > 1 {
                    chunk[base + 1] = T::from_sample(engine.out_r[i]);
                }
            }
            if let Some(p) = cue.as_mut() {
                if p.slots() >= frames * 2 {
                    for i in 0..frames {
                        let _ = p.push(engine.out_cue_l[i]);
                        let _ = p.push(engine.out_cue_r[i]);
                    }
                }
            }
            since_status += frames;
        }
        if since_status >= status_every && st_tx.push(engine.status).is_ok() {
            engine.ack_status();
            since_status = 0;
        }
    };
    let stream = dev
        .build_output_stream::<T, _, _>(config, data_cb, |_e| {}, Some(Duration::from_secs(3)))
        .map_err(err)?;
    Ok(stream)
}

/// Reads the cue queue on the headphones' clock, resampling to follow drift.
struct CueReader {
    rx: Consumer<f32>,
    frac: f64,
    prev: [f32; 2],
    next: [f32; 2],
    /// Input frames per output frame when both clocks are exact.
    base: f64,
    integ: f64,
    fill: f64,
    target: f64,
    primed: bool,
    channels: usize,
}

impl CueReader {
    fn new(rx: Consumer<f32>, sr_in: f64, sr_out: f64, align_ms: f32, channels: usize) -> Self {
        // About 40 ms of safety plus the alignment the person asked for.
        let target = sr_in * (0.04 + align_ms.clamp(0.0, 400.0) as f64 / 1000.0);
        CueReader {
            rx,
            frac: 0.0,
            prev: [0.0; 2],
            next: [0.0; 2],
            base: sr_in / sr_out,
            integ: 0.0,
            fill: target,
            target,
            primed: false,
            channels,
        }
    }

    #[inline]
    fn pull(&mut self) {
        self.prev = self.next;
        if self.rx.slots() >= 2 {
            let l = self.rx.pop().unwrap_or(0.0);
            let r = self.rx.pop().unwrap_or(0.0);
            self.next = [l, r];
        }
    }

    fn render<T: SizedSample + FromSample<f32>>(&mut self, data: &mut [T]) {
        let available = self.rx.slots() as f64 / 2.0;
        if !self.primed {
            if available < self.target {
                return; // silence until the queue holds the target delay
            }
            self.primed = true;
        }
        // PI controller on the queue level (smoothed): corrects at most ±0.5 %.
        self.fill += (available - self.fill) * 0.05;
        let e = (self.fill - self.target) / self.target.max(1.0);
        self.integ = (self.integ + e * 0.0004).clamp(-0.004, 0.004);
        let ratio = self.base * (1.0 + (e * 0.002 + self.integ).clamp(-0.005, 0.005));
        for frame in data.chunks_mut(self.channels) {
            self.frac += ratio;
            while self.frac >= 1.0 {
                self.frac -= 1.0;
                self.pull();
            }
            let t = self.frac as f32;
            let l = self.prev[0] + (self.next[0] - self.prev[0]) * t;
            let r = self.prev[1] + (self.next[1] - self.prev[1]) * t;
            frame[0] = T::from_sample(l);
            if self.channels > 1 {
                frame[1] = T::from_sample(r);
            }
        }
    }
}

fn cue_stream<T>(
    dev: &cpal::Device,
    config: StreamConfig,
    mut cue: CueReader,
) -> Result<cpal::Stream, String>
where
    T: SizedSample + FromSample<f32>,
{
    let stream = dev
        .build_output_stream::<T, _, _>(
            config,
            move |data: &mut [T], _| cue.render(data),
            |_e| {},
            Some(Duration::from_secs(3)),
        )
        .map_err(err)?;
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The cue reader follows a producer whose clock runs 0.1 % fast
    /// without the queue running dry or overflowing.
    #[test]
    fn cue_follows_clock_drift() {
        let sr = 48_000.0;
        let (mut tx, rx) = RingBuffer::<f32>::new(96_000);
        let mut cue = CueReader::new(rx, sr, sr, 0.0, 2);
        let mut out = vec![0.0f32; 512];
        let mut phase = 0.0f64;
        let mut produced = 0.0f64;
        let mut min_fill = f64::MAX;
        let mut max_fill = 0.0f64;
        for block in 0..20_000 {
            // Producer: 256 frames per block, 0.1 % faster than the consumer.
            produced += 256.0 * 1.001;
            while produced >= 1.0 {
                produced -= 1.0;
                let x = (phase * std::f64::consts::TAU).sin() as f32 * 0.5;
                phase += 440.0 / sr;
                let _ = tx.push(x);
                let _ = tx.push(x);
            }
            cue.render(&mut out);
            if block > 2_000 {
                let fill = cue.rx.slots() as f64 / 2.0;
                min_fill = min_fill.min(fill);
                max_fill = max_fill.max(fill);
            }
        }
        assert!(min_fill > 200.0, "the queue ran low: {min_fill}");
        assert!(max_fill < 20_000.0, "the queue kept growing: {max_fill}");
    }

    /// Phase 0 spike 2: thirty minutes with the headphones' clock 200 ppm off
    /// (both ways), different block sizes, no dropouts and no clicks.
    #[test]
    fn thirty_minutes_without_clicks() {
        for drift in [1.0002f64, 0.9998] {
            let sr = 48_000.0;
            let (mut tx, rx) = RingBuffer::<f32>::new(96_000);
            let mut cue = CueReader::new(rx, sr, sr, 0.0, 2);
            let mut out = vec![0.0f32; 441 * 2];
            let (mut phase, mut produced, mut consumed) = (0.0f64, 0.0f64, 0.0f64);
            let mut last = 0.0f32;
            let mut worst_jump = 0.0f32;
            let mut min_fill = f64::MAX;
            let minutes = 30.0;
            let total = sr * 60.0 * minutes;
            while consumed < total {
                // Producer: 256-frame blocks on the master clock.
                while produced < consumed * drift + 4_000.0 {
                    for _ in 0..256 {
                        let x = (phase * std::f64::consts::TAU).sin() as f32 * 0.5;
                        phase = (phase + 440.0 / sr).fract();
                        let _ = tx.push(x);
                        let _ = tx.push(x);
                    }
                    produced += 256.0;
                }
                // Consumer: 441-frame blocks on the headphones' clock.
                cue.render(&mut out);
                consumed += 441.0;
                if consumed > sr * 2.0 {
                    for f in out.chunks(2) {
                        worst_jump = worst_jump.max((f[0] - last).abs());
                        last = f[0];
                    }
                    min_fill = min_fill.min(cue.rx.slots() as f64 / 2.0);
                } else if let Some(f) = out.chunks(2).last() {
                    last = f[0];
                }
            }
            // A 440 Hz sine at 0.5 moves at most 0.029 per sample at 48 kHz.
            assert!(
                worst_jump < 0.035,
                "click with drift {drift}: jump {worst_jump}"
            );
            assert!(
                min_fill > 100.0,
                "dropout with drift {drift}: queue at {min_fill}"
            );
        }
    }
}
