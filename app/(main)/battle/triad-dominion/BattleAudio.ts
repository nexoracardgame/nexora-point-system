import type { TriadElement } from "@/lib/triad-dominion";
import { BATTLE_CONTACT_MS } from "./BattleTiming";
import { playGameUiSound } from "@/lib/game-ui-audio";

const clips = {
  fire: "impactPunch_heavy_000", water: "impactGlass_medium_000", wood: "impactPlank_medium_000",
  earth: "impactMining_000", gold: "impactMetal_heavy_000", unknown: "impactGeneric_light_000", guard: "impactBell_heavy_000",
} as const;
let audio: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;

export function battleAudioReady() { return audio?.state === "running"; }

export function playMenuCue() {
  playGameUiSound();
}

export async function primeBattleAudio() {
  try {
    if (!audio || audio.state === "closed") {
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return false;
      audio = new Constructor();
      audio.addEventListener("statechange", () => window.dispatchEvent(new Event("triad-audio-ready")));
    }
    if (audio.state !== "running") await audio.resume();
    const context = audio;
    if (!loading) {
      loading = Promise.all(Object.values(clips).map(async name => {
        try {
          const response = await fetch(`/battle-fx/audio/${name}.wav`);
          if (!response.ok) return;
          buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
        } catch { /* A missing clip must never interrupt a turn. */ }
      })).then(() => {});
    }
    window.dispatchEvent(new Event("triad-audio-ready"));
    return context.state === "running";
  } catch { return false; }
}

export function playBattleSequence({ element, kind, side, blocked, draw, reduced }: {
  element: TriadElement; kind: "skill" | "strike" | "result"; side: "player" | "opponent"; blocked: boolean; draw: boolean; reduced: boolean;
}) {
  const context = audio;
  if (!context || context.state !== "running") return () => {};
  const start = context.currentTime;
  const sources: Array<AudioBufferSourceNode | OscillatorNode> = [];
  const gains: GainNode[] = [];
  const panners: StereoPannerNode[] = [];
  const connect = (source: AudioBufferSourceNode | OscillatorNode, volume: number, pan: number) => {
    const gain = context.createGain(); gain.gain.value = volume;
    const panner = context.createStereoPanner(); panner.pan.value = pan;
    source.connect(gain).connect(panner).connect(context.destination);
    sources.push(source); gains.push(gain); panners.push(panner);
    return gain;
  };
  const tone = (frequency: number, endFrequency: number, when: number, duration: number, volume: number, pan = 0) => {
    const source = context.createOscillator(); source.type = "sine";
    source.frequency.setValueAtTime(frequency, when);
    source.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
    const gain = connect(source, 0, pan);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(volume, when + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.start(when); source.stop(when + duration);
  };
  const pan = side === "player" ? -.3 : .3;
  if (kind === "result") {
    (draw ? [220, 277] : [330, 440, 660]).forEach((note, i) => tone(note, note, start + i * .09, .35, .035));
  } else {
    const hitAt = start + (reduced ? .25 : BATTLE_CONTACT_MS / 1000);
    if (!reduced) {
      // The filtered sweep follows the card; the impact is scheduled on its contact frame.
      const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .32), context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(i / data.length * Math.PI);
      const source = context.createBufferSource(); source.buffer = noise;
      const filter = context.createBiquadFilter(); filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, start + .12);
      filter.frequency.exponentialRampToValueAtTime(2200, hitAt);
      const gain = connect(source, .06, pan);
      source.disconnect(); source.connect(filter).connect(gain);
      source.addEventListener("ended", () => filter.disconnect(), { once: true });
      source.start(start + .70);
      if (kind === "skill") tone(180, 580, start, .95, .025, pan);
    }
    const buffer = buffers.get(clips[blocked ? "guard" : element]);
    if (buffer) {
      const source = context.createBufferSource(); source.buffer = buffer;
      source.playbackRate.value = blocked ? 1.15 : element === "earth" ? .8 : element === "water" ? 1.1 : 1;
      connect(source, blocked ? .18 : .24, -pan); source.start(hitAt);
    }
    tone(blocked ? 220 : element === "earth" ? 70 : 100, blocked ? 440 : 35, hitAt, .25, .07, -pan);
  }
  return () => {
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); }
    for (const gain of gains) gain.disconnect();
    for (const panner of panners) panner.disconnect();
  };
}
