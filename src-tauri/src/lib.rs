//! HOUSE desktop app: the web interface in a native window, with the audio
//! engine running natively (cpal) instead of in an AudioWorklet.

mod audio;

use std::sync::{Arc, Mutex};

use audio::{Msg, OutputDevice, Routing, Running, StartInfo};
use tauri::ipc::{Channel, InvokeBody, Request};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct AudioState {
    running: Mutex<Option<Running>>,
    routing: Mutex<Routing>,
    status_out: Arc<Mutex<Option<Channel<Vec<f32>>>>>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

/// Starts the engine (once) and connects the status stream of this window.
#[tauri::command]
fn engine_start(
    state: State<'_, AudioState>,
    on_status: Channel<Vec<f32>>,
) -> Result<StartInfo, String> {
    *lock(&state.status_out) = Some(on_status);
    let mut running = lock(&state.running);
    if running.is_none() {
        let routing = lock(&state.routing).clone();
        *running = Some(audio::start(&routing, state.status_out.clone())?);
    }
    Ok(running.as_ref().map(|r| r.info()).expect("engine started"))
}

/// Engine commands, in the same numeric format the WebAssembly build uses.
#[tauri::command]
fn engine_cmds(state: State<'_, AudioState>, cmds: Vec<Vec<f64>>) -> Result<(), String> {
    let mut running = lock(&state.running);
    let r = running.as_mut().ok_or("El audio todavía no arranca.")?;
    for c in cmds {
        if let Some(cmd) = house_engine::decode(&c) {
            r.send(Msg::Cmd(cmd))?;
        }
    }
    Ok(())
}

fn header<T: std::str::FromStr>(req: &Request<'_>, name: &str) -> Result<T, String> {
    req.headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| format!("Falta el encabezado {name}"))
}

/// A recorded or imported sound: raw little-endian f32 samples.
#[tauri::command]
fn engine_load_sample(state: State<'_, AudioState>, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Se esperaba audio en bytes.".into());
    };
    let slot: usize = header(&request, "slot")?;
    let sr: f32 = header(&request, "sample-rate")?;
    let (words, _) = bytes.as_chunks::<4>();
    let data: Box<[f32]> = words.iter().map(|w| f32::from_le_bytes(*w)).collect();
    let mut running = lock(&state.running);
    let r = running.as_mut().ok_or("El audio todavía no arranca.")?;
    r.send(Msg::Sample { slot, data, sr })
}

#[tauri::command]
fn audio_outputs() -> Vec<OutputDevice> {
    audio::outputs()
}

/// Moves the master and the cue to other devices. The engine restarts, so the
/// interface sends the project again.
#[tauri::command]
fn audio_set_routing(state: State<'_, AudioState>, routing: Routing) -> Result<StartInfo, String> {
    *lock(&state.routing) = routing.clone();
    let mut running = lock(&state.running);
    // Stop the old streams before opening the devices again.
    running.take();
    let r = audio::start(&routing, state.status_out.clone())?;
    let info = r.info();
    *running = Some(r);
    Ok(info)
}

/// Saves a file the interface made (WAV, .house) where the person chooses.
#[tauri::command]
async fn save_file(app: AppHandle, request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Se esperaba el archivo en bytes.".into());
    };
    let name: String = header::<String>(&request, "file-name").map(|n| percent_decode(&n))?;
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(&name)
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = path
        .into_path()
        .map_err(|e| format!("No pude usar esa carpeta: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("No pude guardar el archivo: {e}"))?;
    Ok(true)
}

/// Decodes the `encodeURIComponent` file name sent in a header.
fn percent_decode(s: &str) -> String {
    let hex = |c: u8| (c as char).to_digit(16).map(|d| d as u8);
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AudioState::default())
        .invoke_handler(tauri::generate_handler![
            engine_start,
            engine_cmds,
            engine_load_sample,
            audio_outputs,
            audio_set_routing,
            save_file
        ])
        .run(tauri::generate_context!())
        .expect("no pude abrir HOUSE");
}

#[cfg(test)]
mod tests {
    #[test]
    fn decodes_file_names() {
        assert_eq!(
            super::percent_decode("madrugada%20en%20la%20azotea.wav"),
            "madrugada en la azotea.wav"
        );
        assert_eq!(super::percent_decode("canci%C3%B3n.wav"), "canción.wav");
        assert_eq!(super::percent_decode("50%"), "50%");
    }
}
