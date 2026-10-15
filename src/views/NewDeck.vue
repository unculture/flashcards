<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "../components/Icon.vue";
import LiveText from "../components/LiveText.vue";
import MicButton from "../components/MicButton.vue";
import ModelBanner from "../components/ModelBanner.vue";
import TypeDialog from "../components/TypeDialog.vue";
import { createDeck } from "../library";
import { go, useSpaceToTalk } from "../router";
import {
  cancelDictation,
  dictation,
  ensureModel,
  models,
  preloadModel,
  startDictation,
  stopDictation,
} from "../speech";
import type { Lang } from "../types";

const name = ref("");
const backLang = ref<Lang>("en");
const typing = ref(false);
const recording = ref(false);

onMounted(() => preloadModel("english"));
onBeforeUnmount(cancelDictation);

async function pressMic() {
  if (typing.value) return;
  if (dictation.state === "recording") {
    const text = await stopDictation();
    recording.value = false;
    if (text) name.value = text.replace(/[.!?]+$/, "");
  } else if (dictation.state === "idle") {
    recording.value = await startDictation("english");
  }
}

function create() {
  if (!name.value.trim()) return;
  if (backLang.value === "fr") ensureModel("multilingual");
  const deck = createDeck(name.value.trim(), backLang.value);
  go({ name: "make", deckId: deck.id });
}

useSpaceToTalk(pressMic);
</script>

<template>
  <section class="new-deck">
    <header class="top">
      <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'home' })">
        <Icon name="back" />
      </button>
      <h1>New deck</h1>
    </header>

    <ModelBanner model="english" />

    <div class="panel">
      <span class="label">What is the deck called?</span>
      <LiveText
        :text="recording ? dictation.partial : name"
        :live="recording"
        :placeholder="recording ? 'Listening…' : 'For example: Science, the Tudors, or French food'"
      />
    </div>

    <p v-if="dictation.error" class="warn">{{ dictation.error }}</p>

    <div class="controls">
      <button type="button" class="button" :disabled="dictation.state !== 'idle'" @click="typing = true">
        <Icon name="keyboard" /> Type
      </button>
      <MicButton :active="true" :disabled="!models.english.installed" @press="pressMic" />
      <span />
    </div>

    <div class="panel">
      <span class="label">What language are the answers in?</span>
      <div class="choices">
        <button type="button" class="choice" :class="{ on: backLang === 'en' }" @click="backLang = 'en'">
          English
        </button>
        <button type="button" class="choice" :class="{ on: backLang === 'fr' }" @click="backLang = 'fr'">
          French
        </button>
      </div>
    </div>

    <div class="row center">
      <button
        type="button"
        class="button primary big"
        :disabled="!name.trim() || dictation.state !== 'idle'"
        @click="create"
      >
        Make the deck <Icon name="arrowRight" />
      </button>
    </div>

    <TypeDialog
      v-if="typing"
      title="Type the deck name"
      :text="name"
      @done="(t) => ((name = t), (typing = false))"
      @cancel="typing = false"
    />
  </section>
</template>

<style scoped>
.new-deck {
  max-width: 760px;
  margin: 0 auto;
}
.panel {
  background: var(--surface);
  border: 3px solid var(--line);
  border-radius: var(--radius);
  padding: 16px 22px;
  margin-bottom: 20px;
}
.label {
  display: block;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: start;
  margin-bottom: 24px;
}
.controls > .button {
  justify-self: end;
  margin-top: 28px;
}
.choices {
  display: flex;
  gap: 14px;
}
.choice {
  font: inherit;
  font-size: 1.25rem;
  flex: 1;
  min-height: 64px;
  border-radius: 14px;
  border: 3px solid var(--line);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
}
.choice.on {
  border-color: var(--accent);
  background: var(--accent-wash);
  font-weight: 600;
}
.warn {
  color: var(--warn);
  text-align: center;
}
</style>
