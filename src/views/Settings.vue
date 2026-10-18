<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../components/Icon.vue";
import { AI_MODELS, ai, clearKey, hasKey, saveKey } from "../ai";
import { openDecks, saveDecks } from "../exchange";
import { library } from "../library";
import { VOICES, VOICE_MODELS, speak, voice } from "../voice";
import { go } from "../router";
import { playNotYet, playRight } from "../sounds";
import { ensureModel, models } from "../speech";
import type { ModelId } from "../types";

const ids: ModelId[] = ["english", "multilingual"];

const keyInput = ref("");
const keyBusy = ref(false);
const keyError = ref<string | null>(null);
const replacing = ref(false);

const backupMessage = ref<string | null>(null);
const clearMessage = ref<string | null>(null);

/** Deletes the saved read-aloud clips, for when one sounds wrong. Each card is read afresh next time. */
async function clearVoices() {
  try {
    const n = await invoke<number>("clear_speech_cache");
    clearMessage.value = n === 1 ? "Cleared 1 saved voice." : `Cleared ${n} saved voices.`;
  } catch (err) {
    clearMessage.value = String(err);
  }
}

async function backUp() {
  backupMessage.value = null;
  const date = new Date().toISOString().slice(0, 10);
  try {
    if (await saveDecks(library.decks, `Flashcards backup ${date}`)) backupMessage.value = "Saved.";
  } catch (err) {
    backupMessage.value = `It didn't save: ${err}`;
  }
}

async function restore() {
  backupMessage.value = null;
  try {
    const added = await openDecks();
    if (added) backupMessage.value = `Added ${added.length} ${added.length === 1 ? "deck" : "decks"}.`;
  } catch (err) {
    backupMessage.value = err instanceof Error ? err.message : String(err);
  }
}

async function submitKey() {
  keyBusy.value = true;
  keyError.value = null;
  try {
    await saveKey(keyInput.value);
    keyInput.value = "";
    replacing.value = false;
  } catch (err) {
    keyError.value = String(err);
  } finally {
    keyBusy.value = false;
  }
}
</script>

<template>
  <section class="settings">
    <header class="top">
      <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'home' })">
        <Icon name="back" />
      </button>
      <h1>Settings</h1>
    </header>

    <div class="panel">
      <h2>AI help</h2>
      <p class="hint">
        AI tidies up what she says and checks her spoken answers. It sends the card text, not the audio, to
        OpenRouter.
      </p>

      <div class="key">
        <template v-if="hasKey && !replacing">
          <span class="ready"><Icon name="check" :size="22" /> OpenRouter key saved</span>
          <span v-if="ai.keySource === 'environment'" class="hint">(from OPENROUTER_API_KEY)</span>
          <span class="spacer" />
          <button type="button" class="button" @click="replacing = true">Change</button>
          <button v-if="ai.keySource === 'stored'" type="button" class="button quiet" @click="clearKey">Remove</button>
        </template>
        <form v-else class="key-form" @submit.prevent="submitKey">
          <input
            v-model="keyInput"
            type="password"
            placeholder="Paste the OpenRouter key"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="submit" class="button primary" :disabled="!keyInput.trim() || keyBusy">
            {{ keyBusy ? "Checking…" : "Save" }}
          </button>
          <button v-if="replacing" type="button" class="button quiet" @click="replacing = false">Cancel</button>
        </form>
      </div>
      <p v-if="keyError" class="error-text">{{ keyError }}</p>

      <label class="toggle">
        <input v-model="library.settings.cleanup" type="checkbox" />
        <span>Tidy up what I say on cards</span>
      </label>
      <label class="toggle">
        <input v-model="library.settings.marking" type="checkbox" />
        <span>Check my spoken answers when I practise</span>
      </label>

      <h3>AI model</h3>
      <label v-for="m in AI_MODELS" :key="m.id" class="toggle">
        <input v-model="library.settings.aiModel" type="radio" name="ai-model" :value="m.id" />
        <span>
          <strong>{{ m.title }}</strong> <span class="hint">· {{ m.detail }}</span>
        </span>
      </label>
    </div>

    <div class="panel">
      <h2>Read aloud</h2>
      <p class="hint">
        A voice from OpenRouter reads cards aloud. It needs the OpenRouter key above. Each card is read by the
        AI only once, then kept on this computer.
      </p>
      <label class="toggle">
        <input v-model="library.settings.readAloud" type="checkbox" />
        <span>Show read-aloud buttons</span>
      </label>

      <h3>Voice</h3>
      <div class="chips">
        <button
          v-for="v in VOICES"
          :key="v"
          type="button"
          class="chip"
          :class="{ on: library.settings.voice === v }"
          @click="library.settings.voice = v"
        >
          {{ v }}
        </button>
      </div>
      <div class="row try">
        <button
          type="button"
          class="button"
          :disabled="!hasKey || !library.settings.readAloud || !!voice.loading"
          @click="speak('Hello! This is how I will read your flashcards. What is the largest planet?', 'en')"
        >
          <Icon name="speaker" :size="22" /> {{ voice.loading ? "Getting the voice…" : "Try this voice" }}
        </button>
      </div>
      <p v-if="voice.error" class="error-text">{{ voice.error }}</p>

      <h3>Saved voices</h3>
      <p class="hint">
        Each card is read by the AI once, then kept. If a card sounds wrong, clear the saved voices and it is read
        again next time.
      </p>
      <div class="row try">
        <button type="button" class="button" @click="clearVoices">
          <Icon name="trash" :size="22" /> Clear saved voices
        </button>
        <span v-if="clearMessage" class="hint">{{ clearMessage }}</span>
      </div>

      <h3>Voice model</h3>
      <label v-for="m in VOICE_MODELS" :key="m.id" class="toggle">
        <input v-model="library.settings.voiceModel" type="radio" name="voice-model" :value="m.id" />
        <span>
          <strong>{{ m.title }}</strong> <span class="hint">· {{ m.detail }}</span>
        </span>
      </label>
    </div>

    <div class="panel">
      <h2>Sounds</h2>
      <label class="toggle">
        <input v-model="library.settings.sounds" type="checkbox" />
        <span>Play a sound when I practise</span>
      </label>
      <div class="row">
        <button type="button" class="button" @click="playRight(true)">Hear “Got it”</button>
        <button type="button" class="button" @click="playNotYet(true)">Hear “Not yet”</button>
      </div>
    </div>

    <div class="panel">
      <h2>Speech recognition</h2>
      <p class="hint">Speech turns into text on this computer. Each language downloads once.</p>
      <div v-for="id in ids" :key="id" class="model">
        <div>
          <strong>{{ models[id].label }}</strong>
          <span class="hint"> · {{ models[id].downloadMb }} MB</span>
        </div>
        <span v-if="models[id].installed" class="ready"><Icon name="check" :size="22" /> Ready</span>
        <span v-else-if="models[id].downloading">{{ Math.round(models[id].progress * 100) }}%</span>
        <button v-else type="button" class="button" @click="ensureModel(id)">
          {{ models[id].error ? "Try again" : "Download" }}
        </button>
      </div>
    </div>

    <div class="panel">
      <h2>Backup</h2>
      <p class="hint">
        Save every deck, with her progress, in one file. Opening a file adds its decks. Decks that are
        already here come in as copies, so nothing is overwritten.
      </p>
      <div class="row backup">
        <button type="button" class="button" :disabled="!library.decks.length" @click="backUp">
          <Icon name="save" :size="22" /> Save all decks
        </button>
        <button type="button" class="button" @click="restore">
          <Icon name="open" :size="22" /> Open a file
        </button>
        <span v-if="backupMessage" class="hint">{{ backupMessage }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings {
  max-width: 760px;
  margin: 0 auto;
}
.panel {
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 22px;
  margin-bottom: 18px;
}
h2 {
  margin: 0 0 4px;
}
.hint {
  color: var(--muted);
}
h3 {
  margin: 18px 0 4px;
  font-size: 1.1rem;
}
.key {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.spacer {
  flex: 1;
}
.key-form {
  display: flex;
  gap: 10px;
  flex: 1;
  flex-wrap: wrap;
}
.key-form input {
  flex: 1;
  min-width: 240px;
  font: inherit;
  padding: 0 14px;
  min-height: 56px;
  border-radius: 14px;
  border: 2px solid var(--line);
  background: var(--bg);
  color: var(--text);
  user-select: text;
}
.key-form input:focus {
  outline: none;
  border-color: var(--accent);
}
.error-text {
  color: var(--danger);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  font: inherit;
  text-transform: capitalize;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 2px solid var(--line);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  touch-action: manipulation;
}
.chip.on {
  border-color: var(--accent);
  background: var(--accent-wash);
  font-weight: 600;
}
.try {
  margin-top: 12px;
}
.backup {
  align-items: center;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 1.1rem;
  cursor: pointer;
  min-height: 52px;
}
.toggle input {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  accent-color: var(--accent);
}
.model {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
  min-height: 64px;
}
.ready {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--good);
  font-weight: 600;
}
</style>
