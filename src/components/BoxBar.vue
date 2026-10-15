<script setup lang="ts">
import { computed } from "vue";
import { boxCounts } from "../library";
import type { Deck } from "../types";

// Five columns, one for each Leitner box. Cards climb to the right as she
// learns them.
const props = defineProps<{ deck: Deck; large?: boolean }>();
const counts = computed(() => boxCounts(props.deck));
const most = computed(() => Math.max(1, ...counts.value));
</script>

<template>
  <div class="boxes" :class="{ large }" :aria-label="`Cards in each box: ${counts.join(', ')}`">
    <div v-for="(n, i) in counts" :key="i" class="box">
      <div class="column">
        <div class="fill" :class="`b${i + 1}`" :style="{ height: (n / most) * 100 + '%' }" />
      </div>
      <span v-if="large" class="n">{{ n }}</span>
    </div>
  </div>
</template>

<style scoped>
.boxes {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}
.box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}
.column {
  width: 100%;
  height: 34px;
  border-radius: 6px;
  background: var(--line);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.large .column {
  height: 80px;
}
.fill {
  width: 100%;
  min-height: 0;
  transition: height 400ms ease;
}
.b1 { background: #e9b872; }
.b2 { background: #d9c46a; }
.b3 { background: #a8c66c; }
.b4 { background: #74b37a; }
.b5 { background: #4f9d7e; }
.n {
  font-size: 1rem;
  color: var(--muted);
}
</style>
