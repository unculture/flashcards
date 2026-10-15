import { reactive, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { BOXES, type Card, type Deck, type Lang, type Library, type ModelId } from "./types";

export const library = reactive<Library>({
  version: 1,
  decks: [],
  settings: { cleanup: true, marking: true, aiModel: "openai/gpt-5.6-luna" },
});

export const loaded = ref(false);
export const saveError = ref<string | null>(null);

export async function loadLibrary() {
  const stored = await invoke<Library | null>("load_library");
  if (stored) {
    library.decks = stored.decks ?? [];
    library.settings = { ...library.settings, ...stored.settings };
  }
  loaded.value = true;

  let timer: number | undefined;
  watch(
    library,
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(save, 300);
    },
    { deep: true },
  );
}

async function save() {
  try {
    await invoke("save_library", { library });
    saveError.value = null;
  } catch (err) {
    saveError.value = String(err);
  }
}

const now = () => new Date().toISOString();

export function modelFor(lang: Lang): ModelId {
  return lang === "en" ? "english" : "multilingual";
}

export function createDeck(name: string, backLang: Lang): Deck {
  const deck: Deck = {
    id: crypto.randomUUID(),
    name,
    frontLang: "en",
    backLang,
    createdAt: now(),
    cards: [],
  };
  library.decks.unshift(deck);
  return library.decks[0];
}

export function findDeck(id: string): Deck | undefined {
  return library.decks.find((d) => d.id === id);
}

export function deleteDeck(id: string) {
  const i = library.decks.findIndex((d) => d.id === id);
  if (i >= 0) library.decks.splice(i, 1);
}

export function addCard(deck: Deck, front: { text: string; heard?: string }, back: { text: string; heard?: string }): Card {
  const card: Card = {
    id: crypto.randomUUID(),
    front,
    back,
    box: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  deck.cards.push(card);
  return card;
}

export function deleteCard(deck: Deck, id: string) {
  const i = deck.cards.findIndex((c) => c.id === id);
  if (i >= 0) deck.cards.splice(i, 1);
}

/** Days to wait before a card in each box comes up again. */
const WAIT_DAYS = [0, 1, 2, 4, 7];

export function isDue(card: Card, at = Date.now()): boolean {
  if (!card.seenAt) return true;
  const wait = WAIT_DAYS[card.box - 1] * 24 * 60 * 60 * 1000;
  // Count in whole days, so a card from yesterday evening is due this morning.
  const seen = new Date(card.seenAt);
  seen.setHours(0, 0, 0, 0);
  return seen.getTime() + wait <= at;
}

/**
 * Picks the cards for one session: due cards first, lowest box first. With
 * `everything`, any card can come up, still lowest box first.
 */
export function pickSession(deck: Deck, size: number, everything: boolean): Card[] {
  const pool = everything ? [...deck.cards] : deck.cards.filter((c) => isDue(c));
  shuffle(pool);
  pool.sort((a, b) => a.box - b.box);
  return pool.slice(0, size);
}

export function markCard(card: Card, gotIt: boolean) {
  card.box = gotIt ? Math.min(card.box + 1, BOXES) : 1;
  card.seenAt = now();
}

export function boxCounts(deck: Deck): number[] {
  const counts = new Array(BOXES).fill(0);
  for (const card of deck.cards) counts[card.box - 1]++;
  return counts;
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
