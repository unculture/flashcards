<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import Icon from "../components/Icon.vue";
import LangTag from "../components/LangTag.vue";
import LiveText from "../components/LiveText.vue";
import MicButton from "../components/MicButton.vue";
import ModelBanner from "../components/ModelBanner.vue";
import SpeakButton from "../components/SpeakButton.vue";
import TypeDialog from "../components/TypeDialog.vue";
import { cleanupText } from "../ai";
import { deckModel, guessLang, isMixed, otherLang, sideLang, type SideName } from "../lang";
import { addCard, findDeck } from "../library";
import { go, useSpaceToTalk } from "../router";
import {
  cancelDictation,
  dictation,
  ensureModel,
  models,
  preloadModel,
  restartDictation,
  startDictation,
  stopDictation,
} from "../speech";
import type { Lang, Side } from "../types";

// Making cards: she speaks the question, then the answer, and the card saves
// itself. Tapping the microphone again starts the next card. While she
// speaks, tapping the answer moves on to it, and tapping the same side starts
// it again. Otherwise tapping a side selects it, to say it again or type it.
//
// In a deck with more than one language, each side shows its language. The
// app guesses it, the AI tidy-up corrects the guess, and she can tap it.

const props = defineProps<{ deckId: string; cardId?: string }>();
const deck = computed(() => findDeck(props.deckId));
const editing = !!props.cardId;

const draft = reactive<Record<SideName, Side>>({
  front: { text: "" },
  back: { text: "" },
});
/** The saved card that the draft shows, if any. */
const savedId = ref<string | null>(null);
/** The side that the microphone and the Type button change. Null when the card is complete. */
const active = ref<SideName | null>("front");
/** The side being recorded. */
const recordingSide = ref<SideName | null>(null);
const typing = ref<SideName | null>(null);
const notice = ref<string | null>(null);
const madeCount = ref(0);
/** Identifies the card being made, so a late cleanup finds the right card. */
const draftId = ref(crypto.randomUUID());
/** The saved card for each draft. */
const cardForDraft = new Map<string, string>();
/** Sides waiting for the AI cleanup, as "draftId:side". */
const tidying = reactive(new Set<string>());
const isTidying = (side: SideName) => tidying.has(`${draftId.value}:${side}`);
/** Sides whose language she chose by tapping, as "draftId:side". Guesses leave them alone. */
const pinned = reactive(new Set<string>());
const isPinned = (side: SideName) => pinned.has(`${draftId.value}:${side}`);

if (props.cardId && deck.value) {
  const card = deck.value.cards.find((c) => c.id === props.cardId);
  if (card) {
    draft.front = { ...card.front };
    draft.back = { ...card.back };
    savedId.value = card.id;
    active.value = null;
  }
}

const mixed = computed(() => !!deck.value && isMixed(deck.value));
const langOf = (side: SideName): Lang => sideLang(deck.value!, draft, side);
// One model hears every side: the multilingual one hears English too.
const modelOf = (_side: SideName) => deckModel(deck.value!);
const neededModels = computed(() => (deck.value ? [deckModel(deck.value)] : []));
const micReady = computed(() => models[modelOf("front")].installed);

/**
 * In a mixed deck, works out the language of new text on a side, unless she
 * chose it by tapping. The AI tidy-up may correct it later.
 */
function withLang(side: SideName, value: Side): Side {
  if (!mixed.value) return value;
  if (isPinned(side)) return { ...value, lang: langOf(side) };
  const other: SideName = side === "front" ? "back" : "front";
  const otherKnown = draft[other].text ? langOf(other) : undefined;
  const fallback = side === "front" ? deck.value!.frontLang : deck.value!.backLang;
  return { ...value, lang: guessLang(value.text, otherKnown, fallback) };
}

function toggleLang(side: SideName) {
  draft[side] = { ...draft[side], lang: otherLang(deck.value!, langOf(side)) };
  pinned.add(`${draftId.value}:${side}`);
  if (savedId.value) updateSaved();
}

onMounted(() => {
  for (const m of neededModels.value) {
    ensureModel(m);
    preloadModel(m);
  }
});
onBeforeUnmount(cancelDictation);

const prompt = computed(() => {
  if (dictation.error) return dictation.error;
  if (notice.value) return notice.value;
  if (editing && active.value === null) return "Tap the question or the answer to change it.";
  if (active.value === null) return "Saved! Tap the microphone for the next card.";
  if (recordingSide.value === "front") return "Say the question, then tap the answer box.";
  return active.value === "front" ? "Say the question." : "Now say the answer.";
});

async function pressMic() {
  if (typing.value) return;
  if (dictation.state === "recording") {
    await finishRecording();
    return;
  }
  if (dictation.state !== "idle") return;
  if (active.value === null) {
    if (editing) return;
    startNewCard();
  }
  notice.value = null;
  await record(active.value!);
}

async function record(side: SideName) {
  recordingSide.value = side;
  if (!(await startDictation(modelOf(side)))) recordingSide.value = null;
}

async function finishRecording() {
  const side = recordingSide.value;
  if (!side) return;
  const text = await stopDictation();
  recordingSide.value = null;
  if (!text) {
    notice.value = "I didn't hear anything. Tap the microphone and try again.";
    return;
  }
  setSide(side, { text, heard: text });
  tidyUp(side, text);
}

/**
 * Sends a side to the AI cleanup. The card is already saved with the raw
 * text, so she can carry on. The cleaned text replaces it when it arrives,
 * unless the side changed in the meantime.
 */
async function tidyUp(side: SideName, raw: string) {
  const token = draftId.value;
  const key = `${token}:${side}`;
  tidying.add(key);
  const other = draft[side === "front" ? "back" : "front"].text;
  const cleaned = await cleanupText({
    text: raw,
    side: side === "front" ? "question" : "answer",
    // In a mixed deck the AI decides, unless she chose the language herself.
    lang: mixed.value && !pinned.has(key) ? null : langOf(side),
    deckName: deck.value!.name,
    other: other || undefined,
  });
  tidying.delete(key);
  if (!cleaned) return;
  const tidied = (current: Side): Side => ({
    text: cleaned.text,
    heard: raw,
    ...(mixed.value ? { lang: pinned.has(key) ? current.lang : (cleaned.lang ?? current.lang) } : {}),
  });

  if (draftId.value === token) {
    if (draft[side].text !== raw) return;
    draft[side] = tidied(draft[side]);
    if (savedId.value) updateSaved();
    return;
  }
  const card = deck.value?.cards.find((c) => c.id === cardForDraft.get(token));
  if (card && card[side].text === raw) {
    card[side] = tidied(card[side]);
    card.updatedAt = new Date().toISOString();
  }
}

/** Puts back exactly what the speech model heard, before the cleanup. */
function useWhatIHeard(side: SideName) {
  const heard = draft[side].heard;
  if (!heard) return;
  draft[side] = { ...draft[side], text: heard, heard };
  if (savedId.value) updateSaved();
}

/** Puts new text on a side, then moves on: question to answer, answer to save. */
function setSide(side: SideName, value: Side) {
  draft[side] = withLang(side, value);
  if (savedId.value) {
    updateSaved();
    active.value = null;
  } else if (side === "front" && !draft.back.text) {
    active.value = "back";
  } else if (draft.front.text && draft.back.text) {
    const card = addCard(deck.value!, { ...draft.front }, { ...draft.back });
    savedId.value = card.id;
    cardForDraft.set(draftId.value, card.id);
    madeCount.value++;
    active.value = null;
  } else {
    active.value = draft.front.text ? "back" : "front";
  }
}

function updateSaved() {
  const card = deck.value!.cards.find((c) => c.id === savedId.value);
  if (!card) return;
  card.front = { ...draft.front };
  card.back = { ...draft.back };
  card.updatedAt = new Date().toISOString();
}

function startNewCard() {
  draftId.value = crypto.randomUUID();
  draft.front = { text: "" };
  draft.back = { text: "" };
  savedId.value = null;
  active.value = "front";
}

/**
 * Tapping a side. While she speaks, tapping the same side starts it again,
 * and tapping the other side keeps what she said and listens for the other.
 * Otherwise it selects the side, so she can say it again or type it.
 */
async function tapSide(side: SideName) {
  if (typing.value) return;
  if (dictation.state === "recording" && recordingSide.value) {
    notice.value = null;
    if (side === recordingSide.value) {
      if (!(await restartDictation(modelOf(side)))) recordingSide.value = null;
      return;
    }
    await finishRecording();
    if (notice.value) return; // Nothing was heard, so stay on this side.
    active.value = side;
    await record(side);
    return;
  }
  if (dictation.state !== "idle") return;
  notice.value = null;
  active.value = side;
}

function openTyping() {
  if (dictation.state !== "idle") return;
  typing.value = active.value ?? "front";
}

function typed(text: string) {
  const side = typing.value!;
  typing.value = null;
  if (text) setSide(side, { text });
}

function shownText(side: SideName) {
  return recordingSide.value === side ? dictation.partial : draft[side].text;
}

useSpaceToTalk(pressMic);
</script>

<template>
  <section v-if="deck" class="maker">
    <header class="top">
      <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'deck', deckId: deck.id })">
        <Icon name="back" />
      </button>
      <h1>{{ deck.name }}</h1>
      <span v-if="!editing" class="count">{{ deck.cards.length }} cards</span>
    </header>

    <ModelBanner v-for="m in neededModels" :key="m" :model="m" />

    <div
      v-for="side in (['front', 'back'] as const)"
      :key="side"
      class="side"
      :class="{ active: active === side, recording: recordingSide === side }"
      role="button"
      @click="tapSide(side)"
    >
      <div class="side-head">
        <span class="side-label">{{ side === "front" ? "Question" : "Answer" }}</span>
        <LangTag v-if="mixed" :lang="langOf(side)" tappable @toggle="toggleLang(side)" />
        <span class="spacer" />
        <span v-if="isTidying(side)" class="tidying">Tidying up…</span>
        <button
          v-else-if="draft[side].heard && draft[side].heard !== draft[side].text && recordingSide !== side"
          type="button"
          class="heard"
          @mousedown.prevent
          @click.stop="useWhatIHeard(side)"
        >
          Use what I said
        </button>
        <SpeakButton
          v-if="recordingSide !== side"
          :text="draft[side].text"
          :lang="langOf(side)"
          size="small"
        />
      </div>
      <LiveText
        :text="shownText(side)"
        :live="recordingSide === side"
        :placeholder="recordingSide === side ? 'Listening…' : ''"
      />
    </div>

    <p class="prompt" :class="{ warn: !!dictation.error }">{{ prompt }}</p>

    <div class="controls">
      <button type="button" class="button side-action" :disabled="dictation.state !== 'idle'" @click="openTyping">
        <Icon name="keyboard" /> Type
      </button>
      <MicButton :active="true" :disabled="!micReady || (editing && active === null)" @press="pressMic" />
      <button
        v-if="!editing"
        type="button"
        class="button side-action"
        :disabled="dictation.state !== 'idle'"
        @click="go({ name: 'deck', deckId: deck.id })"
      >
        <Icon name="check" /> Finished
      </button>
      <button v-else type="button" class="button side-action" @click="go({ name: 'deck', deckId: deck.id })">
        <Icon name="check" /> Done
      </button>
    </div>
    <p v-if="madeCount" class="made">{{ madeCount }} new {{ madeCount === 1 ? "card" : "cards" }} this time</p>

    <TypeDialog
      v-if="typing"
      :title="typing === 'front' ? 'Type the question' : 'Type the answer'"
      :text="draft[typing].text"
      @done="typed"
      @cancel="typing = null"
    />
  </section>
</template>

<style scoped>
.maker {
  max-width: 860px;
  margin: 0 auto;
}
.side {
  background: var(--surface);
  border: 3px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 22px 18px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: border-color 150ms ease;
}
.side.active {
  border-color: var(--accent);
}
.side.recording {
  border-color: var(--record);
}
.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  min-height: 44px;
}
.spacer {
  flex: 1;
}
.tidying {
  color: var(--muted);
  font-size: 0.95rem;
}
.heard {
  font: inherit;
  font-size: 0.95rem;
  color: var(--accent);
  background: none;
  border: none;
  padding: 8px 0 8px 12px;
  min-height: 44px;
  cursor: pointer;
  touch-action: manipulation;
}
.side-label {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
.prompt {
  text-align: center;
  font-size: 1.3rem;
  min-height: 1.6em;
  margin: 8px 0 18px;
}
.prompt.warn {
  color: var(--warn);
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 24px;
}
.controls .side-action:first-child {
  justify-self: end;
}
.controls .side-action:last-child {
  justify-self: start;
}
.side-action {
  margin-top: 28px;
}
.made {
  text-align: center;
  color: var(--muted);
  margin-top: 18px;
}
</style>
