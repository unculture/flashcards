/** A speech model in the back end. */
export type ModelId = "english" | "multilingual";

/** The language of one side of a card. It picks the speech model. */
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
  /** Tidy up spoken card text with AI. */
  cleanup: boolean;
  /** Check spoken answers in practice with AI. */
  marking: boolean;
  /** The OpenRouter model for cleanup and marking. */
  aiModel: string;
  /** Show read-aloud buttons. Needs the OpenRouter key. */
  readAloud: boolean;
  /** The OpenRouter audio model and its voice. */
  voiceModel: string;
  voice: string;
  /** Play a chime for "Got it" and a soft sound for "Not yet" in practice. */
  sounds: boolean;
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
