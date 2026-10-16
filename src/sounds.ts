import { library } from "./library";

// Short sounds for practice, made with the Web Audio API so there are no
// sound files. "Got it" is a bright rising chime. "Not yet" is two soft,
// low falling notes: clearly different, but gentle, never a buzzer.

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Plays one note with a soft attack and a bell-like fade. */
function note(ctx: AudioContext, freq: number, start: number, length: number, volume: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** `always` plays it even with sounds off, for the Settings preview. */
export function playRight(always = false) {
  if (!always && !library.settings.sounds) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  // C, E, G, then C an octave up.
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    note(ctx, freq, t + i * 0.075, 0.45, 0.18, "sine");
    note(ctx, freq * 2, t + i * 0.075, 0.2, 0.03, "sine");
  });
}

export function playNotYet(always = false) {
  if (!always && !library.settings.sounds) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  // G down to E, low and soft.
  note(ctx, 392.0, t, 0.35, 0.16, "triangle");
  note(ctx, 329.63, t + 0.2, 0.5, 0.16, "triangle");
}
