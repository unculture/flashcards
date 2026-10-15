<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

// The only place with a text field, so the on-screen keyboard opens only
// when she asks to type.
const props = defineProps<{ title: string; text: string }>();
const emit = defineEmits<{ done: [text: string]; cancel: [] }>();

const value = ref(props.text);
const field = ref<HTMLTextAreaElement>();

onMounted(async () => {
  await nextTick();
  field.value?.focus();
  field.value?.setSelectionRange(value.value.length, value.value.length);
});

function onKey(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    emit("done", value.value.trim());
  } else if (e.key === "Escape") {
    emit("cancel");
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="dialog">
      <h2>{{ title }}</h2>
      <textarea ref="field" v-model="value" rows="3" spellcheck="true" @keydown="onKey" />
      <div class="row end">
        <button type="button" class="button quiet" @click="emit('cancel')">Cancel</button>
        <button type="button" class="button primary" @click="emit('done', value.trim())">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(30, 35, 45, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 6vh 16px;
  z-index: 10;
}
.dialog {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px;
  width: min(720px, 100%);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}
h2 {
  margin: 0 0 12px;
}
textarea {
  width: 100%;
  font: inherit;
  font-size: var(--card-text);
  line-height: 1.4;
  padding: 12px 14px;
  border-radius: 12px;
  border: 2px solid var(--line);
  background: var(--bg);
  color: var(--text);
  resize: vertical;
}
textarea:focus {
  outline: none;
  border-color: var(--accent);
}
.row {
  margin-top: 16px;
}
</style>
