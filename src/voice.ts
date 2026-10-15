import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { hasKey } from "./ai";
import { library } from "./library";
import type { Lang } from "./types";

// Read-aloud with an OpenRouter audio model. The back end caches each
// result on disk, so a card's audio is paid for only once.

export const VOICE_MODELS = [
  { id: "openai/gpt-audio-mini", title: "GPT Audio Mini", detail: "Low cost." },
  { id: "openai/gpt-audio", title: "GPT Audio", detail: "Higher quality. About 25 times the cost." },
];

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];

export const voice = reactive({
  /** The text being fetched or played, so its button can show that. */
  loading: null as string | null,
  playing: null as string | null,
  error: null as string | null,
});

let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
/** Increases with each request, so a slow answer cannot play over a newer one. */
let request = 0;

export function canSpeak(): boolean {
  return library.settings.readAloud && hasKey.value;
}

export async function speak(text: string, lang: Lang) {
  stopSpeaking();
  if (!text.trim() || !canSpeak()) return;
  const mine = ++request;
  voice.loading = text;
  voice.error = null;
  try {
    const wav = await invoke<ArrayBuffer>("ai_speak", {
      request: { text, lang, voice: library.settings.voice, model: library.settings.voiceModel },
    });
    if (mine !== request) return;
    audioUrl = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    audio = new Audio(audioUrl);
    audio.onended = () => {
      if (mine === request) stopSpeaking();
    };
    voice.playing = text;
    await audio.play();
  } catch (err) {
    if (mine === request) {
      voice.error = String(err);
      console.warn("read aloud failed:", err);
    }
  } finally {
    if (mine === request) voice.loading = null;
  }
}

export function stopSpeaking() {
  request++;
  audio?.pause();
  audio = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  voice.loading = null;
  voice.playing = null;
}
