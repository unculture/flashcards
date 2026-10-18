import { invoke } from "@tauri-apps/api/core";
import { upgradeDeck } from "./lang";
import { library } from "./library";
import { BOXES, type Card, type Deck, type Lang } from "./types";

// Deck files, for backups and for sharing decks between computers. A file
// holds one or more decks as JSON, progress included. A future iPhone app
// reads the same format, so change it only by adding fields.

const FORMAT = "flashcards-decks";

interface DeckFile {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  decks: Deck[];
}

/** Opens a save dialog and writes the decks. Returns false if it was cancelled. */
export async function saveDecks(decks: Deck[], fileName: string): Promise<boolean> {
  const file: DeckFile = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: JSON.parse(JSON.stringify(decks)),
  };
  return invoke<boolean>("save_deck_file", {
    name: safeFileName(fileName),
    text: JSON.stringify(file, null, 2),
  });
}

/**
 * Opens a deck file and adds its decks to the library. Returns the new decks,
 * or null if the dialog was cancelled. Throws a message she can read.
 */
export async function openDecks(): Promise<Deck[] | null> {
  const text = await invoke<string | null>("open_deck_file");
  if (text === null) return null;
  const decks = parseDeckFile(text);
  const added: Deck[] = [];
  for (const deck of decks) {
    // A deck that is already here comes in as a copy, so nothing is overwritten.
    if (library.decks.some((d) => d.id === deck.id)) {
      deck.id = crypto.randomUUID();
      for (const card of deck.cards) card.id = crypto.randomUUID();
    }
    deck.name = freeName(deck.name);
    library.decks.unshift(deck);
    added.push(library.decks[0]);
  }
  return added;
}

/**
 * Reads a deck file. It also accepts the app's own library.json, so a backup
 * of the whole library can be opened too.
 */
export function parseDeckFile(text: string): Deck[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn't a flashcards file.");
  }
  const rawDecks = isObject(data) && Array.isArray(data.decks) ? data.decks : null;
  if (!rawDecks) throw new Error("That isn't a flashcards file.");
  if (isObject(data) && typeof data.version === "number" && data.version > 1) {
    throw new Error("That file comes from a newer version of Flashcards. Update this app first.");
  }
  const decks = rawDecks.map(readDeck).filter((d): d is Deck => d !== null);
  if (!decks.length) throw new Error("There are no decks in that file.");
  return decks;
}

function readDeck(raw: unknown): Deck | null {
  if (!isObject(raw) || typeof raw.name !== "string") return null;
  const now = new Date().toISOString();
  const cards = (Array.isArray(raw.cards) ? raw.cards : []).map(readCard).filter((c): c is Card => c !== null);
  const languages = Array.isArray(raw.languages) ? [...new Set(raw.languages.map(lang))] : [];
  const deck: Deck = {
    id: text(raw.id) || crypto.randomUUID(),
    name: raw.name.trim() || "Imported deck",
    languages,
    frontLang: lang(raw.frontLang),
    backLang: lang(raw.backLang),
    createdAt: text(raw.createdAt) || now,
    cards,
  };
  // Files from older versions have no languages: work them out as on load.
  upgradeDeck(deck);
  return deck;
}

function readCard(raw: unknown): Card | null {
  if (!isObject(raw) || !isObject(raw.front) || !isObject(raw.back)) return null;
  const front = text(raw.front.text);
  const back = text(raw.back.text);
  if (!front && !back) return null;
  const now = new Date().toISOString();
  const box = Number(raw.box);
  const card: Card = {
    id: text(raw.id) || crypto.randomUUID(),
    front: { text: front },
    back: { text: back },
    box: Number.isInteger(box) && box >= 1 && box <= BOXES ? box : 1,
    createdAt: text(raw.createdAt) || now,
    updatedAt: text(raw.updatedAt) || now,
  };
  if (text(raw.front.heard)) card.front.heard = text(raw.front.heard);
  if (text(raw.back.heard)) card.back.heard = text(raw.back.heard);
  if (raw.front.lang === "en" || raw.front.lang === "fr") card.front.lang = raw.front.lang;
  if (raw.back.lang === "en" || raw.back.lang === "fr") card.back.lang = raw.back.lang;
  if (text(raw.seenAt)) card.seenAt = text(raw.seenAt);
  return card;
}

/** "Science" becomes "Science (2)" when there is already a deck called Science. */
function freeName(name: string): string {
  const taken = new Set(library.decks.map((d) => d.name));
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Flashcards";
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function lang(value: unknown): Lang {
  return value === "fr" ? "fr" : "en";
}
