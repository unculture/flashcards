import { onBeforeUnmount, onMounted, ref } from "vue";

export type Route =
  | { name: "home" }
  | { name: "newDeck" }
  | { name: "settings" }
  | { name: "deck"; deckId: string }
  | { name: "make"; deckId: string; cardId?: string }
  | { name: "practice"; deckId: string }
  | { name: "print"; deckId: string }
  | { name: "describe"; deckId: string };

export const route = ref<Route>({ name: "home" });

export function go(to: Route) {
  route.value = to;
}

/**
 * Space bar works like the microphone button: press to start, press again to
 * stop. Holding it down for longer than half a second works as push to talk.
 * Ignored while a text field has focus.
 */
export function useSpaceToTalk(onPress: () => void) {
  let downAt = 0;
  const typing = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

  const down = (e: KeyboardEvent) => {
    if (e.code !== "Space" || typing(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    downAt = Date.now();
    onPress();
  };
  const up = (e: KeyboardEvent) => {
    if (e.code !== "Space" || typing(e) || !downAt) return;
    e.preventDefault();
    if (Date.now() - downAt > 500) onPress();
    downAt = 0;
  };
  onMounted(() => {
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
  });
}
