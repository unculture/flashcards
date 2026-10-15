// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() == 2 && args[1] == "--mic-test" {
        flashcards_lib::dev_mic_test();
        return;
    }
    if args.len() == 4 && args[1] == "--transcribe" {
        flashcards_lib::dev_transcribe(&args[2], &args[3]);
        return;
    }
    flashcards_lib::run()
}
