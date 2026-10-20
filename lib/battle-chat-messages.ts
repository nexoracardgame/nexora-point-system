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
export function visibleBattleChat(messages: BattleChatMessage[], pending: PendingBattleChat[]) {
  const matched = new Set<string>();
  return [...messages, ...pending.filter(item => {
    const echo = messages.find(message => !item.baseline.has(message.id) && !matched.has(message.id) && message.senderId === item.senderId && message.text.trim().replace(/\s+/g, " ") === item.text);
    if (echo) { matched.add(echo.id); return false; }
    return true;
  })].slice(-40);
}
