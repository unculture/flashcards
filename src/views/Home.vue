<script setup lang="ts">
import BoxBar from "../components/BoxBar.vue";
import Icon from "../components/Icon.vue";
import ModelBanner from "../components/ModelBanner.vue";
import UpdateBanner from "../components/UpdateBanner.vue";
import { ref } from "vue";
import { openDecks } from "../exchange";
import { library } from "../library";
import { go } from "../router";

const openMessage = ref<string | null>(null);

async function openFile() {
  openMessage.value = null;
  try {
    const added = await openDecks();
    if (!added) return;
    if (added.length === 1) go({ name: "deck", deckId: added[0].id });
    else openMessage.value = `Added ${added.length} decks.`;
  } catch (err) {
    openMessage.value = err instanceof Error ? err.message : String(err);
  }
}
</script>

<template>
  <section>
    <header class="top">
      <h1>My flashcards</h1>
      <button type="button" class="icon-button" aria-label="Settings" @click="go({ name: 'settings' })">
        <Icon name="gear" />
      </button>
    </header>

    <UpdateBanner />
    <ModelBanner model="english" />

    <div class="grid">
      <button type="button" class="tile new" @click="go({ name: 'newDeck' })">
        <Icon name="plus" :size="40" />
        <span>New deck</span>
      </button>
      <button
        v-for="deck in library.decks"
        :key="deck.id"
        type="button"
        class="tile"
        @click="go({ name: 'deck', deckId: deck.id })"
      >
        <span class="name">{{ deck.name }}</span>
        <span class="meta">
          {{ deck.cards.length }} {{ deck.cards.length === 1 ? "card" : "cards" }}
          <template v-if="deck.backLang === 'fr'"> · French</template>
        </span>
        <BoxBar :deck="deck" />
      </button>
    </div>

    <div class="footer">
      <button type="button" class="button quiet" @click="openFile">
        <Icon name="open" :size="22" /> Open a deck file
      </button>
      <span v-if="openMessage" class="hint">{{ openMessage }}</span>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
}
.tile {
  font: inherit;
  color: inherit;
  text-align: left;
  background: var(--surface);
  border: 3px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 20px;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  touch-action: manipulation;
}
.tile:hover {
  border-color: var(--accent-soft);
}
.tile.new {
  align-items: center;
  justify-content: center;
  color: var(--accent);
  border-style: dashed;
  font-size: 1.3rem;
  font-weight: 600;
}
.name {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.25;
}
.footer {
  margin: 28px 0 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.hint {
  color: var(--muted);
}
.meta {
  color: var(--muted);
  margin-bottom: auto;
}
</style>
