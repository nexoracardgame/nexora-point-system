export const DEAL_CHAT_ROOM_PREFIX = "deal:";

export function getDealChatRoomId(dealId: string) {
  return `${DEAL_CHAT_ROOM_PREFIX}${String(dealId || "").trim()}`;
}

export function isDealChatRoomId(roomId?: string | null) {
  return String(roomId || "").startsWith(DEAL_CHAT_ROOM_PREFIX);
}
