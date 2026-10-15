<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BoxBar from "../components/BoxBar.vue";
import Icon from "../components/Icon.vue";
import LiveText from "../components/LiveText.vue";
import MicButton from "../components/MicButton.vue";
import ModelBanner from "../components/ModelBanner.vue";
import { findDeck, markCard, modelFor, pickSession } from "../library";
import { go, useSpaceToTalk } from "../router";
import {
  cancelDictation,
  dictation,
  models,
  preloadModel,
  startDictation,
  stopDictation,
} from "../speech";
import type { Card } from "../types";

// Practice with no timers and no scores. She can say her answer, or just
// look. "Not yet" sends a card back to box 1 without any fuss.

const SESSION_SIZE = 10;

const props = defineProps<{ deckId: string }>();
const deck = computed(() => findDeck(props.deckId));

const cards = ref<Card[]>([]);
const index = ref(0);
const revealed = ref(false);
const spoken = ref("");
const recording = ref(false);
const movedUp = ref(0);
const practised = ref(0);
/** True when no cards were due, before she chooses to practise anyway. */
const nothingDue = ref(false);

const card = computed(() => cards.value[index.value]);
const finished = computed(() => !nothingDue.value && index.value >= cards.value.length);
const answerModel = computed(() => modelFor(deck.value!.backLang));

function startSession(everything: boolean) {
  cards.value = pickSession(deck.value!, SESSION_SIZE, everything);
  nothingDue.value = cards.value.length === 0;
  index.value = 0;
  movedUp.value = 0;
  practised.value = 0;
  showCard();
}

function showCard() {
  revealed.value = false;
  spoken.value = "";
}

onMounted(() => {
  preloadModel(answerModel.value);
  startSession(false);
});
onBeforeUnmount(cancelDictation);

async function pressMic() {
  if (!card.value || revealed.value) return;
  if (dictation.state === "recording") {
    spoken.value = await stopDictation();
    recording.value = false;
    reveal();
  } else if (dictation.state === "idle") {
    recording.value = await startDictation(answerModel.value);
  }
}

function reveal() {
  if (recording.value) {
    cancelDictation();
    recording.value = false;
  }
  revealed.value = true;
}

function mark(gotIt: boolean) {
  const before = card.value!.box;
  markCard(card.value!, gotIt);
  if (card.value!.box > before) movedUp.value++;
  practised.value++;
  next();
}

function next() {
  index.value++;
  showCard();
}

useSpaceToTalk(pressMic);
</script>

<template>
  <section v-if="deck" class="practice">
    <header class="top">
      <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'deck', deckId: deck.id })">
        <Icon name="back" />
      </button>
      <h1>{{ deck.name }}</h1>
      <span v-if="card" class="count">{{ index + 1 }} of {{ cards.length }}</span>
    </header>

    <ModelBanner :model="answerModel" />

    <div v-if="nothingDue" class="end">
      <h2>All caught up!</h2>
      <p>Every card is resting for now. You can still practise them if you like.</p>
      <div class="row center">
        <button type="button" class="button primary big" @click="startSession(true)">Practise anyway</button>
        <button type="button" class="button big" @click="go({ name: 'deck', deckId: deck.id })">Back</button>
      </div>
    </div>

    <div v-else-if="finished" class="end">
      <h2>Done for today!</h2>
      <p>
        You practised {{ practised }} {{ practised === 1 ? "card" : "cards" }}.
        <template v-if="movedUp"> {{ movedUp }} moved up a box.</template>
      </p>
      <BoxBar :deck="deck" large />
      <div class="row center">
        <button type="button" class="button primary big" @click="startSession(true)">Keep going</button>
        <button type="button" class="button big" @click="go({ name: 'deck', deckId: deck.id })">Finish</button>
      </div>
    </div>

    <template v-else-if="card">
      <div class="face question">
        <div class="face-head">
          <span class="side-label">Question</span>
        </div>
        <p class="face-text">{{ card.front.text }}</p>
      </div>

      <template v-if="!revealed">
        <div v-if="recording" class="face mine">
          <span class="side-label">Your answer</span>
          <LiveText :text="dictation.partial" :live="true" placeholder="Listening…" />
        </div>
        <p v-if="dictation.error" class="warn">{{ dictation.error }}</p>
        <div class="controls">
          <button type="button" class="button side-action" @click="next">
            <Icon name="skip" /> Skip
          </button>
          <MicButton :active="true" :disabled="!models[answerModel].installed" @press="pressMic" />
          <button type="button" class="button side-action" @click="reveal">
            <Icon name="eye" /> Show answer
          </button>
        </div>
        <p class="prompt">Say your answer, or just show it.</p>
      </template>

      <template v-else>
        <div v-if="spoken" class="face mine">
          <span class="side-label">You said</span>
          <p class="face-text">{{ spoken }}</p>
        </div>
        <div class="face answer">
          <div class="face-head">
            <span class="side-label">Answer</span>
          </div>
          <p class="face-text">{{ card.back.text }}</p>
        </div>
        <div class="row center marks">
          <button type="button" class="button big notyet" @click="mark(false)">Not yet</button>
          <button type="button" class="button big gotit" @click="mark(true)"><Icon name="check" /> Got it</button>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.practice {
  max-width: 860px;
  margin: 0 auto;
}
.face {
  background: var(--surface);
  border: 3px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 22px 18px;
  margin-bottom: 16px;
}
.face.answer {
  border-color: var(--good-soft);
}
.face.mine {
  border-style: dashed;
}
.face-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.side-label {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
.face-text {
  font-size: var(--card-text);
  line-height: 1.45;
  margin: 6px 0 0;
  overflow-wrap: anywhere;
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: start;
  margin-top: 8px;
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
.prompt {
  text-align: center;
  color: var(--muted);
  margin-top: 16px;
}
.marks {
  margin-top: 8px;
}
.marks .button {
  min-width: 200px;
}
.gotit {
  background: var(--good);
  border-color: var(--good);
  color: white;
}
.notyet {
  background: var(--soft-amber);
  border-color: var(--soft-amber);
}
.end {
  text-align: center;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 28px 24px;
}
.end h2 {
  font-size: 2rem;
  margin: 0 0 8px;
}
.end p {
  font-size: 1.2rem;
}
.end .row {
  margin-top: 24px;
}
.warn {
  color: var(--warn);
  text-align: center;
}
</style>
