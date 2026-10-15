import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Lang, ModelId } from "./types";

// ---------------------------------------------------------------------------
// Speech models
// ---------------------------------------------------------------------------

interface ModelState {
  label: string;
  downloadMb: number;
  installed: boolean;
  downloading: boolean;
  /** Download progress, 0 to 1. */
  progress: number;
  error: string | null;
}

interface ModelStatus {
  id: ModelId;
  label: string;
  download_mb: number;
  installed: boolean;
  downloading: boolean;
}

const blankModel = (): ModelState => ({
  label: "",
  downloadMb: 0,
  installed: false,
  downloading: false,
  progress: 0,
  error: null,
});

export const models = reactive<Record<ModelId, ModelState>>({
  english: blankModel(),
  multilingual: blankModel(),
});

export async function refreshModels() {
  const statuses = await invoke<ModelStatus[]>("model_statuses");
  for (const s of statuses) {
    const m = models[s.id];
    m.label = s.label;
    m.downloadMb = s.download_mb;
    m.installed = s.installed;
    m.downloading = s.downloading;
  }
}

/** Starts the download of a model if it is not installed. */
export async function ensureModel(id: ModelId) {
  const m = models[id];
  if (m.installed || m.downloading) return;
  m.error = null;
  m.progress = 0;
  m.downloading = true;
  await invoke("download_model", { model: id });
}

export function preloadModel(id: ModelId) {
  if (models[id].installed) invoke("preload_model", { model: id }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Dictation
// ---------------------------------------------------------------------------

export type DictationState = "idle" | "starting" | "recording" | "finishing";

export const dictation = reactive({
  state: "idle" as DictationState,
  /** Microphone level, 0 to 1. */
  level: 0,
  /** The live transcript while she speaks. */
  partial: "",
  error: null as string | null,
});

let sessionId: number | null = null;

export async function startDictation(model: ModelId): Promise<boolean> {
  if (dictation.state !== "idle") return false;
  stopSpeaking();
  dictation.error = null;
  dictation.partial = "";
  if (!models[model].installed) {
    dictation.error = "The voice is still getting ready. Try again in a moment.";
    ensureModel(model);
    return false;
  }
  dictation.state = "starting";
  try {
    sessionId = await invoke<number>("start_dictation", { model });
    dictation.state = "recording";
    return true;
  } catch (err) {
    dictation.state = "idle";
    dictation.error = friendlyError(String(err));
    return false;
  }
}

/** Stops recording. Returns the final transcript, or "" if nothing was heard. */
export async function stopDictation(): Promise<string> {
  if (dictation.state !== "recording" || sessionId === null) return "";
  const id = sessionId;
  dictation.state = "finishing";
  try {
    return await invoke<string>("stop_dictation", { id });
  } catch (err) {
    dictation.error = friendlyError(String(err));
    return "";
  } finally {
    sessionId = null;
    dictation.state = "idle";
    dictation.level = 0;
  }
}

export function cancelDictation() {
  sessionId = null;
  dictation.state = "idle";
  dictation.level = 0;
  dictation.partial = "";
  invoke("cancel_dictation").catch(() => {});
}

function friendlyError(message: string): string {
  if (message.includes("model-not-installed")) {
    return "The voice is still getting ready. Try again in a moment.";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Read aloud
// ---------------------------------------------------------------------------

const VOICE_LANG: Record<Lang, string> = { en: "en-GB", fr: "fr-FR" };

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  const wanted = VOICE_LANG[lang].toLowerCase();
  const prefix = wanted.slice(0, 2);
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === wanted) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

export function speak(text: string, lang: Lang) {
  if (!text.trim() || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG[lang];
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------

export async function initSpeech() {
  await listen<number>("dictation-level", (e) => {
    if (dictation.state === "recording") dictation.level = e.payload;
  });
  await listen<{ id: number; text: string }>("dictation-partial", (e) => {
    if (e.payload.id === sessionId && dictation.state === "recording") {
      dictation.partial = e.payload.text;
    }
  });
  await listen<{ model: ModelId; downloaded: number; total: number }>("model-progress", (e) => {
    const m = models[e.payload.model];
    m.downloading = true;
    m.progress = Math.min(1, e.payload.downloaded / e.payload.total);
  });
  await listen<{ model: ModelId }>("model-installed", async (e) => {
    await refreshModels();
    preloadModel(e.payload.model);
  });
  await listen<{ model: ModelId; message: string }>("model-error", (e) => {
    const m = models[e.payload.model];
    m.downloading = false;
    m.error = e.payload.message;
  });
  await refreshModels();
  // Voices load in the background in some web views.
  if ("speechSynthesis" in window) speechSynthesis.getVoices();
}
