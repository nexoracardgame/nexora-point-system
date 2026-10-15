export type BattleForfeit = {
  at: number;
  winner: { id: string; name: string; image: string };
  loser: { id: string; name: string; image: string };
};

export function normalizeBattleForfeit(value: unknown): BattleForfeit | undefined {
  if (!value || typeof value !== "object") return;
  const raw = value as Partial<BattleForfeit>;
  if (!Number.isFinite(raw.at) || !raw.winner || !raw.loser) return;
  if (![raw.winner, raw.loser].every(player => typeof player.id === "string" && typeof player.name === "string" && typeof player.image === "string")) return;
  return { at: raw.at!, winner: raw.winner, loser: raw.loser };
}
