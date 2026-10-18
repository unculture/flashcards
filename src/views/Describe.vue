<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../components/Icon.vue";
import LangTag from "../components/LangTag.vue";
import LiveText from "../components/LiveText.vue";
import MicButton from "../components/MicButton.vue";
import ModelBanner from "../components/ModelBanner.vue";
import TypeDialog from "../components/TypeDialog.vue";
import { type NewCard, generateCards, sameAnswer } from "../ai";
import { deckModel, isMixed, otherLang, type SideName } from "../lang";
import { addCard, findDeck } from "../library";
import { go, useSpaceToTalk } from "../router";
import { cancelDictation, dictation, ensureModel, models, preloadModel, startDictation, stopDictation } from "../speech";
import type { Lang } from "../types";

// "Describe cards for me": she, or a parent, says what cards they want, the
// AI makes a list, and she chooses which to add. Making cards by hand stays
// the main way, because making them is part of learning.

interface Proposal {
  id: string;
  front: string;
  back: string;
  frontLang: Lang;
  backLang: Lang;
  on: boolean;
  /** Already in the deck. Starts unticked. */
  duplicate: boolean;
}

type Field = "description" | "change";

const props = defineProps<{ deckId: string }>();
const deck = computed(() => findDeck(props.deckId));
const mixed = computed(() => !!deck.value && isMixed(deck.value));
const model = computed(() => deckModel(deck.value!));

const step = ref<"describe" | "review">("describe");
const description = ref("");
const change = ref("");
const proposals = ref<Proposal[]>([]);
const note = ref<string | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);
/** The field being dictated into. */
const recording = ref<Field | null>(null);
/** The field or card side being typed. */
const typing = ref<{ field: Field } | { card: string; side: SideName } | null>(null);

const ticked = computed(() => proposals.value.filter((p) => p.on));

onMounted(() => {
  ensureModel(model.value);
  preloadModel(model.value);
});
onBeforeUnmount(cancelDictation);

const fieldText = (field: Field) => (field === "description" ? description : change);

async function pressMic(field: Field) {
  if (typing.value || busy.value) return;
  if (dictation.state === "recording") {
    const was = recording.value;
    const text = await stopDictation();
    recording.value = null;
    // Each recording adds to what is there, so she can say it in parts.
    if (was && text) fieldText(was).value = `${fieldText(was).value} ${text}`.trim();
    return;
  }
  if (dictation.state !== "idle") return;
  error.value = null;
  recording.value = field;
  if (!(await startDictation(model.value))) recording.value = null;
}

function shown(field: Field) {
  return recording.value === field ? `${fieldText(field).value} ${dictation.partial}`.trim() : fieldText(field).value;
}

function toProposals(cards: NewCard[]): Proposal[] {
  return cards.map((c) => {
    const duplicate = deck.value!.cards.some(
      (d) => sameAnswer(d.front.text, c.front) && sameAnswer(d.back.text, c.back),
    );
    return { id: crypto.randomUUID(), ...c, on: !duplicate, duplicate };
  });
}

async function makeList() {
  if (!description.value.trim() || busy.value) return;
  await ask();
}

async function askForChange() {
  if (!change.value.trim() || busy.value) return;
  await ask(change.value.trim());
}

async function ask(changeText?: string) {
  busy.value = true;
  error.value = null;
  try {
    const result = await generateCards({
      description: description.value.trim(),
      deckName: deck.value!.name,
      languages: deck.value!.languages,
      existing: deck.value!.cards.map((c) => ({ front: c.front.text, back: c.back.text })),
      ...(changeText
        ? {
            current: proposals.value.map(({ front, back, frontLang, backLang }) => ({ front, back, frontLang, backLang })),
            change: changeText,
          }
        : {}),
    });
    if (!result.cards.length) {
      error.value = result.note ?? "The AI didn't make any cards. Try saying it another way.";
      return;
    }
    proposals.value = toProposals(result.cards);
    note.value = result.note;
    change.value = "";
    step.value = "review";
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    busy.value = false;
  }
}

function setAll(on: boolean) {
  for (const p of proposals.value) p.on = on;
}

function remove(id: string) {
  proposals.value = proposals.value.filter((p) => p.id !== id);
}

function toggleLang(p: Proposal, side: SideName) {
  if (side === "front") p.frontLang = otherLang(deck.value!, p.frontLang);
  else p.backLang = otherLang(deck.value!, p.backLang);
}

function typed(text: string) {
  const t = typing.value;
  typing.value = null;
  if (!t) return;
  if ("field" in t) {
    fieldText(t.field).value = text;
    return;
  }
  const p = proposals.value.find((x) => x.id === t.card);
  if (p && text) {
    p[t.side] = text;
    p.on = true;
  }
}

const typingTitle = computed(() => {
  const t = typing.value;
  if (!t) return "";
  if ("field" in t) return t.field === "description" ? "Describe the cards" : "What should change?";
  return t.side === "front" ? "Change the question" : "Change the answer";
});

const typingText = computed(() => {
  const t = typing.value;
  if (!t) return "";
  if ("field" in t) return fieldText(t.field).value;
  return proposals.value.find((x) => x.id === t.card)?.[t.side] ?? "";
});

function addTicked() {
  const d = deck.value!;
  for (const p of ticked.value) {
    const side = (text: string, lang: Lang) => (mixed.value ? { text, lang } : { text });
    const card = addCard(d, side(p.front, p.frontLang), side(p.back, p.backLang));
    card.source = "ai";
  }
  go({ name: "deck", deckId: d.id });
}

function startAgain() {
  step.value = "describe";
  proposals.value = [];
  note.value = null;
  error.value = null;
}

useSpaceToTalk(() => pressMic(step.value === "describe" ? "description" : "change"));
</script>

<template>
  <section v-if="deck" class="describe">
    <header class="top">
      <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'deck', deckId: deck.id })">
        <Icon name="back" />
      </button>
      <h1>Describe cards</h1>
    </header>

    <ModelBanner :model="model" />

    <template v-if="step === 'describe'">
      <p class="intro">Say or type the cards you want. The AI makes a list, and you choose which ones to add.</p>

      <div class="panel" :class="{ recording: recording === 'description' }">
        <div class="panel-head">
          <span class="label">What cards do you want?</span>
          <button
            v-if="description && !recording"
            type="button"
            class="clear"
            @mousedown.prevent
            @click="description = ''"
          >
            Clear
          </button>
        </div>
        <LiveText
          :text="shown('description')"
          :live="recording === 'description'"
          :placeholder="recording === 'description' ? 'Listening…' : ''"
        />
      </div>

      <ul v-if="!description && !recording" class="examples">
        <li>“The present tense of avoir and aimer, like j’ai to I have. Both ways.”</li>
        <li>“The planets in order from the Sun.”</li>
        <li>“These words: le chien, le chat, la maison, le pain.”</li>
      </ul>

      <div class="controls">
        <button
          type="button"
          class="button side-action"
          :disabled="dictation.state !== 'idle' || busy"
          @click="typing = { field: 'description' }"
        >
          <Icon name="keyboard" /> Type
        </button>
        <MicButton
          :active="recording === 'description'"
          :disabled="!models[model].installed || busy"
          @press="pressMic('description')"
        />
        <span />
      </div>

      <p v-if="error" class="warn">{{ error }}</p>

      <div class="row center">
        <button
          type="button"
          class="button primary big"
          :disabled="!description.trim() || busy || dictation.state !== 'idle'"
          @click="makeList"
        >
          <template v-if="busy">Making your cards…</template>
          <template v-else><Icon name="sparkle" /> Make a list</template>
        </button>
      </div>
    </template>

    <template v-else>
      <p v-if="note" class="note">{{ note }}</p>

      <div class="toolbar">
        <span class="count">{{ ticked.length }} of {{ proposals.length }} ticked</span>
        <span class="spacer" />
        <button type="button" class="button quiet" @click="setAll(true)">Tick all</button>
        <button type="button" class="button quiet" @click="setAll(false)">Untick all</button>
      </div>

      <ul class="proposals">
        <li v-for="p in proposals" :key="p.id" class="proposal" :class="{ off: !p.on }">
          <label class="tick">
            <input v-model="p.on" type="checkbox" :aria-label="`Add ${p.front}`" />
          </label>
          <div class="texts">
            <div class="side">
              <LangTag v-if="mixed" :lang="p.frontLang" tappable @toggle="toggleLang(p, 'front')" />
              <button type="button" class="text q" @click="typing = { card: p.id, side: 'front' }">{{ p.front }}</button>
            </div>
            <div class="side">
              <LangTag v-if="mixed" :lang="p.backLang" tappable @toggle="toggleLang(p, 'back')" />
              <button type="button" class="text a" @click="typing = { card: p.id, side: 'back' }">{{ p.back }}</button>
            </div>
            <span v-if="p.duplicate" class="dup">Already in this deck</span>
          </div>
          <button type="button" class="icon-button" aria-label="Remove card" @click="remove(p.id)">
            <Icon name="trash" :size="24" />
          </button>
        </li>
      </ul>
      <p class="hint">Tap a question or an answer to change it.</p>

      <div class="panel change" :class="{ recording: recording === 'change' }">
        <span class="label">Want something changed? Say or type it.</span>
        <LiveText
          :text="shown('change')"
          :live="recording === 'change'"
          :placeholder="recording === 'change' ? 'Listening…' : 'For example: add the negative, like je n’ai pas.'"
        />
        <div class="row change-actions">
          <button
            type="button"
            class="button"
            :class="{ recording: recording === 'change' }"
            :disabled="busy || (dictation.state !== 'idle' && recording !== 'change')"
            @mousedown.prevent
            @click="pressMic('change')"
          >
            <Icon :name="recording === 'change' ? 'stop' : 'mic'" />
            {{ recording === "change" ? "Stop" : "Say it" }}
          </button>
          <button
            type="button"
            class="button"
            :disabled="busy || dictation.state !== 'idle'"
            @click="typing = { field: 'change' }"
          >
            <Icon name="keyboard" /> Type
          </button>
          <span class="spacer" />
          <button
            type="button"
            class="button"
            :disabled="!change.trim() || busy || dictation.state !== 'idle'"
            @click="askForChange"
          >
            {{ busy ? "Changing the list…" : "Change the list" }}
          </button>
        </div>
      </div>

      <p v-if="error" class="warn">{{ error }}</p>

      <div class="row center finish">
        <button type="button" class="button big" :disabled="busy" @click="startAgain">Start again</button>
        <button type="button" class="button primary big" :disabled="!ticked.length || busy" @click="addTicked">
          <Icon name="plus" /> Add {{ ticked.length }} {{ ticked.length === 1 ? "card" : "cards" }}
        </button>
      </div>
    </template>

    <TypeDialog v-if="typing" :title="typingTitle" :text="typingText" @done="typed" @cancel="typing = null" />
  </section>
</template>

<style scoped>
.describe {
  max-width: 860px;
  margin: 0 auto;
}
.intro {
  color: var(--muted);
  margin: 0 0 16px;
}
.panel {
  background: var(--surface);
  border: 3px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 22px 18px;
  margin-bottom: 16px;
}
.panel.recording {
  border-color: var(--record);
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
}
.label {
  display: block;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 6px;
}
.clear {
  font: inherit;
  font-size: 0.95rem;
  color: var(--accent);
  background: none;
  border: none;
  padding: 8px 0 8px 12px;
  cursor: pointer;
}
.examples {
  color: var(--muted);
  margin: 0 0 16px;
  padding-left: 22px;
}
.examples li {
  margin-bottom: 4px;
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: start;
  margin-bottom: 20px;
}
.controls .side-action {
  justify-self: end;
  margin-top: 28px;
}
.note {
  background: var(--accent-wash);
  border-radius: var(--radius);
  padding: 12px 18px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.count {
  font-weight: 600;
}
.spacer {
  flex: 1;
}
.proposals {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.proposal {
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.proposal.off {
  opacity: 0.55;
}
.tick {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  cursor: pointer;
  flex: none;
}
.tick input {
  width: 28px;
  height: 28px;
  accent-color: var(--accent);
  cursor: pointer;
}
.texts {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.side {
  display: flex;
  align-items: center;
  gap: 8px;
}
.side :deep(.lang.tappable) {
  margin-left: 0;
}
.text {
  font: inherit;
  text-align: left;
  background: none;
  border: none;
  padding: 4px 0;
  color: var(--text);
  cursor: pointer;
  overflow-wrap: anywhere;
}
.text.q {
  font-weight: 600;
}
.text.a {
  color: var(--muted);
}
.dup {
  font-size: 0.9rem;
  color: var(--warn);
}
.hint {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 8px 0 20px;
}
.change .label {
  margin-bottom: 4px;
}
.change-actions {
  margin-top: 10px;
  flex-wrap: wrap;
}
.button.recording {
  border-color: var(--record);
  color: var(--record);
}
/* Stays in view, so "Add" is never below a long list. */
.finish {
  position: sticky;
  bottom: 0;
  margin: 24px -8px 0;
  padding: 14px 8px;
  background: var(--bg);
  border-top: 2px solid var(--line);
}
.warn {
  color: var(--warn);
  text-align: center;
}
</style>
