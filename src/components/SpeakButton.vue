<script setup lang="ts">
import Icon from "./Icon.vue";
import { speak } from "../speech";
import type { Lang } from "../types";

const props = defineProps<{ text: string; lang: Lang; size?: "small" | "large" }>();
</script>

<template>
  <button
    type="button"
    class="icon-button speak"
    :class="size ?? 'large'"
    :disabled="!props.text.trim()"
    aria-label="Read aloud"
    @mousedown.prevent
    @click.stop="speak(props.text, props.lang)"
  >
    <Icon name="speaker" :size="size === 'small' ? 22 : 30" />
  </button>
</template>
