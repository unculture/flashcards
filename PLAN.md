# Flashcards: plan

Status: planning, agreed 15 October 2026. No code has been written yet.

## Who it is for

The app is for an 11-year-old who is dyslexic. She reads reasonably well, but her writing and spelling are poor. She needs to make her own flashcards and practise with them for an exam. The cards hold only text for now.

This is meant to be a long-term app. She will use it throughout her school years, and we will keep developing it.

The main goals:

- She makes cards by voice. Typing is never required.
- Making a card takes the least possible effort.
- Practice is fun and never stressful. She is clever, but timed tasks upset her, for example timed times-tables.

## Platform

- Windows desktop first. Her laptop is a Lenovo Yoga with a 12th-gen Intel i5, 16 GB of RAM, a touchscreen, and a tablet mode. The app must work fully by touch.
- A Mac version is not needed now, but the choices below keep it possible.
- An iPhone version may come later. A deck file format lets cards move between devices (see [Storage and the deck file](#storage-and-the-deck-file)).

## Technology

| Part | Choice | Reason |
|---|---|---|
| App framework | Tauri 2, with a web front end (HTML, CSS, JavaScript) and a Rust back end | Small installer (about 10 MB plus the models), low memory use, builds for Mac and Windows, and can build for iOS later |
| Speech to text | sherpa-onnx running NVIDIA Parakeet 0.6B on the CPU, on the laptop | Same model family as Patter. Works offline after the model download. |
| Read aloud | Windows built-in voices, through the browser speech API in WebView2 | Offline and free |
| AI cleanup and marking | OpenRouter with a low-cost model, like Patter | The user provides the key |
| Windows installer | Built by GitHub Actions on a Windows runner | Building for Windows from a Mac is awkward. The installer is unsigned, so Windows shows "Windows protected your PC" one time on install. |

The fallback framework is Electron. It has a more mature sherpa-onnx package, but it is larger and uses more memory. Use it only if the voice test goes badly with Tauri.

Repository: https://github.com/unculture/flashcards (push over SSH).

### Setup on the Mac

- Install Rust with the official rustup installer. The user asked us to do this.
- Install Node 22 with nvm, and add an `.nvmrc` file to the repository. The current default, Node 18, is too old for Tauri. Tauri needs Node 20 or later.
- The `gh` CLI token has expired. Run `gh auth login` before checking GitHub Actions runs from the terminal.

## Speech models

Two models, chosen the same way as in Patter. Each one downloads the first time it is used, about 600 MB each.

| Model | Use |
|---|---|
| Parakeet English | Default. Most accurate for English. |
| Parakeet Multilingual (25 European languages) | French decks |

The model is a setting of each deck, not one setting for the whole app. Most decks use English, and a French deck uses Multilingual. She does not have to choose each time.

Risk: the multilingual model detects the language itself, and you cannot set the language. On single French words it can choose the wrong language. If the voice test shows that it does, test Whisper through sherpa-onnx as the fallback. Whisper accepts a fixed language but is slower.

## Live transcription

The words show on the screen while she speaks. Then the final transcript and the cleanup correct the words in place, so that she can see the corrections.

Approach A (preferred): transcribe the audio again about every half second while she speaks, and update the screen. Card text is short, a few seconds and seldom more than 15, so each pass is small. After a pause, keep the finished part and do not transcribe it again. The live text and the final text come from the same model, so usually only the last word or two changes.

Approach B (fallback, only if A is too slow on her laptop): a small streaming model shows the live text, and Parakeet transcribes the full recording at the end. The live text is less accurate, so more words change at the end.

### Show corrections calmly

- Words that are not final yet show in a softer grey. Final words show in solid colour, so the changes happen in the grey part.
- When the final pass or the cleanup changes a word, the word gets a soft highlight that fades after a second or two. There is no flashing and no strike-through.
- The text box keeps its size and position while the text changes.
- A level meter shows that the app hears her before the first words show.

## AI cleanup

The user prefers a cleanup like Patter's to informal spoken text on the screen, even if the cleanup sometimes rewords the text slightly. The cleanup:

- removes filler words and false starts, and applies self-corrections
- fixes punctuation, capital letters, and words that the model heard wrong, for example a French word heard as English
- may lightly reword the text, so that the card reads as written text, not speech

The cleanup must never change facts: dates, numbers, names, technical terms, or French words and their spelling. The answer side of each card is the reference for marking, so a changed fact there teaches the wrong thing.

- The card saves at once with the raw transcript, and she can continue. The cleaned text replaces it in place when it arrives, with the same soft highlight.
- Keep the raw transcript next to the cleaned text, so that a "What I said" control can show it and restore it.
- If the cleanup fails or is slow, keep the raw transcript. Patter does the same.
- Reuse Patter's prompt and its output checks as the starting point, and adapt them for card text.

## Touch and tablet mode

- In tablet mode, Windows shows the on-screen keyboard when a text field gets focus. So the transcript never goes into a normal text field. It shows as large plain text, and tapping the microphone never opens the keyboard.
- A separate Type button opens the keyboard, only when she wants to fix a word by hand.
- The microphone button works by tap to start and tap to stop. When the keyboard is attached, holding the space bar also records (push to talk).
- Large touch targets, with wide spacing.
- Practice may use swipe gestures to move between cards.

## Features

### Decks

- Create, rename, and delete decks.
- A view of all decks shows each deck's progress at a glance.
- Each deck has a speech model setting (English or Multilingual).

### Make cards quickly

This screen matters most.

1. She opens a deck and taps New cards.
2. She taps the microphone and says the question. The text shows as she speaks and is then read back to her.
3. The screen moves to the answer side at once. She taps and speaks again.
4. The card saves itself, and the next empty card is ready.

One tap records a side again. There is no Save button and no dialog, so she can make cards in a steady rhythm.

Edit and delete cards later from the deck view.

### Practice

Leitner boxes: each card is in one of five boxes. A correct answer moves the card up one box. A "not yet" answer moves it back to box 1. Cards in the lower boxes come up more often. A "Revise everything" mode shows all the cards in the days before the exam.

Rules that keep practice free of stress:

- No timers, anywhere.
- Say "not yet", not "wrong". No red crosses, and no score counts against her.
- Short sessions with a clear end, for example 10 cards and then "Done for today". She can continue if she wants to.
- Show progress as cards that climb the boxes. The goal is to collect cards in the top box, not to avoid mistakes.
- She can skip a card or show the answer at any time, with no penalty.
- No streaks. A missed day never counts against her.
- If she is interested, the app can explain how the boxes work.

### Answer by voice and marking

She says her answer, and the text shows as she speaks, as when she makes cards. Marking is an experiment: try it and see how it feels.

1. Exact and almost exact matches are marked on the laptop, with no AI call. This is faster and costs nothing.
2. For other answers, a low-cost OpenRouter model compares her answer with the card's answer. Answers can be a word, a date, or a sentence. The model allows for transcription errors and for different words with the same meaning, and it can see when an answer is partly correct.
3. The feedback is gentle, for example "Yes!" or "Nearly: you have X, and the answer also has Y". It never says only "wrong".
4. An "I was right" button always overrules the mark, with no argument and no penalty.
5. A setting turns AI marking off. She then marks herself with two large buttons. With no internet, she also marks herself.

Cost: probably a fraction of a cent for each answer. Set a spend limit on the OpenRouter key, because the key is stored on her laptop. Store the key in Windows Credential Manager.

### Print

Two A4 layouts, printed through the web view's print function with CSS that sets the A4 page size:

- Fold cards (most reliable): one side of the paper. The question and the answer are next to each other, with a dashed fold line and dashed cut lines. The front and back do not need to line up.
- Double-sided: 8 cards on each sheet, each A7 (74 × 105 mm). Page 1 has the questions, and page 2 has the answers in mirrored positions, so that each answer prints behind its question with a long-edge flip. Duplex printers often move the back by 1 to 3 mm, so keep the text well inside the cut lines. Include a one-time alignment test page for the printer.

The text shrinks to fit each card and uses the same readable font as the app.

### Read aloud

A speaker button on each card side, when she makes cards and when she practises.

## Design for dyslexia

- A clear, well-spaced font, large text, and generous line spacing.
- An off-white background, not pure white.
- Few words on the screen. Use icons and a small number of large buttons.
- She can check all text by listening, so she never has to proofread her own spelling.

## Storage and the deck file

- Store the data on the laptop, in the app data folder.
- Every deck and card has a stable ID from the start, so that sync is possible later.
- Export and import a deck as a simple JSON file. This file is the exchange format for a future iPhone version. Design it now. Moving decks between devices can come later.
- Each card keeps its raw transcript and its cleaned text.

## Order of work

1. Voice test: a minimal Tauri app that records, shows live text, and shows the final text. Build a Windows installer with GitHub Actions and run it on her laptop. Measure:
   - how long the first words take to show, and how often the live text updates
   - accuracy for English, with her voice and her microphone
   - accuracy for French with the multilingual model, especially single words
   - whether tapping the microphone in tablet mode keeps the keyboard closed
2. Decks and the quick card screen, with live text and cleanup.
3. Practice with Leitner boxes, voice answers, and AI marking.
4. Printing.
5. A finished Windows installer from GitHub Actions.

## Progress

As of 15 October 2026 (evening):

- The user chose the Tauri app over a quick web page for tonight.
- Rust 1.99 is installed with rustup on the Mac, and Node 22 with nvm. The repository has an `.nvmrc` file, so run `nvm use` in the repository folder.
- The repository holds the Tauri 2, Vue 3, and TypeScript scaffold, renamed to Flashcards. `src/App.vue` is a placeholder.
- `src-tauri/Cargo.toml` lists the planned dependencies: `sherpa-onnx` 1.13.8, `cpal`, `ureq`, `bzip2`, `tar`, and `keyring`. Nothing has been built yet, not even `cargo check`.

Findings about sherpa-onnx:

- The official `sherpa-onnx` crate (1.13.8) supports Tauri. With `default-features = false`, it downloads prebuilt static libraries at build time. On Windows these are the `win-x64-static-MT-Release` libraries. The sherpa-onnx project builds its own Tauri demos on Windows with no extra Rust flags. If the Windows link fails with a C runtime mismatch, add `-C target-feature=+crt-static`.
- Reference example: `tauri-examples/non-streaming-speech-recognition-from-microphone` in https://github.com/k2-fsa/sherpa-onnx. It shows cpal capture and the recognizer setup.
- Model downloads, from https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models:
  - English: `sherpa-onnx-nemo-parakeet-unified-en-0.6b-int8-non-streaming.tar.bz2` (501 MB). This is the same model as Patter's English model. Streaming versions of this model also exist (240 ms, 560 ms, 1120 ms chunks), which can be an option for live text.
  - Multilingual: `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2` (487 MB).
  - Configuration for both: `OfflineTransducerModelConfig` with `encoder.int8.onnx`, `decoder.int8.onnx`, and `joiner.int8.onnx`, plus `tokens.txt` and `model_type = "nemo_transducer"`.

### Next steps

1. Rust back end:
   - `cpal` microphone capture on its own thread
   - resampling to 16 kHz with `sherpa_onnx::LinearResampler`
   - a live loop that transcribes the audio again while she speaks and sends `dictation-partial` and level events
   - a final pass on stop
   - model download and unpacking with progress events
   - saving the decks to a JSON file in the app data folder
2. Vue front end: the deck list, the deck view, the quick card screen with a large microphone button, read aloud, and simple practice.
3. A GitHub Actions workflow on `windows-latest` that builds the NSIS installer.
4. After that: AI cleanup, AI marking, and printing.

## Later

- A Mac version.
- An iPhone app, using the deck file.
- She helps with the design, and the project becomes a learning experience for her.
- Pictures on cards.

## Open questions

- Her exams are in the week of 19 October 2026, and she needs to make cards tonight, 15 October. The full app will not be ready by then. A quick web page for tonight was proposed, using the browser's speech recognition with export in the deck file format, but it is not decided.
- Which low-cost OpenRouter model to use for cleanup and for marking. Start with Patter's default, and compare cost and speed.
