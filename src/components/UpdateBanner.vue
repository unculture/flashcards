<script setup lang="ts">
import { downloadUpdate, update } from "../update";

// Tells her a new version is out. It never interrupts: it shows only on the
// home screen, and "Not now" hides it.
</script>

<template>
  <div v-if="update.available && !update.dismissed" class="banner">
    <p>
      <strong>A new version of Flashcards is ready.</strong>
      Download it, then run it to update. Your cards stay as they are.
    </p>
    <div class="buttons">
      <button type="button" class="button primary" @click="downloadUpdate">Download version {{ update.available.version }}</button>
      <button type="button" class="button quiet" @click="update.dismissed = true">Not now</button>
    </div>
  </div>
</template>

<style scoped>
.banner {
  background: var(--accent-wash);
  border: 2px solid var(--accent-soft);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 20px;
}
.banner p {
  margin: 0 0 12px;
}
.buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
