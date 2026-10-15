# Flashcards

Flashcards is a desktop app for making and practising flashcards by voice. It is for a dyslexic student, so she never has to type or spell. She taps the microphone, says the question, then says the answer, and the card saves itself. Speech turns into text on the computer, with the NVIDIA Parakeet model through [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). No audio leaves the computer.

The plan and the progress are in [PLAN.md](PLAN.md).

## Install on Windows

1. Open the [Windows installer workflow](https://github.com/unculture/flashcards/actions/workflows/windows.yml) and click the newest run that has a green tick. You must be signed in to GitHub.
2. Under Artifacts, download **Flashcards-Windows-installer**. It is a zip file.
3. Open the zip file and run `Flashcards_0.1.0_x64-setup.exe`.
4. Windows shows "Windows protected your PC", because the installer is not signed. Click **More info**, then **Run anyway**.
5. Open Flashcards. On the first launch, it downloads the English voice, about 500 MB. Dictation works when the download finishes.

If the microphone does not work, open Settings > Privacy & security > Microphone, and turn on "Let desktop apps access your microphone".

## Use Flashcards

- **New deck**: tap New deck, say the name, and choose the language of the answers. A French deck downloads the multilingual voice, also about 500 MB.
- **Make cards**: tap the microphone and say the question. Tap it again to stop. Then do the same for the answer. The card saves itself, and the next tap starts the next card. To say a side again, tap that side and then the microphone. To type instead, tap Type.
- **Practise**: each session has up to 10 cards. She says her answer or taps Show answer, then taps Got it or Not yet. Got it moves the card up a box, and Not yet moves it back to box 1. Cards in higher boxes come up less often. There are no timers and no scores.
- **Space bar**: when a keyboard is attached, the space bar works like the microphone button. Press it to start and again to stop, or hold it down while you talk.

## Where the data is

On Windows:

- Decks and cards: `%APPDATA%\com.unculture.flashcards\library.json`. The previous version is kept as `library.backup.json`.
- Speech models: `%LOCALAPPDATA%\com.unculture.flashcards\models\`

On a Mac, both are in `~/Library/Application Support/com.unculture.flashcards/`.

## Development

You need Rust (rustup), Node 22 (run `nvm use` in this folder), and on a Mac, Xcode.

```sh
npm install
npm run tauri dev
```

The first build downloads the prebuilt sherpa-onnx libraries. Pushes to `main` build the Windows installer with GitHub Actions.

To measure transcription speed with a model folder and a 16 kHz WAV file:

```sh
cd src-tauri
cargo build --release
./target/release/flashcards --transcribe <model folder> <file.wav>
```

The model folders come from the [sherpa-onnx asr-models release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models).
