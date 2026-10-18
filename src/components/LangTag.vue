<script setup lang="ts">
import { LANG_NAMES } from "../lang";
import type { Lang } from "../types";

// The language of one side of a card, in decks with more than one. In the
// card maker she can tap it to switch, when the app guessed wrong.
const props = defineProps<{ lang: Lang; tappable?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    v-if="props.tappable"
    type="button"
    class="lang tappable"
    :class="props.lang"
    :aria-label="`${LANG_NAMES[props.lang]}. Tap to change the language.`"
    @mousedown.prevent
    @click.stop="emit('toggle')"
  >
    {{ props.lang.toUpperCase() }}
  </button>
  <span v-else class="lang" :class="props.lang" :title="LANG_NAMES[props.lang]">{{ props.lang.toUpperCase() }}</span>
</template>

<style scoped>
.lang {
  display: inline-grid;
  place-items: center;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  min-width: 2.6em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 2px solid var(--line);
  background: var(--bg);
  color: var(--muted);
}
.lang.fr {
  border-color: var(--accent-soft);
  background: var(--accent-wash);
  color: var(--accent);
}
.tappable {
  min-height: 36px;
  min-width: 3.2em;
  margin-left: 10px;
  cursor: pointer;
  touch-action: manipulation;
}
</style>
