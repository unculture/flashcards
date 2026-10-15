<script setup lang="ts">
import { computed } from "vue";
import Icon from "./Icon.vue";
import { canSpeak, speak, stopSpeaking, voice } from "../voice";
import type { Lang } from "../types";

// Reads the text aloud. Tapping it again while it plays stops it.
const props = defineProps<{ text: string; lang: Lang; size?: "small" | "large" }>();

const loading = computed(() => voice.loading === props.text);
const playing = computed(() => voice.playing === props.text);

function press() {
  if (loading.value || playing.value) stopSpeaking();
  else speak(props.text, props.lang);
}
</script>

<template>
  <button
    v-if="canSpeak()"
    type="button"
    class="icon-button speak"
    :class="[size ?? 'large', { loading, playing }]"
    :disabled="!props.text.trim()"
    :aria-label="playing ? 'Stop reading' : 'Read aloud'"
    @mousedown.prevent
    @click.stop="press"
  >
    <Icon :name="playing ? 'stop' : 'speaker'" :size="size === 'small' ? 22 : 30" />
  </button>
</template>

<style scoped>
.speak.loading {
  animation: pulse 1s ease-in-out infinite;
}
.speak.playing {
  background: var(--accent-wash);
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
