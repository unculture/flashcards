# Flashcards

**Website and downloads: https://unculture.github.io/flashcards/**

Flashcards is a desktop app for making and practising flashcards by voice. It is for a dyslexic student, so she never has to type or spell. She taps the microphone, says the question, then says the answer, and the card saves itself. Speech turns into text on the computer, with the NVIDIA Parakeet model through [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). No audio leaves the computer.

The plan and the progress are in [PLAN.md](PLAN.md).

## Install

Download the newest installer from the [releases page](https://github.com/unculture/flashcards/releases/latest). No GitHub account is needed.

On Windows:

1. Download `Flashcards_<version>_x64-setup.exe` and run it.
2. Windows shows "Windows protected your PC", because the installer is not signed. Click **More info**, then **Run anyway**.
3. Open Flashcards. On the first launch, it downloads English speech-to-text, about 500 MB. Dictation works when the download finishes.

On a Mac with Apple silicon, download the `.dmg`, open it, and drag Flashcards to Applications. The app is not notarised, so the first time, open **System Settings › Privacy & Security** and click **Open Anyway**.

Flashcards checks GitHub for a newer release when it starts, and once a day while it is open. When there is one, the home screen shows a banner. Download opens the installer for that computer in the browser, and running it updates the app. Decks and cards are kept. There is no automatic updating.

Each push to `main` also builds a Windows installer for testing. It is under Artifacts in the newest run of the [Windows installer workflow](https://github.com/unculture/flashcards/actions/workflows/windows.yml), which needs a GitHub login.

If the microphone does not work, open Settings > Privacy & security > Microphone, and turn on "Let desktop apps access your microphone". When microphone access is off, Windows gives the app silence, and Flashcards shows a message about it.

## Use Flashcards

- **New deck**: tap New deck, say the name, and choose **English** or **English and French**. In an English and French deck, either side of a card can be in either language. Each side shows EN or FR, which she can tap if the app guessed wrong. These decks download the multilingual voice, also about 500 MB.
- **Describe cards for me** (with an AI key): on a deck, tap "Or describe cards for me", say or type what you want, for example "the present tense of avoir, both ways", and the AI makes a list. Tick the ones to add, tap any side to change it, or ask for changes. Making cards by hand stays the main way, because making them is part of learning.
- **Make cards**: tap the microphone and say the question. Tap it again to stop. Then do the same for the answer. The card saves itself, and the next tap starts the next card. To say a side again, tap that side and then the microphone. To type instead, tap Type.
- **Practise**: each session has up to 10 cards. She says her answer or taps Show answer, then taps Got it or Not yet. Got it moves the card up a box, and Not yet moves it back to box 1. Cards in higher boxes come up less often. There are no timers and no scores.
- **Save and share decks**: on a deck's page, Save to a file writes a `.flashcards` file. On the home screen, Open a deck file adds the decks from a file. Settings › Backup saves every deck, with her progress, in one file. A deck that is already in the app comes in as a copy, so opening a file never overwrites anything.
- **Space bar**: when a keyboard is attached, the space bar works like the microphone button. Press it to start and again to stop, or hold it down while you talk.

## AI help

Flashcards can use an AI model through [OpenRouter](https://openrouter.ai) to:

- tidy up what she says on a card: filler words, punctuation, misheard words, and light rewording. It never changes facts. The card saves with the raw text at once, and the tidied text replaces it a second or two later, with a soft highlight. "Use what I said" puts the raw text back.
- check her spoken answers in practice. An exact match is marked on the computer with no AI call. Other answers get gentle feedback, such as "Nearly!", and a suggested button. She can always choose the other button, for example "I was right".

To set it up:

1. Create a separate key for this app at [openrouter.ai/keys](https://openrouter.ai/keys), with a low monthly spend limit, because the key is stored on her laptop.
2. In Flashcards, open Settings, paste the key under AI help, and click Save. The app checks the key, then stores it in Windows Credential Manager (on a Mac, in the keychain). The key is not in `library.json`.

- read cards aloud with an OpenRouter audio model (GPT Audio Mini by default). Speaker buttons show on cards when a key is saved. A card is read only when she taps its speaker button. In Settings, under Read aloud, you can choose the voice and try it. Each card's audio is fetched once and then kept in the app's cache folder, so reading a card again costs nothing.

The app sends the card text to OpenRouter, never the recorded audio. Without a key or without an internet connection, everything else still works, and she marks her own answers.

For development, the app also reads the key from `OPENROUTER_API_KEY` when no key is stored.

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

To build the Mac app and install it in `/Applications` (it replaces an older copy, then opens the app):

```sh
npm run install:mac
```

The app has an ad-hoc signature, so it runs on the Mac that built it. macOS treats each rebuild as a new app, so the microphone permission can stop working: the app then gets only silence and shows "The microphone is switched off". To make macOS ask again, run `tccutil reset Microphone com.unculture.flashcards`, then tap the microphone and click Allow. macOS may also ask again for keychain access.

To check the microphone from the terminal, with the app's own permission:

```sh
open -n -W --stdout /dev/stdout /Applications/Flashcards.app --args --mic-test
```

The first build downloads the prebuilt sherpa-onnx libraries. Pushes to `main` build the Windows installer with GitHub Actions.

To publish a release, run `scripts/release.sh 0.2.0` with a clean working tree. It sets the version, commits, tags `v0.2.0`, and pushes. GitHub Actions then builds the Windows and Mac installers and publishes them on the releases page.

To try the AI help against the real OpenRouter (it costs a little credit):

```sh
cd src-tauri
OPENROUTER_API_KEY=... cargo test --lib live_openrouter -- --ignored --nocapture
```

The app icon's source and build steps are in [design/](design/README.md).

The website is in `site/`. Pushing a change to it publishes it to the `gh-pages` branch, which GitHub Pages serves at https://unculture.github.io/flashcards/.

To measure transcription speed with a model folder and a 16 kHz WAV file:

```sh
cd src-tauri
cargo build --release
./target/release/flashcards --transcribe <model folder> <file.wav>
```

The model folders come from the [sherpa-onnx asr-models release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models).

## Licence

MIT. See [LICENSE](LICENSE).
