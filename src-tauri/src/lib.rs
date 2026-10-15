mod ai;
mod audio;
mod library;
mod speech;

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use sherpa_onnx::OfflineRecognizer;
use tauri::{AppHandle, Emitter, Manager, State};

use audio::Recorder;
use library::Library;
use speech::{ModelId, ModelStatus, SAMPLE_RATE, SpeechEngine, transcribe};

/// Recordings shorter than this are treated as an accidental tap.
const MIN_SAMPLES: usize = SAMPLE_RATE as usize * 3 / 10;
/// Silence added to the end, so the model does not drop the last word.
const TAIL_PADDING: usize = SAMPLE_RATE as usize * 4 / 10;
/// The shortest gap between two live transcriptions.
const LIVE_INTERVAL: Duration = Duration::from_millis(350);

struct Session {
    id: u64,
    recorder: Recorder,
    recognizer: Arc<OfflineRecognizer>,
    live_stop: Arc<AtomicBool>,
    live: JoinHandle<()>,
}

struct AppState {
    speech: Arc<SpeechEngine>,
    library: Library,
    session: Mutex<Option<Session>>,
    next_id: AtomicU64,
}

#[derive(Serialize, Clone)]
struct Partial {
    id: u64,
    text: String,
}

#[tauri::command]
fn model_statuses(state: State<AppState>) -> Vec<ModelStatus> {
    state.speech.statuses()
}

#[tauri::command]
fn download_model(app: AppHandle, state: State<AppState>, model: ModelId) {
    state.speech.start_download(app, model);
}

/// Loads a model into memory ahead of time, so the first tap is quick.
#[tauri::command]
async fn preload_model(state: State<'_, AppState>, model: ModelId) -> Result<(), String> {
    let speech = Arc::clone(&state.speech);
    tauri::async_runtime::spawn_blocking(move || speech.recognizer(model).map(|_| ()))
        .await
        .map_err(|e| e.to_string())?
}

/// Starts recording. While recording, emits `dictation-level` and
/// `dictation-partial` events. Returns the session id.
#[tauri::command]
async fn start_dictation(
    app: AppHandle,
    state: State<'_, AppState>,
    model: ModelId,
) -> Result<u64, String> {
    cancel_session(&state);

    let speech = Arc::clone(&state.speech);
    let recognizer = tauri::async_runtime::spawn_blocking(move || speech.recognizer(model))
        .await
        .map_err(|e| e.to_string())??;

    let level_app = app.clone();
    let recorder = Recorder::start(move |level| {
        let _ = level_app.emit("dictation-level", level);
    })?;

    let id = state.next_id.fetch_add(1, Ordering::SeqCst) + 1;
    let live_stop = Arc::new(AtomicBool::new(false));
    let live = {
        let samples = Arc::clone(&recorder.samples);
        let recognizer = Arc::clone(&recognizer);
        let live_stop = Arc::clone(&live_stop);
        std::thread::spawn(move || {
            run_live(&app, id, &samples, &recognizer, &live_stop);
        })
    };

    *state.session.lock().unwrap() = Some(Session { id, recorder, recognizer, live_stop, live });
    Ok(id)
}

/// Transcribes the growing recording again and again while she speaks. Each
/// pass takes longer than the last, so the gap between passes adapts to the
/// speed of the computer.
fn run_live(
    app: &AppHandle,
    id: u64,
    samples: &Mutex<Vec<f32>>,
    recognizer: &OfflineRecognizer,
    stop: &AtomicBool,
) {
    let mut done_len = 0;
    let mut last_text = String::new();
    while !stop.load(Ordering::SeqCst) {
        let started = Instant::now();
        let snapshot = {
            let samples = samples.lock().unwrap();
            if samples.len() < MIN_SAMPLES || samples.len() == done_len {
                None
            } else {
                Some(samples.clone())
            }
        };
        if let Some(audio) = snapshot {
            done_len = audio.len();
            let text = transcribe(recognizer, &audio);
            if text != last_text && !stop.load(Ordering::SeqCst) {
                let _ = app.emit("dictation-partial", Partial { id, text: text.clone() });
                last_text = text;
            }
        }
        if let Some(rest) = LIVE_INTERVAL.checked_sub(started.elapsed()) {
            std::thread::sleep(rest);
        }
    }
}

/// Stops recording and returns the final transcript of the whole recording.
#[tauri::command]
async fn stop_dictation(state: State<'_, AppState>, id: u64) -> Result<String, String> {
    let session = {
        let mut slot = state.session.lock().unwrap();
        match slot.as_ref() {
            Some(s) if s.id == id => slot.take().unwrap(),
            _ => return Err("This recording has already stopped.".into()),
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        session.live_stop.store(true, Ordering::SeqCst);
        let mut audio = session.recorder.stop();
        let _ = session.live.join();
        if audio.len() < MIN_SAMPLES {
            return Ok(String::new());
        }
        // A real microphone is never perfectly silent. Only zeros means the
        // system blocks the microphone for this app (macOS and Windows both
        // do this when microphone access is off).
        if audio.iter().all(|&s| s == 0.0) {
            return Err("mic-silent".into());
        }
        audio.resize(audio.len() + TAIL_PADDING, 0.0);
        Ok(transcribe(&session.recognizer, &audio))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn cancel_dictation(state: State<AppState>) {
    cancel_session(&state);
}

fn cancel_session(state: &AppState) {
    if let Some(session) = state.session.lock().unwrap().take() {
        session.live_stop.store(true, Ordering::SeqCst);
        drop(session.recorder.stop());
    }
}

#[tauri::command]
fn ai_key_status() -> ai::KeyStatus {
    ai::key_status()
}

#[tauri::command]
async fn ai_set_key(key: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || ai::set_key(&key))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn ai_clear_key() -> Result<(), String> {
    ai::clear_key()
}

#[tauri::command]
async fn ai_cleanup(request: ai::CleanupRequest) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || ai::cleanup(&request))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ai_mark(request: ai::MarkRequest) -> Result<ai::Mark, String> {
    tauri::async_runtime::spawn_blocking(move || ai::mark(&request))
        .await
        .map_err(|e| e.to_string())?
}

/// Returns a WAV file of the text read aloud, as raw bytes.
#[tauri::command]
async fn ai_speak(app: AppHandle, request: ai::SpeakRequest) -> Result<tauri::ipc::Response, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("speech");
    let wav = tauri::async_runtime::spawn_blocking(move || ai::speak(&request, &cache))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(wav))
}

#[tauri::command]
fn load_library(state: State<AppState>) -> Result<Option<Value>, String> {
    state.library.load()
}

#[tauri::command]
fn save_library(state: State<AppState>, library: Value) -> Result<(), String> {
    state.library.save(&library)
}

/// Developer command: `flashcards --transcribe <model dir> <wav>`. Prints the
/// load time, the time for a full transcription, and the times for growing
/// prefixes of the audio, which is what live transcription does.
pub fn dev_transcribe(model_dir: &str, wav_path: &str) {
    let started = Instant::now();
    let recognizer = speech::load_recognizer(std::path::Path::new(model_dir)).expect("load model");
    println!("load: {:?}", started.elapsed());
    let wave = sherpa_onnx::Wave::read(wav_path).expect("read wav");
    assert_eq!(wave.sample_rate(), SAMPLE_RATE, "the wav must be 16 kHz");
    let samples = wave.samples();
    println!("audio: {:.1} s", samples.len() as f32 / SAMPLE_RATE as f32);
    for seconds in [1usize, 2, 4, 8, 16] {
        let n = (seconds * SAMPLE_RATE as usize).min(samples.len());
        let started = Instant::now();
        let text = transcribe(&recognizer, &samples[..n]);
        println!("first {:>4.1} s -> {:?}: {text}", n as f32 / SAMPLE_RATE as f32, started.elapsed());
        if n == samples.len() {
            break;
        }
    }
}

/// Developer command: `flashcards --mic-test`. Records 3 seconds from the
/// default microphone and prints the level. All zeros means that the system
/// gives the app silence, which usually means that microphone access is off.
pub fn dev_mic_test() {
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    match host.default_input_device() {
        Some(device) => {
            println!("device: {}", device.name().unwrap_or_default());
            match device.default_input_config() {
                Ok(config) => println!("config: {config:?}"),
                Err(err) => println!("config error: {err}"),
            }
        }
        None => println!("no input device"),
    }
    let started = Instant::now();
    let recorder = match Recorder::start(|_| {}) {
        Ok(recorder) => recorder,
        Err(err) => {
            println!("start failed after {:?}: {err}", started.elapsed());
            return;
        }
    };
    println!("started in {:?}, recording 3 s…", started.elapsed());
    std::thread::sleep(Duration::from_secs(3));
    let samples = recorder.stop();
    let peak = samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len().max(1) as f32).sqrt();
    println!("samples: {} (16 kHz), peak: {peak:.4}, rms: {rms:.5}", samples.len());
    if peak == 0.0 {
        println!("SILENT: the system gave only zeros. Check microphone access in System Settings.");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            // Models are large, so on Windows they go in Local, not Roaming.
            let models_dir = app.path().app_local_data_dir()?.join("models");
            app.manage(AppState {
                speech: Arc::new(SpeechEngine::new(models_dir)),
                library: Library::new(&data_dir),
                session: Mutex::new(None),
                next_id: AtomicU64::new(0),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            model_statuses,
            download_model,
            preload_model,
            start_dictation,
            stop_dictation,
            cancel_dictation,
            load_library,
            save_library,
            ai_key_status,
            ai_set_key,
            ai_clear_key,
            ai_cleanup,
            ai_mark,
            ai_speak,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
