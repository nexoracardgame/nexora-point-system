let lastPlayed = -Infinity;
const sounds = new Map<string, HTMLAudioElement>();

export function playGameUiSound(kind: "click" | "confirm" | "back" = "click") {
  if (typeof window === "undefined" || document.hidden) return;
  try { if (localStorage.getItem("triad-battle-muted") === "1") return; } catch { /* Optional preference. */ }
  const now = performance.now();
  if (now - lastPlayed < 90) return;
  lastPlayed = now;
  const file = { click: "click_003", confirm: "confirmation_002", back: "back_001" }[kind];
  let sound = sounds.get(file);
  if (!sound) { sound = new Audio(`/audio/ui/${file}.ogg`); sound.preload = "auto"; sounds.set(file, sound); }
  sound.volume = .16;
  sound.currentTime = 0;
  void sound.play().catch(() => { /* Browsers may deny audio until interaction. */ });
}
