<script setup lang="ts">
// Line icons on a 24-unit grid, drawn with the current text colour.
const PATHS = {
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M19 11a7 7 0 0 1-14 0 M12 18v3",
  stop: "M7 7h10v10H7z",
  back: "M15 5l-7 7 7 7",
  pencil: "M4 20h4L19 9l-4-4L4 16v4z M13.5 6.5l4 4",
  trash: "M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13",
  plus: "M12 5v14 M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  keyboard: "M3 7h18v11H3z M7 11h.01 M11 11h.01 M15 11h.01 M8 15h8",
  redo: "M4 12a8 8 0 1 0 2.4-5.7 M4 4v4.5h4.5",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4z",
  cards: "M8 4h11v14H8z M5 7v13h11",
  close: "M6 6l12 12 M18 6L6 18",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  skip: "M5 5l8 7-8 7z M17 5v14",
  speaker: "M4 9v6h4l5 4V5L8 9H4z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12",
  save: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  open: "M12 20V9 M7 14l5-5 5 5 M5 4h14",
  printer: "M7 9V3h10v6 M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3 M7 14h10v7H7z",
} as const;

export type IconName = keyof typeof PATHS;

defineProps<{ name: IconName; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 28"
    :height="size ?? 28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
