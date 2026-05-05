import { writeChatHistoryCache } from "@/lib/chat-history-cache";
import type { ChatMessage, ChatUser } from "@/lib/chat-room-types";

type DirectRoomMeta = {
  me?: ChatUser | null;
  other?: ChatUser | null;
  hasMore?: boolean;
  nextCursor?: string | null;
};

type DealRoomMeta = DirectRoomMeta & {
  roomId?: string;
  card?: {
    id: string;
    no: string;
    name: string;
    image: string;
    listedPrice: number;
  } | null;
  deal?: {
    id: string;
    offeredPrice: number;
    mode?: "sell" | "buy";
  } | null;
};

type DirectRoomPayload = {
  roomId: string;
  messages?: ChatMessage[];
  me?: ChatUser | null;
  other?: ChatUser | null;
  hasMore?: boolean;
  nextCursor?: string | null;
};

type DealRoomPayload = {
  roomId: string;
  messages?: ChatMessage[];
  me?: ChatUser | null;
  other?: ChatUser | null;
  card?: DealRoomMeta["card"];
  deal?: DealRoomMeta["deal"];
  hasMore?: boolean;
  nextCursor?: string | null;
};

async function prefetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    cache: "no-store",
    ...init,
  }).catch(() => null);

  if (!res?.ok) {
    return null;
  }

  return (await res.json().catch(() => null)) as T | null;
}

export async function prefetchDirectChatRoom(roomId: string) {
  const safeRoomId = String(roomId || "").trim();
  if (!safeRoomId) return null;

  const payload = await prefetchJson<DirectRoomPayload>(
    `/api/dm/bootstrap?roomId=${encodeURIComponent(safeRoomId)}`
  );

  if (!payload?.roomId) {
    return null;
  }

  const cachePayload = {
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    meta: {
      me: payload.me || null,
      other: payload.other || null,
      hasMore: Boolean(payload.hasMore),
      nextCursor: String(payload.nextCursor || "").trim() || null,
    },
    cachedAt: Date.now(),
  };

  writeChatHistoryCache<ChatMessage, DirectRoomMeta>(
    "dm-room",
    payload.roomId,
    cachePayload
  );

  if (payload.roomId !== safeRoomId) {
    writeChatHistoryCache<ChatMessage, DirectRoomMeta>(
      "dm-room",
      safeRoomId,
      cachePayload
    );
  }

  return payload;
}

export async function prefetchDealChatRoom(dealId: string) {
  const safeDealId = String(dealId || "").trim();
  if (!safeDealId) return null;

  const payload = await prefetchJson<DealRoomPayload>(
    `/api/market/deal-chat/bootstrap?dealId=${encodeURIComponent(safeDealId)}`
  );

  if (!payload?.roomId) {
    return null;
  }

  writeChatHistoryCache<ChatMessage, DealRoomMeta>("deal-room", safeDealId, {
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    meta: {
      roomId: payload.roomId,
      me: payload.me || null,
      other: payload.other || null,
      card: payload.card || null,
      deal: payload.deal || null,
      hasMore: Boolean(payload.hasMore),
      nextCursor: String(payload.nextCursor || "").trim() || null,
    },
    cachedAt: Date.now(),
  });

  return payload;
}
