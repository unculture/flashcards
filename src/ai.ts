import { computed, reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { library } from "./library";
import type { Lang } from "./types";

/** Model choices, as in Patter. Prices from openrouter.ai on 1 October 2026. */
export const AI_MODELS = [
  { id: "openai/gpt-5.6-luna", title: "GPT-5.6 Luna", detail: "Fast and low cost." },
  { id: "anthropic/claude-haiku-4.5", title: "Claude Haiku 4.5", detail: "Careful with meaning. About 4 times the cost." },
  { id: "openai/gpt-oss-120b", title: "gpt-oss-120b", detail: "Very fast and lowest cost." },
];

export const ai = reactive({
  /** Where the OpenRouter key comes from. */
  keySource: "none" as "stored" | "environment" | "none",
});

export const hasKey = computed(() => ai.keySource !== "none");

export async function refreshKey() {
  const status = await invoke<{ source: typeof ai.keySource }>("ai_key_status");
  ai.keySource = status.source;
}

export async function saveKey(key: string) {
  await invoke("ai_set_key", { key });
  await refreshKey();
}

export async function clearKey() {
  await invoke("ai_clear_key");
  await refreshKey();
}

export interface CleanupArgs {
  text: string;
  side: "question" | "answer";
  /** The side's language, or null in a mixed deck, where the AI decides. */
  lang: Lang | null;
  deckName: string;
  /** The other side of the card, if it has text yet. */
  other?: string;
}

export interface Cleaned {
  text: string;
  /** The side's language, when the AI decided it. */
  lang: Lang | null;
}

/** Returns the cleaned text, or null when cleanup is off, has no key, or fails. */
export async function cleanupText(args: CleanupArgs): Promise<Cleaned | null> {
  if (!library.settings.cleanup || !hasKey.value) return null;
  try {
    return await invoke<Cleaned>("ai_cleanup", { request: { ...args, model: library.settings.aiModel } });
  } catch (err) {
    console.warn("cleanup failed:", err);
    return null;
  }
}

export interface Mark {
  verdict: "right" | "nearly" | "not_yet";
  feedback: string;
}

export interface MarkArgs {
  question: string;
  answer: string;
  spoken: string;
  lang: Lang;
  deckName: string;
}

/** Returns the AI's mark, or null when marking is off, has no key, or fails. */
export async function markAnswer(args: MarkArgs): Promise<Mark | null> {
  if (!library.settings.marking || !hasKey.value) return null;
  try {
    return await invoke<Mark>("ai_mark", { request: { ...args, model: library.settings.aiModel } });
  } catch (err) {
    console.warn("marking failed:", err);
    return null;
  }
}

/**
 * True when the spoken answer matches the card's answer, ignoring case,
 * accents, punctuation, and a leading article. Matches need no AI call.
 */
export function sameAnswer(answer: string, spoken: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .replace(/^\s*(?:(?:the|a|an|le|la|les|un|une|des)\s+|l')/, "")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(answer);
  return a.length > 0 && a === norm(spoken);
}
