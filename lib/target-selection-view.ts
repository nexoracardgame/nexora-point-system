export type TargetFaction = "ally" | "enemy";
export type TargetCardView = { name: string; sourceImage: string; attack: number; support: number };
export type TargetOptionView = { id: string; faction: TargetFaction; label: string; card?: TargetCardView; note?: string; action?: boolean; disabled?: boolean };

// This projects already-resolved legal targets; it never invents game eligibility.
export function targetSelectionView(options: TargetOptionView[], selected: string[], min: number, max: number, sequences?: string[][]) {
  const eligible = options.filter(option => !option.disabled);
  const ids = new Set(eligible.map(option => option.id));
  const unique = [...new Set(selected)];
  const valid = unique.length === selected.length && unique.every(id => ids.has(id));
  const groups = (["ally", "enemy"] as const).map(faction => ({ faction, options: eligible.filter(option => option.faction === faction) })).filter(group => group.options.length);
  return { groups, mode: groups.length === 2 ? "BOTH" : groups[0]?.faction === "ally" ? "ALLY_ONLY" : groups.length ? "ENEMY_ONLY" : "NONE", canConfirm: valid && selected.length >= min && selected.length <= max && (!sequences || sequences.some(sequence => sequence.length === selected.length && sequence.every((id, i) => id === selected[i]))) };
}

export function toggleTargetSelection(selected: string[], id: string, max: number) {
  if (max === 1) return [id];
  if (selected.includes(id)) return selected.filter(value => value !== id);
  return selected.length < max ? [...selected, id] : [selected[0], id];
}
