<script setup lang="ts">
import Icon from "../components/Icon.vue";
import { library } from "../library";
import { go } from "../router";
import { ensureModel, models } from "../speech";
import type { ModelId } from "../types";

const ids: ModelId[] = ["english", "multilingual"];
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
      <label class="toggle">
        <input v-model="library.settings.readBack" type="checkbox" />
        <span>Read cards aloud automatically</span>
      </label>
    </div>

    <div class="panel">
      <h2>Voices</h2>
      <p class="hint">Speech turns into text on this computer. Each voice downloads once.</p>
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
.toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 1.2rem;
  cursor: pointer;
  min-height: 48px;
}
.toggle input {
  width: 28px;
  height: 28px;
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
