import { reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";

// Checks GitHub for a newer release when the app starts, then once a day.
// There is no self-updater: the banner opens the installer download.

interface Update {
  version: string;
  downloadUrl: string;
  releaseUrl: string;
}

export const update = reactive({
  available: null as Update | null,
  /** "Not now" hides the banner until the app starts again. */
  dismissed: false,
});

const DAY = 24 * 60 * 60 * 1000;

export function startUpdateChecks() {
  if (import.meta.env.DEV) return;
  check();
  window.setInterval(check, DAY);
}

async function check() {
  try {
    update.available = await invoke<Update | null>("check_for_update");
  } catch (err) {
    // Offline, or GitHub is busy. Try again tomorrow.
    console.warn("update check failed:", err);
  }
}

export function downloadUpdate() {
  if (update.available) invoke("open_release_url", { url: update.available.downloadUrl }).catch(() => {});
}
