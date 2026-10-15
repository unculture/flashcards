<script setup lang="ts">
import { computed, ref } from "vue";
import Icon from "../components/Icon.vue";
import { findDeck } from "../library";
import { go } from "../router";
import type { Card } from "../types";

// Two A4 layouts:
// - "fold": one side of the paper. Each strip has the question on the left
//   and the answer on the right. Cut along the dashed lines, then fold along
//   the dotted middle line. 5 cards per sheet, each 105 × 59.4 mm.
// - "duplex": both sides of the paper. 8 cards per sheet, each A7
//   (105 × 74.25 mm). The answer pages swap the columns, so each answer
//   prints behind its question when the printer flips on the long edge.

type Layout = "fold" | "duplex";

const props = defineProps<{ deckId: string }>();
const deck = computed(() => findDeck(props.deckId));
const layout = ref<Layout>("fold");

const perSheet = computed(() => (layout.value === "fold" ? 5 : 8));

const sheets = computed(() => {
  const cards = deck.value?.cards ?? [];
  const out: Card[][] = [];
  for (let i = 0; i < cards.length; i += perSheet.value) out.push(cards.slice(i, i + perSheet.value));
  return out;
});

/** The answer page for a duplex sheet: each row's two cards swap places. */
function mirrored(cards: Card[]): (Card | null)[] {
  const out: (Card | null)[] = [];
  for (let i = 0; i < 8; i += 2) out.push(cards[i + 1] ?? null, cards[i] ?? null);
  return out;
}

/** Shorter text prints larger. */
function sizeClass(text: string) {
  const n = text.length;
  if (n <= 25) return "s1";
  if (n <= 60) return "s2";
  if (n <= 120) return "s3";
  if (n <= 220) return "s4";
  return "s5";
}

function print() {
  window.print();
}

const sheetCount = computed(() => sheets.value.length * (layout.value === "duplex" ? 2 : 1));
</script>

<template>
  <section v-if="deck" class="print-view">
    <div class="no-print">
      <header class="top">
        <button type="button" class="icon-button" aria-label="Back" @click="go({ name: 'deck', deckId: deck.id })">
          <Icon name="back" />
        </button>
        <h1>Print {{ deck.name }}</h1>
      </header>

      <div class="choices">
        <button type="button" class="choice" :class="{ on: layout === 'fold' }" @click="layout = 'fold'">
          <strong>Fold cards</strong>
          <span>One side of the paper. Cut the strips, then fold each one in half. 5 cards on each page.</span>
        </button>
        <button type="button" class="choice" :class="{ on: layout === 'duplex' }" @click="layout = 'duplex'">
          <strong>Double-sided</strong>
          <span>Print on both sides, flipping on the long edge. Cut out 8 cards on each sheet.</span>
        </button>
      </div>

      <div class="row center">
        <button type="button" class="button primary big" :disabled="!deck.cards.length" @click="print">
          Print {{ sheetCount }} {{ sheetCount === 1 ? "page" : "pages" }}
        </button>
      </div>
      <p class="hint">Choose A4 paper and 100% scale (not “fit to page”) in the print window.</p>
    </div>

    <div class="sheets">
      <template v-for="(cards, s) in sheets" :key="`${layout}-${s}`">
        <div v-if="layout === 'fold'" class="sheet fold">
          <div v-for="card in cards" :key="card.id" class="strip">
            <div class="cell">
              <span class="tag">{{ deck.name }}</span>
              <p :class="sizeClass(card.front.text)">{{ card.front.text }}</p>
            </div>
            <div class="cell">
              <p :class="sizeClass(card.back.text)">{{ card.back.text }}</p>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="sheet duplex">
            <div v-for="i in 8" :key="i" class="cell">
              <template v-if="cards[i - 1]">
                <span class="tag">{{ deck.name }}</span>
                <p :class="sizeClass(cards[i - 1].front.text)">{{ cards[i - 1].front.text }}</p>
              </template>
            </div>
          </div>
          <div class="sheet duplex">
            <div v-for="(card, i) in mirrored(cards)" :key="i" class="cell">
              <p v-if="card" :class="sizeClass(card.back.text)">{{ card.back.text }}</p>
            </div>
          </div>
        </template>
      </template>
    </div>
  </section>
</template>

<style scoped>
.print-view {
  max-width: 900px;
  margin: 0 auto;
}
.choices {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}
.choice {
  font: inherit;
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: var(--radius);
  border: 3px solid var(--line);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.choice.on {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.choice strong {
  font-size: 1.25rem;
}
.choice span {
  color: var(--muted);
}
.hint {
  text-align: center;
  color: var(--muted);
}

/* The sheets, at real size in millimetres, shown smaller on screen. */
.sheets {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  zoom: 0.5;
}
.sheet {
  width: 210mm;
  height: 297mm;
  background: white;
  color: black;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  font-family: "Lexend Variable", sans-serif;
  overflow: hidden;
  break-after: page;
}
.fold {
  display: grid;
  grid-template-rows: repeat(5, 59.4mm);
}
.strip {
  display: grid;
  grid-template-columns: 105mm 105mm;
  border-bottom: 0.3mm dashed #999;
}
.strip .cell:first-child {
  border-right: 0.3mm dotted #bbb;
}
.duplex {
  display: grid;
  grid-template-columns: 105mm 105mm;
  grid-template-rows: repeat(4, 74.25mm);
}
.duplex .cell {
  border-right: 0.3mm dashed #999;
  border-bottom: 0.3mm dashed #999;
}
.cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  /* Wide margins, so a duplex printer's small shift does not reach the text. */
  padding: 9mm 10mm;
  overflow: hidden;
}
.cell p {
  margin: 0;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.tag {
  position: absolute;
  /* Most printers cannot print the outer 4 or 5 mm of the paper. */
  top: 6mm;
  left: 8mm;
  font-size: 7pt;
  color: #888;
}
.s1 { font-size: 24pt; }
.s2 { font-size: 18pt; }
.s3 { font-size: 14pt; }
.s4 { font-size: 11pt; }
.s5 { font-size: 9pt; }

@media print {
  .sheets {
    zoom: 1;
    margin: 0;
    gap: 0;
    display: block;
  }
  .sheet {
    box-shadow: none;
  }
}
</style>
