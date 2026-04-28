export const CHAT_HISTORY_PAGE_SIZE = 80;

export type ChatUser = {
  id: string;
  name: string;
  image: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  sender?: ChatUser;
  optimistic?: boolean;
};

export type ChatHistoryPage = {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

type ChatIdentity = {
  id?: string | null;
  name?: string | null;
  image?: string | null;
} | null;

function safeTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function safeText(value?: string | null) {
  return String(value || "").trim();
}

function hasImage(message?: ChatMessage | null) {
  return Boolean(safeText(message?.imageUrl));
}

function isLikelyOptimisticReplacement(
  existing: ChatMessage,
  incoming: ChatMessage
) {
  if (!existing.optimistic || incoming.optimistic) {
    return false;
  }

  if (
    safeText(existing.roomId) !== safeText(incoming.roomId) ||
    safeText(existing.senderId) !== safeText(incoming.senderId)
  ) {
    return false;
  }

  const textMatches = safeText(existing.content) === safeText(incoming.content);
  const imageMatches = hasImage(existing) && hasImage(incoming);

  if (!textMatches && !imageMatches) {
    return false;
  }

  return Math.abs(safeTime(existing.createdAt) - safeTime(incoming.createdAt)) <= 120000;
}

export function buildChatUser(
  id?: string | null,
  name?: string | null,
  image?: string | null,
  fallbackName = "User"
): ChatUser {
  return {
    id: String(id || "").trim(),
    name: String(name || "").trim() || fallbackName,
    image: String(image || "").trim() || "/avatar.png",
  };
}

export function buildChatSender(
  senderId: string,
  input?: { senderName?: string | null; senderImage?: string | null },
  me?: ChatIdentity,
  other?: ChatIdentity
) {
  const isMine = senderId === String(me?.id || "").trim();

  if (isMine) {
    return buildChatUser(
      senderId,
      me?.name || input?.senderName,
      me?.image || input?.senderImage,
      "You"
    );
  }

  return buildChatUser(
    senderId,
    other?.name || input?.senderName,
    other?.image || input?.senderImage,
    "User"
  );
}

export function normalizeChatMessage(
  message: ChatMessage,
  roomId: string,
  me?: ChatIdentity,
  other?: ChatIdentity
): ChatMessage {
  return {
    ...message,
    roomId: String(message.roomId || roomId || "").trim(),
    sender: message.sender
      ? buildChatUser(message.sender.id, message.sender.name, message.sender.image)
      : buildChatSender(
          String(message.senderId || "").trim(),
          {
            senderName: message.senderName,
            senderImage: message.senderImage,
          },
          me,
          other
        ),
  };
}

export function sortChatMessages<T extends ChatMessage>(messages: T[]) {
  return [...messages].sort((a, b) => {
    const timeDiff = safeTime(a.createdAt) - safeTime(b.createdAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    const optimisticDiff = Number(Boolean(a.optimistic)) - Number(Boolean(b.optimistic));
    if (optimisticDiff !== 0) {
      return optimisticDiff;
    }

    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function mergeChatMessages<T extends ChatMessage>(
  prev: T[],
  incoming: T[],
  roomId: string,
  me?: ChatIdentity,
  other?: ChatIdentity
) {
  const nextById = new Map<string, T>();

  for (const message of prev) {
    if (!message?.id) continue;
    nextById.set(message.id, normalizeChatMessage(message, roomId, me, other) as T);
  }

  for (const message of incoming) {
    if (!message?.id) continue;

    const normalized = normalizeChatMessage(message, roomId, me, other) as T;
    const existing = nextById.get(normalized.id);

    if (!existing) {
      for (const [existingId, existingMessage] of nextById.entries()) {
        if (isLikelyOptimisticReplacement(existingMessage, normalized)) {
          nextById.delete(existingId);
          break;
        }
      }
    }

    nextById.set(
      normalized.id,
      existing
        ? ({
            ...existing,
            ...normalized,
            optimistic: Boolean(normalized.optimistic),
            seenAt: normalized.seenAt || existing.seenAt || null,
          } as T)
        : normalized
    );
  }

  return sortChatMessages(Array.from(nextById.values()));
}

export function mergeSingleChatMessage<T extends ChatMessage>(
  prev: T[],
  incoming: T,
  roomId: string,
  me?: ChatIdentity,
  other?: ChatIdentity
) {
  return mergeChatMessages(prev, [incoming], roomId, me, other);
}

export function removeChatMessage<T extends ChatMessage>(prev: T[], messageId: string) {
  return prev.filter((message) => message.id !== messageId);
}
