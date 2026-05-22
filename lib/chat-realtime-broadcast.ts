import type { ChatMessage } from "@/lib/chat-room-types";

export const CHAT_MESSAGE_BROADCAST_EVENT = "message";

export type ChatRealtimeBroadcastPayload = {
  id?: string | number | null;
  roomId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
  sender?: ChatMessage["sender"];
  optimistic?: boolean | null;
  roomIds?: Array<string | null | undefined> | null;
  isMine?: boolean | null;
  source?: string | null;
};

function safeTopicPart(value?: string | number | null) {
  return encodeURIComponent(String(value || "").trim());
}

export function getChatRoomBroadcastTopic(roomId?: string | number | null) {
  const safeRoomId = safeTopicPart(roomId);
  return safeRoomId ? `nexora-chat-room:${safeRoomId}` : "";
}

export function getChatUserBroadcastTopic(userId?: string | number | null) {
  const safeUserId = safeTopicPart(userId);
  return safeUserId ? `nexora-chat-user:${safeUserId}` : "";
}
