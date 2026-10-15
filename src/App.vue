<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

const greetMsg = ref("");

async function greet() {
  greetMsg.value = await invoke("greet", { name: "Flashcards" });
}
</script>

<template>
  <main>
    <h1>Flashcards</h1>
    <button @click="greet">Check the Rust back end</button>
    <p>{{ greetMsg }}</p>
  </main>
</template>
