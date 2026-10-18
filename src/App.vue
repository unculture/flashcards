<script setup lang="ts">
import { onMounted, ref } from "vue";
import { deckModel } from "./lang";
import { library, loadLibrary, loaded, saveError } from "./library";
import { route } from "./router";
import { refreshKey } from "./ai";
import { ensureModel, initSpeech } from "./speech";
import { startUpdateChecks } from "./update";
import CardMaker from "./views/CardMaker.vue";
import DeckView from "./views/DeckView.vue";
import Describe from "./views/Describe.vue";
import Home from "./views/Home.vue";
import NewDeck from "./views/NewDeck.vue";
import Practice from "./views/Practice.vue";
import Print from "./views/Print.vue";
import Settings from "./views/Settings.vue";

const startError = ref<string | null>(null);

onMounted(async () => {
  try {
    await initSpeech();
    await loadLibrary();
    await refreshKey();
    // Start the English voice download on the first launch, so it is ready
    // by the time she has named her first deck.
    ensureModel("english");
    if (library.decks.some((d) => deckModel(d) === "multilingual")) ensureModel("multilingual");
    startUpdateChecks();
  } catch (err) {
    startError.value = String(err);
  }
});
</script>

<template>
  <main class="app">
    <p v-if="startError" class="error no-print">Something went wrong while starting: {{ startError }}</p>
    <p v-if="saveError" class="error no-print">Your cards could not be saved: {{ saveError }}</p>
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
      <Print v-else-if="route.name === 'print'" :deck-id="route.deckId" />
      <Describe v-else-if="route.name === 'describe'" :deck-id="route.deckId" />
    </template>
  </main>
</template>
