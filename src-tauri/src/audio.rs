//! Microphone capture with cpal.
//!
//! A cpal stream is not `Send` on every platform, so a dedicated thread owns
//! it. The audio callback sends mono chunks to that thread, which resamples
//! them to 16 kHz, appends them to the shared buffer, and reports the level.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, SizedSample};
use sherpa_onnx::LinearResampler;

use crate::speech::SAMPLE_RATE;

pub struct Recorder {
    pub samples: Arc<Mutex<Vec<f32>>>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Recorder {
    /// Opens the default microphone. Returns after the stream has started, or
    /// with an error if it cannot start. `on_level` gets a level from 0 to 1
    /// about 15 times a second.
    pub fn start(on_level: impl Fn(f32) + Send + 'static) -> Result<Self, String> {
        let samples = Arc::new(Mutex::new(Vec::with_capacity(SAMPLE_RATE as usize * 30)));
        let stop = Arc::new(AtomicBool::new(false));
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        let thread = {
            let samples = Arc::clone(&samples);
            let stop = Arc::clone(&stop);
            std::thread::spawn(move || {
                if let Err(err) = run_capture(&samples, &stop, &ready_tx, on_level) {
                    let _ = ready_tx.send(Err(err));
                }
            })
        };

        match ready_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(())) => Ok(Self { samples, stop, thread: Some(thread) }),
            Ok(Err(err)) => Err(err),
            Err(_) => {
                stop.store(true, Ordering::SeqCst);
                Err("The microphone did not start.".into())
            }
        }
    }

    /// Stops the stream and waits until the last audio is in `samples`.
    pub fn stop(mut self) -> Vec<f32> {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        std::mem::take(&mut *self.samples.lock().unwrap())
    }
}

impl Drop for Recorder {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

fn run_capture(
    samples: &Arc<Mutex<Vec<f32>>>,
    stop: &AtomicBool,
    ready: &mpsc::Sender<Result<(), String>>,
    on_level: impl Fn(f32),
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No microphone was found.")?;
    let supported = device
        .default_input_config()
        .map_err(|e| format!("The microphone could not be opened: {e}"))?;
    let config = supported.config();
    let input_rate = config.sample_rate.0 as i32;
    let channels = config.channels as usize;

    let (tx, rx) = mpsc::channel::<Vec<f32>>();
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build_stream::<f32>(&device, &config, channels, tx),
        SampleFormat::I16 => build_stream::<i16>(&device, &config, channels, tx),
        SampleFormat::I32 => build_stream::<i32>(&device, &config, channels, tx),
        SampleFormat::U16 => build_stream::<u16>(&device, &config, channels, tx),
        other => Err(format!("The microphone uses an unsupported format: {other:?}")),
    }?;
    stream
        .play()
        .map_err(|e| format!("The microphone could not start: {e}"))?;
    let _ = ready.send(Ok(()));

    let resampler = if input_rate == SAMPLE_RATE {
        None
    } else {
        LinearResampler::create(input_rate, SAMPLE_RATE)
    };
    let mut peak = 0.0f32;
    let mut last_level = Instant::now();

    let append = |chunk: Vec<f32>| {
        let converted = match &resampler {
            Some(r) => r.resample(&chunk, false),
            None => chunk,
        };
        samples.lock().unwrap().extend_from_slice(&converted);
    };

    while !stop.load(Ordering::SeqCst) {
        match rx.recv_timeout(Duration::from_millis(20)) {
            Ok(chunk) => {
                for &s in &chunk {
                    peak = peak.max(s.abs());
                }
                append(chunk);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
        if last_level.elapsed() >= Duration::from_millis(66) {
            // A square root makes quiet speech still move the meter.
            on_level(peak.min(1.0).sqrt());
            peak = 0.0;
            last_level = Instant::now();
        }
    }

    // Dropping the stream drops the callback and its sender, so the drain ends.
    drop(stream);
    while let Ok(chunk) = rx.recv() {
        append(chunk);
    }
    if let Some(r) = &resampler {
        let tail = r.resample(&[], true);
        samples.lock().unwrap().extend_from_slice(&tail);
    }
    Ok(())
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    channels: usize,
    tx: mpsc::Sender<Vec<f32>>,
) -> Result<cpal::Stream, String>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                let mono: Vec<f32> = data
                    .chunks(channels.max(1))
                    .map(|frame| {
                        frame.iter().map(|&s| s.to_sample::<f32>()).sum::<f32>() / frame.len() as f32
                    })
                    .collect();
                let _ = tx.send(mono);
            },
            |err| eprintln!("[audio] stream error: {err}"),
            None,
        )
        .map_err(|e| format!("The microphone could not be opened: {e}"))
}
