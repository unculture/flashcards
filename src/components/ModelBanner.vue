<script setup lang="ts">
import { computed } from "vue";
import { ensureModel, models } from "../speech";
import type { ModelId } from "../types";

// Shows while a speech model is missing or downloading.
const props = defineProps<{ model: ModelId }>();
const m = computed(() => models[props.model]);
const percent = computed(() => Math.round(m.value.progress * 100));
</script>

<template>
  <div v-if="!m.installed" class="banner">
    <template v-if="m.error">
      <p>The voice download stopped. Check the internet connection.</p>
      <button type="button" class="button primary" @click="ensureModel(model)">Try again</button>
    </template>
    <template v-else-if="m.downloading">
      <p>
        Getting the {{ model === "english" ? "" : "French " }}voice ready… {{ percent }}%
      </p>
      <div class="bar"><div class="fill" :style="{ width: percent + '%' }" /></div>
      <p class="small">This happens only once. It downloads about {{ m.downloadMb }} MB.</p>
    </template>
    <template v-else>
      <p>The {{ model === "english" ? "" : "French " }}voice needs a one-time download (about {{ m.downloadMb }} MB).</p>
      <button type="button" class="button primary" @click="ensureModel(model)">Download it</button>
    </template>
  </div>
</template>

<style scoped>
.banner {
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 20px;
}
.banner p {
  margin: 0 0 10px;
}
.bar {
  height: 14px;
  border-radius: 7px;
  background: var(--line);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 250ms ease;
}
.small {
  margin-top: 10px !important;
  font-size: 0.95rem;
  color: var(--muted);
}
</style>
