<script setup lang="ts">
import { onMounted, ref } from "vue";
import { library, loadLibrary, loaded, saveError } from "./library";
import { route } from "./router";
import { ensureModel, initSpeech } from "./speech";
import CardMaker from "./views/CardMaker.vue";
import DeckView from "./views/DeckView.vue";
import Home from "./views/Home.vue";
import NewDeck from "./views/NewDeck.vue";
import Practice from "./views/Practice.vue";
import Settings from "./views/Settings.vue";

const startError = ref<string | null>(null);

onMounted(async () => {
  try {
    await initSpeech();
    await loadLibrary();
    // Start the English voice download on the first launch, so it is ready
    // by the time she has named her first deck.
    ensureModel("english");
    if (library.decks.some((d) => d.backLang === "fr")) ensureModel("multilingual");
  } catch (err) {
    startError.value = String(err);
  }
});
</script>

<template>
  <main class="app">
    <p v-if="startError" class="error">Something went wrong while starting: {{ startError }}</p>
    <p v-if="saveError" class="error">Your cards could not be saved: {{ saveError }}</p>
    <template v-if="loaded">
      <Home v-if="route.name === 'home'" />
      <NewDeck v-else-if="route.name === 'newDeck'" />
      <Settings v-else-if="route.name === 'settings'" />
      <DeckView v-else-if="route.name === 'deck'" :deck-id="route.deckId" />
      <CardMaker
        v-else-if="route.name === 'make'"
        :key="route.cardId ?? route.deckId"
        :deck-id="route.deckId"
        :card-id="route.cardId"
      />
      <Practice v-else-if="route.name === 'practice'" :deck-id="route.deckId" />
    </template>
  </main>
</template>
