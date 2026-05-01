export type ChatReadDetail = {
  roomId?: string | null;
  unreadCount?: number | null;
  readAt?: string | null;
};

const CHAT_READ_STORAGE_KEY = "nexora:chat-read-state";

function normalizeRoomId(roomId?: string | null) {
  return String(roomId || "").trim();
}

function safeTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function readStoredChatReads() {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CHAT_READ_STORAGE_KEY) || "{}"
    ) as Record<string, string>;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredChatReads(value: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CHAT_READ_STORAGE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function rememberClientChatRead(detail: ChatReadDetail) {
  const roomId = normalizeRoomId(detail.roomId);
  const readAt = String(detail.readAt || new Date().toISOString()).trim();

  if (!roomId || !readAt) {
    return null;
  }

  const stored = readStoredChatReads();
  const currentTime = safeTime(stored[roomId]);
  const nextTime = safeTime(readAt);

  if (!currentTime || nextTime >= currentTime) {
    stored[roomId] = readAt;
    writeStoredChatReads(stored);
  }

  return {
    ...detail,
    roomId,
    readAt: stored[roomId] || readAt,
    unreadCount: Math.max(1, Number(detail.unreadCount || 1)),
  } satisfies ChatReadDetail;
}

export function dispatchClientChatRead(detail: ChatReadDetail) {
  if (typeof window === "undefined") {
    return;
  }

  const nextDetail = rememberClientChatRead(detail);
  if (!nextDetail) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("nexora:chat-read", {
      detail: nextDetail,
    })
  );
}

export function getClientChatReadAt(...roomIds: Array<string | null | undefined>) {
  const stored = readStoredChatReads();

  return roomIds
    .map((roomId) => stored[normalizeRoomId(roomId)] || "")
    .filter(Boolean)
    .sort((a, b) => safeTime(b) - safeTime(a))[0] || "";
}

export function isClientChatRead(
  roomIds: Array<string | null | undefined>,
  lastMessageAt?: string | null
) {
  const readAt = getClientChatReadAt(...roomIds);
  if (!readAt) {
    return false;
  }

  const lastMessageTime = safeTime(lastMessageAt);
  if (!lastMessageTime) {
    return true;
  }

  return safeTime(readAt) >= lastMessageTime;
}
