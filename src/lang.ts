import type { Card, Deck, Lang, ModelId } from "./types";

// Languages in decks. A deck has one or more languages. In a deck with more
// than one, each side of a card stores its own, so French can be on either
// side. The AI tidy-up decides a side's language when it can; without it, a
// simple guess from the words does.

export type SideName = "front" | "back";

export const LANG_NAMES: Record<Lang, string> = { en: "English", fr: "French" };

export function isMixed(deck: Deck): boolean {
  return deck.languages.length > 1;
}

/** The speech model for the deck. Any French needs the multilingual one, which hears both. */
export function deckModel(deck: Deck): ModelId {
  return deck.languages.some((l) => l !== "en") ? "multilingual" : "english";
}

/** The language of one side of a card, or of a card being made. */
export function sideLang(deck: Deck, card: Pick<Card, "front" | "back">, side: SideName): Lang {
  if (!isMixed(deck)) return deck.languages[0] ?? "en";
  return card[side].lang ?? (side === "front" ? deck.frontLang : deck.backLang);
}

/** The deck's other language, for switching a side between the two. */
export function otherLang(deck: Deck, lang: Lang): Lang {
  return deck.languages.find((l) => l !== lang) ?? lang;
}

/**
 * Fills in the fields that older versions of the app did not have. Older
 * decks had an English front and an answer language, so a French deck
 * becomes "English and French" with English questions and French answers.
 */
export function upgradeDeck(deck: Deck) {
  if (!Array.isArray(deck.languages) || !deck.languages.length) {
    deck.languages = deck.frontLang === "fr" || deck.backLang === "fr" ? ["en", "fr"] : ["en"];
  }
  if (!isMixed(deck)) return;
  for (const card of deck.cards) {
    card.front.lang ??= deck.frontLang;
    card.back.lang ??= deck.backLang;
  }
}

const FRENCH_WORDS = new Set(
  (
    "je tu il elle on nous vous ils elles le la les un une des du au aux de et est sont ai as a avons avez ont " +
    "suis es sommes êtes être avoir aimer aime aimes aimons aimez aiment ne pas mon ma mes ton ta tes son sa ses " +
    "notre nos votre vos leur leurs ce cette ces qui que quoi où comment pourquoi quand avec pour dans sur sous " +
    "très oui non merci bonjour au revoir chez fait faire aller va vais"
  ).split(" "),
);

const ENGLISH_WORDS = new Set(
  (
    "i you he she it we they the a an is are am was were be have has had do does did of to in on at for with " +
    "and or but not what how why when where who which this that these those my your his her our their like " +
    "love say said mean means word translate english french"
  ).split(" "),
);

/**
 * Guesses whether a side is English or French from its words. When the
 * words don't say, it picks the opposite of the other side, because most
 * cards in a mixed deck are translations.
 */
export function guessLang(text: string, other: Lang | undefined, fallback: Lang): Lang {
  const lower = text.toLowerCase().replace(/’/g, "'");
  let fr = 0;
  let en = 0;
  if (/[àâçéèêëîïôûùüÿœæ]/.test(lower)) fr += 2;
  // Elision, as in j'ai, l'eau, c'est, qu'il.
  if (/(^|[^a-z])(j|l|m|t|s|d|n|c|qu)'[a-zàâéèêîôûœ]/.test(lower)) fr += 2;
  for (const word of lower.split(/[^a-zàâçéèêëîïôûùüÿœæ']+/)) {
    if (!word) continue;
    if (FRENCH_WORDS.has(word)) fr++;
    if (ENGLISH_WORDS.has(word)) en++;
  }
  // English contractions such as don't and it's.
  if (/[a-z]'(t|s|re|ve|ll|d|m)\b/.test(lower) && !/(^|[^a-z])(j|l|m|t|s|d|n|c|qu)'/.test(lower)) en++;
  if (fr > en) return "fr";
  if (en > fr) return "en";
  if (other) return other === "fr" ? "en" : "fr";
  return fallback;
}
