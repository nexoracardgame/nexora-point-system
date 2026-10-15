export const BATTLE_CONTACT_MS = 1100;
export const BATTLE_HIT_STOP_MS = 120;
export const BATTLE_MOTION_MS = 2400;

export function battleStepDuration(kind: "intro" | "skill" | "strike" | "result", reduced: boolean, summaryLength = 0) {
  const skillTime = Math.max(3500, Math.min(7000, summaryLength * 35));
  return { intro: reduced ? 1200 : 2400, skill: skillTime, strike: 3200, result: 4000 }[kind];
}
