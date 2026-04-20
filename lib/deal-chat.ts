export const DEAL_CHAT_ROOM_PREFIX = "deal:";

export function getDealChatRoomId(dealId: string) {
  return `${DEAL_CHAT_ROOM_PREFIX}${String(dealId || "").trim()}`;
}

export function isDealChatRoomId(roomId?: string | null) {
  return String(roomId || "").startsWith(DEAL_CHAT_ROOM_PREFIX);
}

export function safeDealChatName(name?: string | null, fallback = "User") {
  const value = String(name || "").trim();
  return value || fallback;
}

export function safeDealChatImage(image?: string | null, fallback = "/avatar.png") {
  const value = String(image || "").trim();
  return value || fallback;
}
