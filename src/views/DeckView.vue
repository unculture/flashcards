<script setup lang="ts">
import { computed, ref } from "vue";
import BoxBar from "../components/BoxBar.vue";
import Icon from "../components/Icon.vue";
import { deleteCard, deleteDeck, findDeck, isDue } from "../library";
import { go } from "../router";

const props = defineProps<{ deckId: string }>();
const deck = computed(() => findDeck(props.deckId));
const dueCount = computed(() => deck.value?.cards.filter((c) => isDue(c)).length ?? 0);
const confirmingDeck = ref(false);
const confirmingCard = ref<string | null>(null);

function removeDeck() {
  deleteDeck(props.deckId);
  go({ name: "home" });
}
</script>

<template>
  <section v-if="deck" class="deck">
    <header class="top">
      <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'home' })">
        <Icon name="back" />
      </button>
      <h1>{{ deck.name }}</h1>
    </header>

    <div class="actions">
      <button type="button" class="button primary big" @click="go({ name: 'make', deckId: deck.id })">
        <Icon name="mic" /> Make cards
      </button>
      <button
        type="button"
        class="button big"
        :disabled="deck.cards.length === 0"
        @click="go({ name: 'practice', deckId: deck.id })"
      >
        <Icon name="cards" /> Practise
        <span v-if="deck.cards.length" class="due">{{ dueCount }} ready</span>
      </button>
      <button
        type="button"
        class="button big print"
        :disabled="deck.cards.length === 0"
        @click="go({ name: 'print', deckId: deck.id })"
      >
        <Icon name="printer" /> Print
      </button>
    </div>

    <div v-if="deck.cards.length" class="progress">
      <BoxBar :deck="deck" large />
      <p class="hint">Cards move up a box each time you know them.</p>
    </div>

    <p v-if="!deck.cards.length" class="empty">No cards yet. Tap “Make cards” to start.</p>

    <ul class="cards">
      <li v-for="card in [...deck.cards].reverse()" :key="card.id" class="card">
        <div class="texts">
          <div class="q">
            <span>{{ card.front.text }}</span>
          </div>
          <div class="a">
            <span>{{ card.back.text }}</span>
          </div>
        </div>
        <div class="card-actions">
          <template v-if="confirmingCard === card.id">
            <button type="button" class="button quiet" @click="confirmingCard = null">Keep</button>
            <button type="button" class="button danger" @click="deleteCard(deck, card.id)">Delete</button>
          </template>
          <template v-else>
            <button
              type="button"
              class="icon-button"
              aria-label="Change card"
              @click="go({ name: 'make', deckId: deck.id, cardId: card.id })"
            >
              <Icon name="pencil" :size="24" />
            </button>
            <button type="button" class="icon-button" aria-label="Delete card" @click="confirmingCard = card.id">
              <Icon name="trash" :size="24" />
            </button>
          </template>
        </div>
      </li>
    </ul>

    <div class="footer">
      <template v-if="confirmingDeck">
        <span>Delete the whole deck and all its cards?</span>
        <button type="button" class="button quiet" @click="confirmingDeck = false">Keep it</button>
        <button type="button" class="button danger" @click="removeDeck">Delete deck</button>
      </template>
      <button v-else type="button" class="button quiet" @click="confirmingDeck = true">
        <Icon name="trash" :size="22" /> Delete deck
      </button>
    </div>
  </section>
</template>

<style scoped>
.deck {
  max-width: 900px;
  margin: 0 auto;
}
.actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.actions .button {
  flex: 1;
  min-width: 220px;
}
.actions .button.print {
  flex: 0 1 auto;
  min-width: 0;
}
.due {
  font-size: 0.95rem;
  font-weight: 500;
  background: var(--accent-wash);
  color: var(--accent);
  border-radius: 999px;
  padding: 2px 10px;
}
.progress {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px 20px 6px;
  margin-bottom: 20px;
}
.hint {
  color: var(--muted);
  font-size: 0.95rem;
}
.empty {
  text-align: center;
  color: var(--muted);
  font-size: 1.2rem;
  margin: 40px 0;
}
.cards {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 12px 14px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.texts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.q,
.a {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-wrap: anywhere;
}
.q {
  font-weight: 600;
}
.a {
  color: var(--muted);
}
.card-actions {
  display: flex;
  gap: 6px;
}
.footer {
  margin: 32px 0 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
