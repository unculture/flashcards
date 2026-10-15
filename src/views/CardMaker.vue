<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import Icon from "../components/Icon.vue";
import LiveText from "../components/LiveText.vue";
import MicButton from "../components/MicButton.vue";
import ModelBanner from "../components/ModelBanner.vue";
import SpeakButton from "../components/SpeakButton.vue";
import TypeDialog from "../components/TypeDialog.vue";
import { addCard, findDeck, library, modelFor } from "../library";
import { go, useSpaceToTalk } from "../router";
import {
  cancelDictation,
  dictation,
  ensureModel,
  models,
  preloadModel,
  speak,
  startDictation,
  stopDictation,
} from "../speech";
import type { Side } from "../types";

// Making cards: she speaks the question, then the answer, and the card saves
// itself. Tapping the microphone again starts the next card. Tapping a side
// selects it, so she can say it again or type it.

type SideName = "front" | "back";

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

if (props.cardId && deck.value) {
  const card = deck.value.cards.find((c) => c.id === props.cardId);
  if (card) {
    draft.front = { ...card.front };
    draft.back = { ...card.back };
    savedId.value = card.id;
    active.value = null;
  }
}

const langOf = (side: SideName) => (side === "front" ? deck.value!.frontLang : deck.value!.backLang);
const modelOf = (side: SideName) => modelFor(langOf(side));
const neededModels = computed(() =>
  deck.value ? [...new Set([modelOf("front"), modelOf("back")])] : [],
);
const micSide = computed<SideName>(() => active.value ?? "front");
const micReady = computed(() => models[modelOf(micSide.value)].installed);

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
  const side = active.value!;
  notice.value = null;
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
  if (library.settings.readBack) speak(text, langOf(side));
}

/** Puts new text on a side, then moves on: question to answer, answer to save. */
function setSide(side: SideName, value: Side) {
  draft[side] = value;
  if (savedId.value) {
    updateSaved();
    active.value = null;
  } else if (side === "front" && !draft.back.text) {
    active.value = "back";
  } else if (draft.front.text && draft.back.text) {
    const card = addCard(deck.value!, { ...draft.front }, { ...draft.back });
    savedId.value = card.id;
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
  draft.front = { text: "" };
  draft.back = { text: "" };
  savedId.value = null;
  active.value = "front";
}

function selectSide(side: SideName) {
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
  if (text) setSide(side, { ...draft[side], text });
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
      @click="selectSide(side)"
    >
      <div class="side-head">
        <span class="side-label">{{ side === "front" ? "Question" : "Answer" }}</span>
        <SpeakButton :text="draft[side].text" :lang="langOf(side)" size="small" />
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
