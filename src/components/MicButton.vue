<script setup lang="ts">
import { computed } from "vue";
import Icon from "./Icon.vue";
import { dictation } from "../speech";

// The big round button. It does not hold focus, so tapping it never opens
// the on-screen keyboard.
const props = defineProps<{ active: boolean; disabled?: boolean }>();
defineEmits<{ press: [] }>();

const recording = computed(() => props.active && dictation.state === "recording");
const busy = computed(
  () => props.active && (dictation.state === "starting" || dictation.state === "finishing"),
);
const label = computed(() => {
  if (busy.value) return dictation.state === "starting" ? "Getting ready" : "Writing it down";
  return recording.value ? "Tap to stop" : "Tap to talk";
});
// The ring grows with the microphone level, so she can see that it hears her.
const ringScale = computed(() => (recording.value ? 1 + dictation.level * 0.45 : 1));
</script>

<template>
  <div class="mic">
    <button
      type="button"
      class="mic-button"
      :class="{ recording, busy }"
      :disabled="disabled || busy"
      :aria-label="label"
      @mousedown.prevent
      @click="$emit('press')"
    >
      <span class="ring" :style="{ transform: `scale(${ringScale})` }" />
      <Icon :name="recording ? 'stop' : 'mic'" :size="44" />
    </button>
    <span class="mic-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.mic {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.mic-button {
  position: relative;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(44, 92, 143, 0.3);
  touch-action: manipulation;
}
.mic-button > svg {
  position: relative;
}
.mic-button.recording {
  background: var(--record);
  box-shadow: 0 6px 18px rgba(196, 84, 60, 0.35);
}
.mic-button.busy {
  background: var(--muted);
  cursor: wait;
}
.mic-button:disabled:not(.busy) {
  opacity: 0.45;
  cursor: not-allowed;
}
.ring {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  border: 6px solid currentColor;
  opacity: 0;
  transition: transform 80ms linear;
}
.recording .ring {
  color: var(--record);
  opacity: 0.35;
}
.mic-label {
  font-size: 1.1rem;
  color: var(--muted);
}
</style>
