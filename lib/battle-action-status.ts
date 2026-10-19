const expiredReasons = new Set(["stale_round", "stale_deck_session", "stale_skill_choice", "turn_expired", "already_resolved"]);

export function isExpiredBattleAction(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const data = value as { reason?: unknown; code?: unknown; error?: unknown; message?: unknown };
  return expiredReasons.has(String(data.reason || data.code || "")) ||
    data.error === "คำสั่งนี้เป็นของตาก่อนหน้า" || data.message === "คำสั่งนี้เป็นของตาก่อนหน้า";
}

export class ExpiredBattleActionError extends Error {
  readonly code = "stale_round";
  constructor() {
    super("คำสั่งนี้เป็นของตาก่อนหน้า");
    this.name = "ExpiredBattleActionError";
  }
}
