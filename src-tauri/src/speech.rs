//! Speech models: download, load, and transcribe.
//!
//! Models come from the sherpa-onnx `asr-models` release. Each one is a
//! tar.bz2 archive that unpacks to a folder with an int8 Parakeet transducer.

use std::collections::HashSet;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig, OfflineTransducerModelConfig};
use tauri::{AppHandle, Emitter};

pub const SAMPLE_RATE: i32 = 16_000;

/// Marker file written after an archive unpacks completely.
const COMPLETE_MARKER: &str = ".complete";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelId {
    English,
    Multilingual,
}

impl ModelId {
    pub const ALL: [ModelId; 2] = [ModelId::English, ModelId::Multilingual];

    fn label(self) -> &'static str {
        match self {
            ModelId::English => "English",
            ModelId::Multilingual => "Multilingual (French and other languages)",
        }
    }

    fn archive_stem(self) -> &'static str {
        match self {
            ModelId::English => "sherpa-onnx-nemo-parakeet-unified-en-0.6b-int8-non-streaming",
            ModelId::Multilingual => "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
        }
    }

    fn download_mb(self) -> u32 {
        match self {
            ModelId::English => 501,
            ModelId::Multilingual => 487,
        }
    }

    fn url(self) -> String {
        format!(
            "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/{}.tar.bz2",
            self.archive_stem()
        )
    }
}

#[derive(Serialize, Clone)]
pub struct ModelStatus {
    id: ModelId,
    label: &'static str,
    download_mb: u32,
    installed: bool,
    downloading: bool,
}

#[derive(Serialize, Clone)]
struct ModelProgress {
    model: ModelId,
    downloaded: u64,
    total: u64,
}

#[derive(Serialize, Clone)]
struct ModelEvent {
    model: ModelId,
    message: Option<String>,
}

pub struct SpeechEngine {
    models_dir: PathBuf,
    loaded: Mutex<Option<(ModelId, Arc<OfflineRecognizer>)>>,
    downloading: Mutex<HashSet<ModelId>>,
}

impl SpeechEngine {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            models_dir,
            loaded: Mutex::new(None),
            downloading: Mutex::new(HashSet::new()),
        }
    }

    fn model_dir(&self, id: ModelId) -> PathBuf {
        self.models_dir.join(id.archive_stem())
    }

    pub fn is_installed(&self, id: ModelId) -> bool {
        self.model_dir(id).join(COMPLETE_MARKER).is_file()
    }

    pub fn statuses(&self) -> Vec<ModelStatus> {
        let downloading = self.downloading.lock().unwrap();
        ModelId::ALL
            .iter()
            .map(|&id| ModelStatus {
                id,
                label: id.label(),
                download_mb: id.download_mb(),
                installed: self.is_installed(id),
                downloading: downloading.contains(&id),
            })
            .collect()
    }

    /// Starts a download on a background thread. Emits `model-progress`,
    /// then `model-installed` or `model-error`.
    pub fn start_download(self: &Arc<Self>, app: AppHandle, id: ModelId) {
        if self.is_installed(id) || !self.downloading.lock().unwrap().insert(id) {
            return;
        }
        let engine = Arc::clone(self);
        std::thread::spawn(move || {
            let result = engine.download(&app, id);
            engine.downloading.lock().unwrap().remove(&id);
            match result {
                Ok(()) => {
                    let _ = app.emit("model-installed", ModelEvent { model: id, message: None });
                }
                Err(err) => {
                    eprintln!("[speech] download of {id:?} failed: {err}");
                    let _ = app.emit("model-error", ModelEvent { model: id, message: Some(err) });
                }
            }
        });
    }

    /// Streams the archive through the bzip2 decoder and tar unpacker, so the
    /// compressed file never touches the disk.
    fn download(&self, app: &AppHandle, id: ModelId) -> Result<(), String> {
        fs::create_dir_all(&self.models_dir).map_err(|e| e.to_string())?;
        let partial = self.models_dir.join(format!(".partial-{}", id.archive_stem()));
        let _ = fs::remove_dir_all(&partial);

        let response = ureq::get(&id.url())
            .call()
            .map_err(|e| format!("Could not download the speech model: {e}"))?;
        let total = response
            .headers()
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(id.download_mb() as u64 * 1_000_000);

        let reader = ProgressReader {
            inner: response.into_body().into_reader(),
            read: 0,
            total,
            last_emit: Instant::now(),
            app: app.clone(),
            model: id,
        };
        let mut archive = tar::Archive::new(bzip2::read::BzDecoder::new(reader));
        archive
            .unpack(&partial)
            .map_err(|e| format!("The download stopped before it finished: {e}"))?;

        // The archive contains one folder named after the archive.
        let unpacked = partial.join(id.archive_stem());
        let source = if unpacked.is_dir() { unpacked } else { partial.clone() };
        let target = self.model_dir(id);
        let _ = fs::remove_dir_all(&target);
        fs::rename(&source, &target).map_err(|e| e.to_string())?;
        let _ = fs::remove_dir_all(&partial);
        fs::write(target.join(COMPLETE_MARKER), b"").map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Returns the recognizer for `id`, loading it if needed. Only one model
    /// stays in memory at a time.
    pub fn recognizer(&self, id: ModelId) -> Result<Arc<OfflineRecognizer>, String> {
        let mut loaded = self.loaded.lock().unwrap();
        if let Some((loaded_id, recognizer)) = loaded.as_ref() {
            if *loaded_id == id {
                return Ok(Arc::clone(recognizer));
            }
        }
        if !self.is_installed(id) {
            return Err("model-not-installed".into());
        }
        *loaded = None;
        let recognizer = Arc::new(load_recognizer(&self.model_dir(id))?);
        *loaded = Some((id, Arc::clone(&recognizer)));
        Ok(recognizer)
    }
}

pub fn load_recognizer(dir: &Path) -> Result<OfflineRecognizer, String> {
    let path = |name: &str| Some(dir.join(name).to_string_lossy().into_owned());
    let mut config = OfflineRecognizerConfig::default();
    config.model_config.transducer = OfflineTransducerModelConfig {
        encoder: path("encoder.int8.onnx"),
        decoder: path("decoder.int8.onnx"),
        joiner: path("joiner.int8.onnx"),
    };
    config.model_config.tokens = path("tokens.txt");
    config.model_config.model_type = Some("nemo_transducer".into());
    config.model_config.num_threads = num_threads();
    let started = Instant::now();
    let recognizer = OfflineRecognizer::create(&config)
        .ok_or_else(|| "The speech model could not be loaded.".to_string())?;
    eprintln!("[speech] loaded {} in {:?}", dir.display(), started.elapsed());
    Ok(recognizer)
}

/// Uses half the logical cores, at least 2 and at most 4. A 12th-gen i5 has
/// 12 logical cores; more threads than 4 give little gain for short audio.
fn num_threads() -> i32 {
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    (cores / 2).clamp(2, 4) as i32
}

pub fn transcribe(recognizer: &OfflineRecognizer, samples: &[f32]) -> String {
    let stream = recognizer.create_stream();
    stream.accept_waveform(SAMPLE_RATE, samples);
    recognizer.decode(&stream);
    stream
        .get_result()
        .map(|r| r.text.trim().to_string())
        .unwrap_or_default()
}

struct ProgressReader<R> {
    inner: R,
    read: u64,
    total: u64,
    last_emit: Instant,
    app: AppHandle,
    model: ModelId,
}

impl<R: Read> Read for ProgressReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.read += n as u64;
        if self.last_emit.elapsed().as_millis() >= 250 || n == 0 {
            self.last_emit = Instant::now();
            let _ = self.app.emit(
                "model-progress",
                ModelProgress { model: self.model, downloaded: self.read, total: self.total },
            );
        }
        Ok(n)
    }
}
