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

    nextById.set(
      normalized.id,
      existing
        ? ({
            ...existing,
            ...normalized,
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
