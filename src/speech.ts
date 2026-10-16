import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ModelId } from "./types";
import { stopSpeaking } from "./voice";

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
    dictation.error = "Speech-to-text is still getting ready. Try again in a moment.";
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

/**
 * Throws away the current recording and starts listening again. The back end
 * ends the old recording when the new one starts, so this sends no cancel,
 * which could otherwise arrive after the start and end the new recording.
 */
export async function restartDictation(model: ModelId): Promise<boolean> {
  sessionId = null;
  dictation.state = "idle";
  dictation.partial = "";
  return startDictation(model);
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
    return "Speech-to-text is still getting ready. Try again in a moment.";
  }
  if (message.includes("mic-silent")) {
    return navigator.userAgent.includes("Mac")
      ? "The microphone is switched off for Flashcards. Turn it on in System Settings › Privacy & Security › Microphone."
      : "The microphone is switched off. Open Settings › Privacy & security › Microphone, and turn on microphone access for desktop apps.";
  }
  return message;
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
}
