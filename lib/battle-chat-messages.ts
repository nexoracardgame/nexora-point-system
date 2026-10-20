export type BattleChatMessage = { id: string; senderId: string; senderName: string; text: string; createdAt?: number };
export type BattleChatRoom = { mode: "triad" | "pentad" | "heptad"; code: string };
export const BATTLE_CHAT_CHANGED = "nexora:battle-chat-changed";

export function mergeBattleChatMessages(...groups: BattleChatMessage[][]) {
  const unique = new Map<string, BattleChatMessage>();
  for (const messages of groups) for (const message of messages) {
    if (message.id && !message.id.startsWith("local-")) unique.set(message.id, message);
  }
  return [...unique.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(-80);
}

export type PendingBattleChat = BattleChatMessage & { baseline: Set<string>; failed?: boolean };
export type BattleChatDelivery = { key: string; pending: PendingBattleChat[]; aliases: Record<string, { id: string; createdAt?: number }> };

// Keep each optimistic row's identity after acknowledgement, including repeated text.
export function reconcileBattleChat(messages: BattleChatMessage[], delivery: BattleChatDelivery): BattleChatDelivery {
  const aliases = { ...delivery.aliases };
  let changed = false;
  const pending = delivery.pending.filter(item => {
    if (item.failed) return true;
    const echo = messages.find(message => !aliases[message.id] && !item.baseline.has(message.id) && message.senderId === item.senderId && message.text.trim().replace(/\s+/g, " ") === item.text);
    if (!echo) return true;
    aliases[echo.id] = { id: item.id, createdAt: item.createdAt };
    changed = true;
    return false;
  });
  const retained = new Set(messages.map(message => message.id));
  for (const id of Object.keys(aliases)) if (!retained.has(id)) { delete aliases[id]; changed = true; }
  return changed ? { ...delivery, pending, aliases } : delivery;
}

export function deliveredBattleChat(messages: BattleChatMessage[], delivery: BattleChatDelivery) {
  return [...messages.map(message => delivery.aliases[message.id] ? { ...message, ...delivery.aliases[message.id] } : message), ...delivery.pending]
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(-80);
}
export function visibleBattleChat(messages: BattleChatMessage[], pending: PendingBattleChat[]) {
  return deliveredBattleChat(messages, reconcileBattleChat(messages, { key: "", pending, aliases: {} }));
}
