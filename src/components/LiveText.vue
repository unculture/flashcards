<script setup lang="ts">
import { computed, ref, watch } from "vue";

// Shows text that is still changing in a softer colour. When the final text
// replaces the live text, words that changed get a soft highlight that fades.
const props = defineProps<{
  text: string;
  /** True while she is still speaking. */
  live: boolean;
  placeholder?: string;
}>();

const changed = ref<Set<number>>(new Set());
let fadeTimer: number | undefined;
/** The last text she saw while speaking, kept until the corrections arrive. */
let base = "";
let liveEndedAt = 0;
/** Corrections later than this after she stops are not highlighted. */
const CORRECTION_WINDOW_MS = 15_000;

watch(
  () => [props.text, props.live] as const,
  ([text, live], [oldText, wasLive]) => {
    if (live) {
      base = text;
      changed.value = new Set();
      return;
    }
    if (wasLive) liveEndedAt = Date.now();
    if (base && text !== oldText && Date.now() - liveEndedAt < CORRECTION_WINDOW_MS) {
      changed.value = changedWords(base, text);
      base = text;
      clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(() => (changed.value = new Set()), 2200);
    }
  },
);

const words = computed(() => props.text.split(/\s+/).filter(Boolean));

/** Indexes of words in `after` that are not part of the longest common run of words with `before`. */
function changedWords(before: string, after: string): Set<number> {
  const a = before.toLowerCase().split(/\s+/).filter(Boolean);
  const b = after.toLowerCase().split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const kept = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      kept.add(j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return new Set(b.map((_, j) => j).filter((j) => !kept.has(j)));
}
</script>

<template>
  <p class="live-text" :class="{ live, empty: !text }">
    <template v-if="text">
      <span
        v-for="(word, i) in words"
        :key="i"
        :class="{ changed: changed.has(i) }"
        >{{ word }}{{ " " }}</span
      >
    </template>
    <template v-else>{{ placeholder }}</template>
  </p>
</template>

<style scoped>
.live-text {
  margin: 0;
  font-size: var(--card-text);
  line-height: 1.45;
  min-height: 3em;
  overflow-wrap: anywhere;
  transition: color 300ms ease;
}
.live-text.live {
  color: var(--muted);
}
.live-text.empty {
  color: var(--faint);
}
.changed {
  background: var(--highlight);
  border-radius: 6px;
  animation: fade 2.2s ease-out forwards;
}
@keyframes fade {
  0%,
  40% {
    background: var(--highlight);
  }
  100% {
    background: transparent;
  }
}
</style>
