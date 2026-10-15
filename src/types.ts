/** A speech model in the back end. */
export type ModelId = "english" | "multilingual";

/** The language of one side of a card. It picks the speech model and the voice. */
export type Lang = "en" | "fr";

export interface Side {
  text: string;
  /** What the speech model heard, before any cleanup or typing. */
  heard?: string;
}

export interface Card {
  id: string;
  front: Side;
  back: Side;
  /** Leitner box, 1 to 5. New cards start in box 1. */
  box: number;
  createdAt: string;
  updatedAt: string;
  /** When she last practised the card. */
  seenAt?: string;
}

export interface Deck {
  id: string;
  name: string;
  frontLang: Lang;
  backLang: Lang;
  createdAt: string;
  cards: Card[];
}

export interface Settings {
  /** Read each side aloud after she speaks it. */
  readBack: boolean;
}

/**
 * The whole library. This is also the exchange format for a future iPhone
 * version, so change it only by adding fields, and bump `version` for
 * anything else.
 */
export interface Library {
  version: 1;
  decks: Deck[];
  settings: Settings;
}

export const BOXES = 5;
