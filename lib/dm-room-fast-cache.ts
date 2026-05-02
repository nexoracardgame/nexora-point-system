import { readChatHistoryCache, writeChatHistoryCache } from "@/lib/chat-history-cache";
import {
  CHAT_HISTORY_PAGE_SIZE,
  buildChatUser,
  mergeChatMessages,
  normalizeChatMessage,
  type ChatMessage,
  type ChatUser,
} from "@/lib/chat-room-types";

type CacheUserInput = {
  id?: string | null;
  name?: string | null;
  image?: string | null;
} | null;

export type DmRoomFastCacheMeta = {
  me?: CacheUserInput;
  other?: CacheUserInput;
  hasMore?: boolean;
  nextCursor?: string | null;
  [key: string]: unknown;
};

export type DmRealtimeCacheMessage = {
  id?: string | number | null;
  roomId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
  optimistic?: boolean;
  sender?: CacheUserInput;
};

function safeText(value?: string | number | null) {
  return String(value || "").trim();
}

function uniqueRoomIds(roomIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(roomIds.map((roomId) => safeText(roomId)).filter(Boolean))
  );
}

function normalizeCacheUser(input: CacheUserInput | undefined, fallbackName: string) {
  if (input === undefined) {
    return undefined;
  }

  if (!input) {
    return null;
  }

  const id = safeText(input.id);
  const name = safeText(input.name);
  const image = safeText(input.image);

  if (!id && !name && !image) {
    return null;
  }

  return buildChatUser(id, name, image, fallbackName);
}

function mergeCacheMeta(
  existing?: DmRoomFastCacheMeta | null,
  next?: DmRoomFastCacheMeta | null
): DmRoomFastCacheMeta {
  const merged: DmRoomFastCacheMeta = {
    ...(existing || {}),
    ...(next || {}),
  };
  const nextMe = normalizeCacheUser(next?.me, "You");
  const nextOther = normalizeCacheUser(next?.other, "User");
  const existingMe = normalizeCacheUser(existing?.me, "You");
  const existingOther = normalizeCacheUser(existing?.other, "User");

  if (nextMe !== undefined) {
    merged.me = nextMe;
  } else if (existingMe !== undefined) {
    merged.me = existingMe;
  }

  if (nextOther !== undefined) {
    merged.other = nextOther;
  } else if (existingOther !== undefined) {
    merged.other = existingOther;
  }

  if (next?.hasMore === undefined && existing?.hasMore !== undefined) {
    merged.hasMore = existing.hasMore;
  }

  if (next?.nextCursor === undefined && existing?.nextCursor !== undefined) {
    merged.nextCursor = existing.nextCursor;
  }

  return merged;
}

function buildCacheMessage(
  message: DmRealtimeCacheMessage,
  roomId: string,
  me?: ChatUser | null,
  other?: ChatUser | null
) {
  const id = safeText(message.id);
  if (!id || !roomId) {
    return null;
  }

  return normalizeChatMessage(
    {
      id,
      roomId,
      senderId: safeText(message.senderId),
      senderName: safeText(message.senderName) || null,
      senderImage: safeText(message.senderImage) || null,
      content: safeText(message.content) || null,
      imageUrl: safeText(message.imageUrl) || null,
      createdAt: safeText(message.createdAt) || new Date().toISOString(),
      seenAt: safeText(message.seenAt) || null,
      sender: normalizeCacheUser(message.sender, "User") || undefined,
      optimistic: Boolean(message.optimistic),
    },
    roomId,
    me,
    other
  );
}

export function primeDmRoomFastCache(
  roomId: string,
  meta?: DmRoomFastCacheMeta | null
) {
  const safeRoomId = safeText(roomId);
  if (!safeRoomId) {
    return;
  }

  const existing = readChatHistoryCache<ChatMessage, DmRoomFastCacheMeta>(
    "dm-room",
    safeRoomId
  );
  const nextMeta = mergeCacheMeta(existing?.meta, meta);

  writeChatHistoryCache<ChatMessage, DmRoomFastCacheMeta>("dm-room", safeRoomId, {
    messages: Array.isArray(existing?.messages) ? existing.messages : [],
    meta: nextMeta,
    cachedAt: Date.now(),
  });
}

export function cacheRealtimeDmMessage(
  roomIds: Array<string | null | undefined>,
  message: DmRealtimeCacheMessage,
  meta?: DmRoomFastCacheMeta | null
) {
  const safeRoomIds = uniqueRoomIds([message?.roomId, ...roomIds]);
  if (safeRoomIds.length === 0) {
    return;
  }

  for (const safeRoomId of safeRoomIds) {
    const existing = readChatHistoryCache<ChatMessage, DmRoomFastCacheMeta>(
      "dm-room",
      safeRoomId
    );
    const nextMeta = mergeCacheMeta(existing?.meta, meta);
    const existingMessages = Array.isArray(existing?.messages)
      ? existing.messages
      : [];
    const nextMessage = buildCacheMessage(
      message,
      safeRoomId,
      nextMeta.me as ChatUser | null | undefined,
      nextMeta.other as ChatUser | null | undefined
    );
    const nextMessages = nextMessage
      ? mergeChatMessages(
          existingMessages,
          [nextMessage],
          safeRoomId,
          nextMeta.me as ChatUser | null | undefined,
          nextMeta.other as ChatUser | null | undefined
        ).slice(-CHAT_HISTORY_PAGE_SIZE)
      : existingMessages;

    writeChatHistoryCache<ChatMessage, DmRoomFastCacheMeta>("dm-room", safeRoomId, {
      messages: nextMessages,
      meta: nextMeta,
      cachedAt: Date.now(),
    });
  }
}
