"use client";

import {
  ArrowLeft,
  Bot,
  Flame,
  Handshake,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Minimize2,
  Search,
  Send,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ChatEmojiPicker from "@/components/ChatEmojiPicker";
import ChatMessageText from "@/components/ChatMessageText";
import ChatTypingIndicator from "@/components/ChatTypingIndicator";
import { useOnlinePresence } from "@/components/OnlinePresenceProvider";
import SafeCardImage from "@/components/SafeCardImage";
import { prepareChatImageFile } from "@/lib/chat-image-client";
import { dispatchClientChatRead } from "@/lib/chat-read-sync";
import { useChatTyping } from "@/lib/chat-typing-client";
import {
  buildChatUser,
  mergeChatMessages,
  mergeSingleChatMessage,
  normalizeChatMessage,
  reconcileRecentChatMessages,
  type ChatMessage,
  type ChatUser,
} from "@/lib/chat-room-types";
import type { DMRoomListItem } from "@/lib/dm-list";

type RoomFilter = "all" | "direct" | "deal";

type FloatingRoom = DMRoomListItem & {
  key: string;
};

type ActiveFloatingRoom = FloatingRoom & {
  actualRoomId: string;
  me: ChatUser | null;
  other: ChatUser | null;
  loading: boolean;
  hasMore: boolean;
  nextCursor: string | null;
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

type RealtimeChatDetail = Partial<ChatMessage> & {
  isMine?: boolean | null;
  roomIds?: Array<string | null | undefined> | null;
};

type ChatSeenDetail = {
  id?: string | number | null;
  messageId?: string | number | null;
  roomId?: string | null;
  roomIds?: Array<string | null | undefined> | null;
  readAt?: string | null;
  seenAt?: string | null;
  senderId?: string | null;
};

type OpenFloatingChatDetail = {
  kind?: "direct" | "deal" | null;
  roomId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userImage?: string | null;
  legacyRoomId?: string | null;
  dealId?: string | null;
  dealCardName?: string | null;
  dealCardImage?: string | null;
  dealCardNo?: string | null;
  dealPrice?: number | string | null;
  dealMode?: "sell" | "buy" | null;
};

const LIST_REFRESH_MS = 8500;
const ROOM_SYNC_MS = 2500;
const ROOM_CACHE_TTL_MS = 90000;
const ROOM_PREFETCH_COUNT = 8;
const ROOM_PREFETCH_LIMIT = 28;
const ROOM_OPEN_LIMIT = 42;
const BLAZE_AI_URL =
  "https://script.google.com/macros/s/AKfycbzPxJE0QCtFuv-4mCG91q1iBcxUZx_UJKkeAay2BEPYp0PFpM-EwAB4oIPH3QYYr8xR/exec";

type RoomLoadResult = {
  active: ActiveFloatingRoom;
  messages: ChatMessage[];
};

type RoomCacheEntry = RoomLoadResult & {
  fetchedAt: number;
};

type MessagePagePayload = {
  messages?: ChatMessage[];
  hasMore?: boolean;
  nextCursor?: string | null;
  error?: string;
};

function safeText(value?: string | number | null) {
  return String(value || "").trim();
}

function buildDirectRoomId(userA?: string | null, userB?: string | null) {
  return [safeText(userA), safeText(userB)].filter(Boolean).sort().join("__");
}

function roomKey(room: Pick<DMRoomListItem, "kind" | "roomId" | "dealId">) {
  if (room.kind === "deal") {
    return `deal:${safeText(room.dealId) || safeText(room.roomId)}`;
  }

  return `direct:${safeText(room.roomId)}`;
}

function normalizeRoom(room: DMRoomListItem): FloatingRoom | null {
  const key = roomKey(room);
  const safeRoomId = safeText(room.roomId);

  if (!key || !safeRoomId) {
    return null;
  }

  if (room.kind !== "deal" && safeRoomId.startsWith("deal:")) {
    return null;
  }

  return {
    ...room,
    key,
    roomId: safeRoomId,
    otherName: safeText(room.otherName) || "User",
    otherImage: safeText(room.otherImage) || "/avatar.png",
    lastMessage: safeText(room.lastMessage) || "เริ่มแชท",
    createdAt: safeText(room.createdAt) || new Date().toISOString(),
    unread: Math.max(0, Number(room.unread || 0)),
  };
}

function roomMatchesQuery(room: FloatingRoom, query: string) {
  const value = query.toLowerCase();

  if (!value) {
    return true;
  }

  return [
    room.otherName,
    room.lastMessage,
    room.dealCardName,
    room.sellerName,
    room.dealCardNo,
  ]
    .map((item) => safeText(item).toLowerCase())
    .some((item) => item.includes(value));
}

function formatActivityTime(value?: string | null) {
  const time = value ? new Date(value) : null;

  if (!time || Number.isNaN(time.getTime())) {
    return "";
  }

  return time.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value?: number | null) {
  const price = Number(value || 0);
  if (!price) return "";
  return `฿${price.toLocaleString("th-TH")}`;
}

function buildMessagePreview(content?: string | null, imageUrl?: string | null) {
  const text = safeText(content);
  if (text) {
    return text;
  }

  return safeText(imageUrl) ? "รูปภาพ" : "ข้อความใหม่";
}

function FloatingChatMessageSkeleton() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-end gap-4 py-1">
      {[0, 1, 2, 3].map((item) => {
        const mine = item % 2 === 1;
        return (
          <div
            key={item}
            className={`flex ${mine ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex max-w-[78%] items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine ? (
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
              ) : null}
              <div
                className={`h-11 animate-pulse rounded-[20px] bg-white/[0.075] ${
                  item === 0
                    ? "w-28"
                    : item === 1
                      ? "w-44"
                      : item === 2
                        ? "w-36"
                        : "w-52"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getReadRoomIds(room: ActiveFloatingRoom | FloatingRoom, actualRoomId: string) {
  return Array.from(
    new Set(
      [
        actualRoomId,
        room.roomId,
        room.kind === "deal" && room.dealId ? `deal:${room.dealId}` : "",
      ]
        .map((item) => safeText(item))
        .filter(Boolean)
    )
  );
}

function sameRoomEvent(active: ActiveFloatingRoom, detail: RealtimeChatDetail) {
  const primaryRoomId = safeText(detail.roomId);
  const primaryIsDeal = primaryRoomId.startsWith("deal:");
  const activeRoomIds = getReadRoomIds(active, active.actualRoomId);

  if (primaryIsDeal) {
    return active.kind === "deal" && activeRoomIds.includes(primaryRoomId);
  }

  if (active.kind === "deal") {
    return false;
  }

  const incomingRoomIds = new Set(
    [detail.roomId, ...(detail.roomIds || [])]
      .map((item) => safeText(item))
      .filter((item) => !item.startsWith("deal:"))
      .filter(Boolean)
  );

  return activeRoomIds.some((item) => incomingRoomIds.has(item));
}

function getRealtimeRoomIds(detail: RealtimeChatDetail) {
  return new Set(
    [detail.roomId, ...(detail.roomIds || [])]
      .map((item) => safeText(item))
      .filter(Boolean)
  );
}

function roomMatchesRealtimeDetail(room: FloatingRoom, detail: RealtimeChatDetail) {
  const primaryRoomId = safeText(detail.roomId);
  const primaryIsDeal = primaryRoomId.startsWith("deal:");
  const roomCandidates = [
    room.key,
    room.roomId,
    room.kind === "deal" && room.dealId ? `deal:${room.dealId}` : "",
  ]
    .map((item) => safeText(item))
    .filter(Boolean);

  if (primaryIsDeal) {
    return room.kind === "deal" && roomCandidates.includes(primaryRoomId);
  }

  if (room.kind === "deal") {
    return false;
  }

  const roomIds = getRealtimeRoomIds(detail);
  if (roomIds.size === 0) {
    return false;
  }

  return roomCandidates
    .filter((item) => !item.startsWith("deal:"))
    .some((item) => roomIds.has(item));
}

export default function FloatingChatDock({
  unreadCount = 0,
}: {
  unreadCount?: number;
}) {
  const { data: session, status } = useSession();
  const { isOnline } = useOnlinePresence();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dockMode, setDockMode] = useState<"chat" | "ai">("chat");
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<FloatingRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveFloatingRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [mobileListVisible, setMobileListVisible] = useState(true);

  const activeRoomRef = useRef<ActiveFloatingRoom | null>(activeRoom);
  const roomsRef = useRef<FloatingRoom[]>(rooms);
  const loadingRoomKeyRef = useRef("");
  const roomCacheRef = useRef<Map<string, RoomCacheEntry>>(new Map());
  const roomLoadPromisesRef = useRef<Map<string, Promise<RoomLoadResult>>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRootRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const fileRef = useRef<File | null>(file);
  const lastComposerSeenRef = useRef<{ roomKey: string; markedAt: number }>({
    roomKey: "",
    markedAt: 0,
  });

  const currentUserId = safeText(session?.user?.id);
  const badgeCount = Math.max(
    0,
    Number(unreadCount || 0),
    Number(localUnreadCount || 0)
  );
  const visibleRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const matchesFilter = filter === "all" || room.kind === filter;
        return matchesFilter && roomMatchesQuery(room, query);
      }),
    [filter, query, rooms]
  );
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const canSend = Boolean(safeText(draft) || file) && !sending && !!activeRoom?.actualRoomId;
  const activeProfileHref = activeRoom?.other?.id
    ? `/profile/${encodeURIComponent(activeRoom.other.id)}`
    : activeRoom?.otherUserId
      ? `/profile/${encodeURIComponent(activeRoom.otherUserId)}`
      : "";
  const activeOtherOnline = activeRoom
    ? isOnline(activeRoom.other?.id, activeRoom.otherUserId)
    : false;
  const activeDealCardNo = activeRoom
    ? safeText(activeRoom.card?.no || activeRoom.dealCardNo) || "001"
    : "001";
  const activeDealCardName = activeRoom
    ? safeText(activeRoom.card?.name || activeRoom.dealCardName) ||
      `Card #${activeDealCardNo}`
    : "";
  const activeDealCardImage = activeRoom
    ? safeText(activeRoom.card?.image || activeRoom.dealCardImage)
    : "";
  const lastSeenMineId = useMemo(() => {
    const myId = safeText(activeRoom?.me?.id || currentUserId);
    if (!myId) {
      return null;
    }

    const mineSeen = messages.filter(
      (message) => safeText(message.senderId) === myId && Boolean(message.seenAt)
    );

    return mineSeen[mineSeen.length - 1]?.id || null;
  }, [activeRoom?.me?.id, currentUserId, messages]);
  const otherTyping = useChatTyping({
    roomId: activeRoom?.actualRoomId || "",
    me: activeRoom?.me || null,
    other: activeRoom?.other || null,
    isTyping: Boolean(safeText(draft)) && open && Boolean(activeRoom?.actualRoomId),
  });

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    fileRef.current = file;
  }, [file]);

  useEffect(() => {
    if (!filePreview) return;
    return () => URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior });
    });
  }, []);

  const loadRooms = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    setRoomsLoading((current) => current || rooms.length === 0);

    try {
      const res = await fetch(`/api/dm/list?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as {
        rooms?: DMRoomListItem[];
      } | null;

      if (!res.ok) {
        return;
      }

      const nextRooms = (Array.isArray(payload?.rooms) ? payload.rooms : [])
        .map((room) => normalizeRoom(room))
        .filter(Boolean) as FloatingRoom[];

      setRooms(nextRooms);
      setLocalUnreadCount(
        nextRooms.reduce((total, room) => total + Math.max(0, Number(room.unread || 0)), 0)
      );
    } finally {
      setRoomsLoading(false);
    }
  }, [rooms.length, status]);

  const markRoomSeen = useCallback(
    async (
      room: ActiveFloatingRoom | FloatingRoom,
      actualRoomId: string,
      nextMessages: ChatMessage[],
      me?: ChatUser | null
    ) => {
      const safeRoomId = safeText(actualRoomId);
      const meId = safeText(me?.id || currentUserId);

      if (!safeRoomId || !meId) {
        return;
      }

      const unreadMessages = nextMessages.filter(
        (message) => safeText(message.senderId) !== meId && !message.seenAt
      );
      const unreadToClear = Math.max(
        unreadMessages.length,
        Number(room.unread || 0)
      );

      if (unreadToClear <= 0) {
        return;
      }

      const readAt = new Date().toISOString();
      setMessages((current) =>
        current.map((message) =>
          safeText(message.senderId) !== meId && !message.seenAt
            ? { ...message, seenAt: readAt }
            : message
        )
      );
      dispatchClientChatRead({
        roomId: safeRoomId,
        roomIds: getReadRoomIds(room, safeRoomId),
        unreadCount: unreadToClear,
        readAt,
      });

      setRooms((current) =>
        current.map((item) =>
          item.key === room.key ? { ...item, unread: 0 } : item
        )
      );
      setLocalUnreadCount((current) => Math.max(0, current - unreadToClear));

      await fetch("/api/dm/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: safeRoomId,
          action: "markSeen",
        }),
      }).catch(() => null);
    },
    [currentUserId]
  );

  const markActiveRoomSeenNow = useCallback(() => {
    const active = activeRoomRef.current;
    const myId = safeText(active?.me?.id || currentUserId);

    if (!active?.actualRoomId || !myId) {
      return;
    }

    const hasUnreadIncoming = messages.some(
      (message) => safeText(message.senderId) !== myId && !message.seenAt
    );

    if (!hasUnreadIncoming && Number(active.unread || 0) <= 0) {
      return;
    }

    const now = Date.now();
    const lastComposerSeen = lastComposerSeenRef.current;
    if (
      lastComposerSeen.roomKey === active.key &&
      now - lastComposerSeen.markedAt < 500
    ) {
      return;
    }

    lastComposerSeenRef.current = {
      roomKey: active.key,
      markedAt: now,
    };
    void markRoomSeen(active, active.actualRoomId, messages, active.me);
  }, [currentUserId, markRoomSeen, messages]);

  const buildRoomShell = useCallback(
    (
      room: FloatingRoom,
      loading: boolean,
      cachedActive?: ActiveFloatingRoom | null
    ): ActiveFloatingRoom => {
      const safeDealId = safeText(room.dealId || room.roomId);
      const dealCardNo = safeText(room.dealCardNo) || "001";
      const dealMode: "buy" | "sell" =
        room.dealMode === "buy" ? "buy" : "sell";
      const fallbackCard =
        room.kind === "deal"
          ? {
              id: safeText(room.dealId || room.roomId),
              no: dealCardNo,
              name: safeText(room.dealCardName) || `Card #${dealCardNo}`,
              image: safeText(room.dealCardImage) || "/cards/001.jpg",
              listedPrice: Number(room.dealPrice || 0),
            }
          : null;
      const fallbackDeal =
        room.kind === "deal"
          ? {
              id: safeDealId,
              offeredPrice: Number(room.dealPrice || 0),
              mode: dealMode,
            }
          : null;

      return {
        ...room,
        actualRoomId: safeText(cachedActive?.actualRoomId) || room.roomId,
        me:
          cachedActive?.me ||
          buildChatUser(
            currentUserId,
            session?.user?.name,
            session?.user?.image,
            "You"
          ),
        other:
          cachedActive?.other ||
          buildChatUser(room.otherUserId, room.otherName, room.otherImage),
        loading,
        hasMore: Boolean(cachedActive?.hasMore),
        nextCursor: safeText(cachedActive?.nextCursor) || null,
        card: cachedActive?.card || fallbackCard,
        deal: cachedActive?.deal || fallbackDeal,
      };
    },
    [currentUserId, session?.user?.image, session?.user?.name]
  );

  const updateRoomCache = useCallback(
    (key: string, active: ActiveFloatingRoom, nextMessages: ChatMessage[]) => {
      const safeKey = safeText(key);
      if (!safeKey) {
        return;
      }

      roomCacheRef.current.set(safeKey, {
        active: {
          ...active,
          loading: false,
        },
        messages: nextMessages,
        fetchedAt: Date.now(),
      });
    },
    []
  );

  const fetchRoomMessagesPage = useCallback(
    async (room: FloatingRoom, limit: number): Promise<RoomLoadResult> => {
      const shell = buildRoomShell(room, false);
      const res = await fetch(
        `/api/dm/messages?roomId=${encodeURIComponent(room.roomId)}&limit=${limit}&ts=${Date.now()}`,
        {
          cache: "no-store",
        }
      );
      const payload = (await res.json().catch(() => null)) as MessagePagePayload | null;

      if (!res.ok) {
        throw new Error(payload?.error || "open chat failed");
      }

      const messages = (Array.isArray(payload?.messages) ? payload.messages : []).map(
        (message) =>
          normalizeChatMessage(message, shell.actualRoomId, shell.me, shell.other)
      );
      const active: ActiveFloatingRoom = {
        ...shell,
        loading: false,
        hasMore: Boolean(payload?.hasMore),
        nextCursor: safeText(payload?.nextCursor) || null,
      };

      return {
        active,
        messages,
      };
    },
    [buildRoomShell]
  );

  const loadRoomFast = useCallback(
    (room: FloatingRoom, limit: number) => {
      const existing = roomLoadPromisesRef.current.get(room.key);
      if (existing) {
        return existing;
      }

      const promise = fetchRoomMessagesPage(room, limit)
        .then((result) => {
          updateRoomCache(room.key, result.active, result.messages);
          return result;
        })
        .finally(() => {
          roomLoadPromisesRef.current.delete(room.key);
        });

      roomLoadPromisesRef.current.set(room.key, promise);
      return promise;
    },
    [fetchRoomMessagesPage, updateRoomCache]
  );

  const prefetchRoom = useCallback(
    (room: FloatingRoom) => {
      if (status !== "authenticated") {
        return;
      }

      const cached = roomCacheRef.current.get(room.key);
      if (cached && Date.now() - cached.fetchedAt < ROOM_CACHE_TTL_MS) {
        return;
      }

      void loadRoomFast(room, ROOM_PREFETCH_LIMIT).catch(() => undefined);
    },
    [loadRoomFast, status]
  );

  const updateRoomListFromMessage = useCallback(
    (
      detail: RealtimeChatDetail,
      active: ActiveFloatingRoom | null,
      isOpen: boolean
    ) => {
      const room = roomsRef.current.find((item) =>
        roomMatchesRealtimeDetail(item, detail)
      );

      if (!room) {
        void loadRooms();
        return;
      }

      const activeMatches = active ? sameRoomEvent(active, detail) : false;
      const shouldIncrementUnread =
        !detail.isMine && !(isOpen && activeMatches);
      const messageCreatedAt = safeText(detail.createdAt) || new Date().toISOString();
      const preview = buildMessagePreview(detail.content, detail.imageUrl);

      setRooms((current) =>
        current
          .map((item) =>
            item.key === room.key
              ? {
                  ...item,
                  lastMessage: preview,
                  lastMessageAt: messageCreatedAt,
                  createdAt: messageCreatedAt || item.createdAt,
                  unread: detail.isMine
                    ? 0
                    : shouldIncrementUnread
                      ? Math.max(0, Number(item.unread || 0)) + 1
                      : activeMatches
                        ? 0
                        : item.unread,
                }
              : item
          )
          .sort((a, b) => {
            const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
            return bTime - aTime;
          })
      );

      if (shouldIncrementUnread) {
        setLocalUnreadCount((current) => Math.max(0, current + 1));
      }

      const cached = roomCacheRef.current.get(room.key);
      const shell = cached?.active || buildRoomShell(room, false);
      const incoming = normalizeChatMessage(
        {
          id: safeText(detail.id),
          roomId: shell.actualRoomId,
          senderId: safeText(detail.senderId),
          senderName: detail.senderName || null,
          senderImage: detail.senderImage || null,
          content: detail.content || null,
          imageUrl: detail.imageUrl || null,
          createdAt: messageCreatedAt,
          seenAt: detail.seenAt || null,
          optimistic: Boolean(detail.optimistic),
        },
        shell.actualRoomId,
        shell.me,
        shell.other
      );
      const cachedMessages = cached?.messages || [];
      const nextCachedMessages = mergeSingleChatMessage(
        cachedMessages,
        incoming,
        shell.actualRoomId,
        shell.me,
        shell.other
      );
      updateRoomCache(room.key, shell, nextCachedMessages);
    },
    [buildRoomShell, loadRooms, updateRoomCache]
  );

  const openRoom = useCallback(
    async (room: FloatingRoom) => {
      const key = room.key;
      const cached = roomCacheRef.current.get(key);
      const cachedMessages = cached?.messages || [];
      const shell = buildRoomShell(room, !cached, cached?.active);

      loadingRoomKeyRef.current = key;
      setError("");
      setMobileListVisible(false);
      setShowEmoji(false);
      setActiveRoom(shell);
      setMessages(cachedMessages);

      if (cachedMessages.length > 0) {
        scrollToBottom("auto");
        void markRoomSeen(shell, shell.actualRoomId, cachedMessages, shell.me);
      }

      try {
        const { active: nextActive, messages: nextMessages } = await loadRoomFast(
          room,
          ROOM_OPEN_LIMIT
        );

        if (loadingRoomKeyRef.current !== key) {
          return;
        }

        const activeWithoutUnread: ActiveFloatingRoom = {
          ...nextActive,
          unread: 0,
        };

        setActiveRoom(activeWithoutUnread);
        setMessages((current) => {
          const mergedMessages = mergeChatMessages(
            current,
            nextMessages,
            activeWithoutUnread.actualRoomId,
            activeWithoutUnread.me,
            activeWithoutUnread.other
          );
          updateRoomCache(key, activeWithoutUnread, mergedMessages);
          return mergedMessages;
        });
        void markRoomSeen(
          activeWithoutUnread,
          activeWithoutUnread.actualRoomId,
          nextMessages,
          activeWithoutUnread.me
        );
        scrollToBottom("auto");
      } catch (err) {
        if (loadingRoomKeyRef.current !== key) {
          return;
        }

        setError(
          err instanceof Error && err.message
            ? err.message
            : "เปิดแชทไม่สำเร็จ"
        );
        setActiveRoom((current) =>
          current?.key === key ? { ...current, loading: false } : current
        );
      }
    },
    [buildRoomShell, loadRoomFast, markRoomSeen, scrollToBottom, updateRoomCache]
  );

  const openFloatingDirectChat = useCallback(
    async (detail: OpenFloatingChatDetail) => {
      if (status !== "authenticated") {
        return;
      }

      const targetUserId = safeText(detail.userId);
      if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
        return;
      }

      const now = new Date().toISOString();
      const optimisticRoomId =
        safeText(detail.roomId) || buildDirectRoomId(currentUserId, targetUserId);
      const optimisticRoom = normalizeRoom({
        kind: "direct",
        roomId: optimisticRoomId,
        otherUserId: targetUserId,
        otherName: safeText(detail.userName) || "Seller",
        otherImage: safeText(detail.userImage) || "/avatar.png",
        lastMessage: "เริ่มแชท",
        createdAt: now,
        lastMessageAt: now,
        unread: 0,
      });

      if (!optimisticRoom) {
        return;
      }

      setOpen(true);
      setFilter("direct");
      setMobileListVisible(false);
      setError("");
      setRooms((current) => {
        const withoutDuplicate = current.filter(
          (room) =>
            room.roomId !== optimisticRoom.roomId &&
            room.otherUserId !== optimisticRoom.otherUserId
        );
        return [optimisticRoom, ...withoutDuplicate];
      });

      const shell = buildRoomShell(optimisticRoom, true);
      setActiveRoom(shell);
      setMessages([]);
      updateRoomCache(optimisticRoom.key, { ...shell, loading: false }, []);

      const res = await fetch("/api/dm/create-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user2: targetUserId,
          user2Name: safeText(detail.userName),
          user2Image: safeText(detail.userImage),
          legacyRoomId: safeText(detail.legacyRoomId) || optimisticRoomId,
        }),
      }).catch(() => null);
      const payload = (await res?.json().catch(() => null)) as {
        roomId?: string | null;
      } | null;
      const roomId = safeText(payload?.roomId) || optimisticRoomId;
      const actualRoom = normalizeRoom({
        kind: "direct",
        roomId,
        otherUserId: targetUserId,
        otherName: optimisticRoom.otherName,
        otherImage: optimisticRoom.otherImage,
        lastMessage: optimisticRoom.lastMessage,
        createdAt: optimisticRoom.createdAt,
        lastMessageAt: optimisticRoom.lastMessageAt,
        unread: 0,
      });

      if (actualRoom) {
        setRooms((current) => {
          const withoutDuplicate = current.filter(
            (room) =>
              room.roomId !== optimisticRoom.roomId &&
              room.roomId !== actualRoom.roomId &&
              room.otherUserId !== actualRoom.otherUserId
          );
          return [actualRoom, ...withoutDuplicate];
        });
        await openRoom(actualRoom);
      }
    },
    [buildRoomShell, currentUserId, openRoom, status, updateRoomCache]
  );

  const openFloatingDealChat = useCallback(
    async (detail: OpenFloatingChatDetail) => {
      if (status !== "authenticated") {
        return;
      }

      const rawRoomId = safeText(detail.roomId);
      const dealId =
        safeText(detail.dealId) ||
        (rawRoomId.startsWith("deal:") ? rawRoomId.slice(5) : rawRoomId);

      if (!dealId) {
        return;
      }

      const roomId = rawRoomId.startsWith("deal:") ? rawRoomId : `deal:${dealId}`;
      const now = new Date().toISOString();
      const dealMode: "sell" | "buy" =
        detail.dealMode === "buy" ? "buy" : "sell";
      const cardNo = safeText(detail.dealCardNo) || "001";
      const optimisticRoom = normalizeRoom({
        kind: "deal",
        roomId,
        dealId,
        otherUserId: safeText(detail.userId),
        otherName: safeText(detail.userName) || "Deal Partner",
        otherImage: safeText(detail.userImage) || "/avatar.png",
        lastMessage:
          dealMode === "buy"
            ? "เริ่มคุยห้องดีลรับซื้อ"
            : "เริ่มคุยห้องดีล",
        createdAt: now,
        lastMessageAt: now,
        unread: 0,
        dealCardName: safeText(detail.dealCardName) || `Card #${cardNo}`,
        dealCardImage: safeText(detail.dealCardImage) || `/cards/${cardNo}.jpg`,
        dealCardNo: cardNo,
        dealPrice: Number(detail.dealPrice || 0),
        dealMode,
      });

      if (!optimisticRoom) {
        return;
      }

      setOpen(true);
      setFilter("deal");
      setMobileListVisible(false);
      setError("");
      setRooms((current) => {
        const withoutDuplicate = current.filter(
          (room) =>
            room.key !== optimisticRoom.key &&
            room.roomId !== optimisticRoom.roomId
        );
        return [optimisticRoom, ...withoutDuplicate];
      });

      await openRoom(optimisticRoom);
    },
    [openRoom, status]
  );

  const syncActiveRoom = useCallback(async () => {
    const active = activeRoomRef.current;
    if (!active?.actualRoomId || active.loading) {
      return;
    }

    const res = await fetch(
      `/api/dm/messages?roomId=${encodeURIComponent(active.actualRoomId)}&limit=80`,
      {
        cache: "no-store",
      }
    ).catch(() => null);

    if (!res?.ok || activeRoomRef.current?.actualRoomId !== active.actualRoomId) {
      return;
    }

    const payload = (await res.json().catch(() => null)) as {
      messages?: ChatMessage[];
      hasMore?: boolean;
      nextCursor?: string | null;
    } | null;
    const freshMessages = (Array.isArray(payload?.messages)
      ? payload.messages
      : []
    ).map((message) =>
      normalizeChatMessage(message, active.actualRoomId, active.me, active.other)
    );

    const activeAfterSync: ActiveFloatingRoom = {
      ...active,
      loading: false,
      hasMore: Boolean(payload?.hasMore),
      nextCursor: safeText(payload?.nextCursor) || null,
    };

    setMessages((current) => {
      const nextMessages = reconcileRecentChatMessages(
        current,
        freshMessages,
        active.actualRoomId,
        active.me,
        active.other
      );
      updateRoomCache(active.key, activeAfterSync, nextMessages);
      return nextMessages;
    });
    setActiveRoom((current) =>
      current?.actualRoomId === active.actualRoomId
        ? activeAfterSync
        : current
    );

    void markRoomSeen(active, active.actualRoomId, freshMessages, active.me);
  }, [markRoomSeen, updateRoomCache]);

  const sendMessage = useCallback(async () => {
    const active = activeRoomRef.current;
    const text = safeText(draftRef.current);
    const selectedFile = fileRef.current;

    if (!active?.actualRoomId || (!text && !selectedFile) || sending) {
      return;
    }

    const optimistic: ChatMessage = normalizeChatMessage(
      {
        id: `local-${Date.now()}`,
        roomId: active.actualRoomId,
        senderId: safeText(active.me?.id || currentUserId),
        senderName: active.me?.name || session?.user?.name || "You",
        senderImage: active.me?.image || session?.user?.image || "/avatar.png",
        content: text || null,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        optimistic: true,
      },
      active.actualRoomId,
      active.me,
      active.other
    );

    setSending(true);
    setError("");
    setShowEmoji(false);
    setDraft("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setMessages((current) => {
      const nextMessages = mergeSingleChatMessage(
        current,
        optimistic,
        active.actualRoomId,
        active.me,
        active.other
      );
      updateRoomCache(active.key, active, nextMessages);
      return nextMessages;
    });
    setRooms((current) =>
      current
        .map((room) =>
          room.key === active.key
            ? {
                ...room,
                lastMessage: buildMessagePreview(
                  text,
                  selectedFile ? "local-image" : optimistic.imageUrl
                ),
                lastMessageAt: optimistic.createdAt || new Date().toISOString(),
                createdAt: optimistic.createdAt || room.createdAt,
                unread: 0,
              }
            : room
        )
        .sort((a, b) => {
          const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        })
    );
    scrollToBottom("smooth");

    try {
      let res: Response | null = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("roomId", active.actualRoomId);
        formData.append("content", text);
        formData.append("file", await prepareChatImageFile(selectedFile));
        res = await fetch("/api/dm/send", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/dm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: active.actualRoomId,
            content: text,
          }),
        });
      }

      const payload = (await res.json().catch(() => null)) as ChatMessage | null;

      if (!res.ok || !payload?.id) {
        throw new Error("ส่งข้อความไม่สำเร็จ");
      }

      const sentMessage = normalizeChatMessage(
        payload,
        active.actualRoomId,
        active.me,
        active.other
      );
      setMessages((current) => {
        const nextMessages = mergeChatMessages(
          current,
          [sentMessage],
          active.actualRoomId,
          active.me,
          active.other
        );
        updateRoomCache(active.key, active, nextMessages);
        return nextMessages;
      });
      setRooms((current) =>
        current
          .map((room) =>
            room.key === active.key
              ? {
                  ...room,
                  lastMessage: text || (sentMessage.imageUrl ? "รูปภาพ" : room.lastMessage),
                  lastMessageAt: sentMessage.createdAt || new Date().toISOString(),
                  createdAt: sentMessage.createdAt || room.createdAt,
                  unread: 0,
                }
              : room
          )
          .sort((a, b) => {
            const aTime = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
            return bTime - aTime;
          })
      );
      void loadRooms();
      scrollToBottom("smooth");
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "ส่งข้อความไม่สำเร็จ"
      );
    } finally {
      setSending(false);
    }
  }, [
    currentUserId,
    loadRooms,
    scrollToBottom,
    sending,
    session?.user?.image,
    session?.user?.name,
    updateRoomCache,
  ]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const initialLoadId = window.setTimeout(() => {
      void loadRooms();
    }, 0);
    const intervalId = window.setInterval(() => {
      void loadRooms();
    }, LIST_REFRESH_MS);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
    };
  }, [loadRooms, status]);

  useEffect(() => {
    if (!open || activeRoom || visibleRooms.length === 0) {
      return;
    }

    if (!window.matchMedia("(min-width: 640px)").matches) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void openRoom(visibleRooms[0]);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [activeRoom, open, openRoom, visibleRooms]);

  useEffect(() => {
    if (!open || visibleRooms.length === 0) {
      return;
    }

    const timers = visibleRooms
      .slice(0, ROOM_PREFETCH_COUNT)
      .map((room, index) =>
        window.setTimeout(() => {
          prefetchRoom(room);
        }, 180 + index * 120)
      );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [open, prefetchRoom, visibleRooms]);

  useEffect(() => {
    if (!open || !activeRoom) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncActiveRoom();
    }, ROOM_SYNC_MS);

    return () => window.clearInterval(intervalId);
  }, [activeRoom, open, syncActiveRoom]);

  useEffect(() => {
    const handleUnread = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number | null }>).detail;
      setLocalUnreadCount(Math.max(0, Number(detail?.count || 0)));
    };
    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeChatDetail>).detail;
      const active = activeRoomRef.current;

      if (!detail?.id) {
        return;
      }

      updateRoomListFromMessage(detail, active, open);

      if (!active || !sameRoomEvent(active, detail)) {
        return;
      }

      const incoming = normalizeChatMessage(
        {
          id: safeText(detail.id),
          roomId: active.actualRoomId,
          senderId: safeText(detail.senderId),
          senderName: detail.senderName || null,
          senderImage: detail.senderImage || null,
          content: detail.content || null,
          imageUrl: detail.imageUrl || null,
          createdAt: detail.createdAt || new Date().toISOString(),
          seenAt: detail.seenAt || null,
          optimistic: Boolean(detail.optimistic),
        },
        active.actualRoomId,
        active.me,
        active.other
      );

      setMessages((current) => {
        const nextMessages = mergeSingleChatMessage(
          current,
          incoming,
          active.actualRoomId,
          active.me,
          active.other
        );
        updateRoomCache(active.key, active, nextMessages);
        return nextMessages;
      });
      scrollToBottom("smooth");

      if (!detail.isMine && open) {
        void markRoomSeen(active, active.actualRoomId, [incoming], active.me);
      }
    };
    const handleSeen = (event: Event) => {
      const detail = (event as CustomEvent<ChatSeenDetail>).detail;
      const active = activeRoomRef.current;

      if (!active || !sameRoomEvent(active, detail as RealtimeChatDetail)) {
        return;
      }

      const messageId = safeText(detail?.messageId || detail?.id);
      const readAt = safeText(detail?.seenAt || detail?.readAt) || new Date().toISOString();
      const myId = safeText(active.me?.id || currentUserId);

      if (!readAt || !myId) {
        return;
      }

      setMessages((current) => {
        let changed = false;
        const nextMessages = current.map((message) => {
          const isMine = safeText(message.senderId) === myId;
          const matchesMessage = messageId
            ? safeText(message.id) === messageId
            : isMine;

          if (!isMine || !matchesMessage || message.seenAt) {
            return message;
          }

          changed = true;
          return {
            ...message,
            seenAt: readAt,
          };
        });

        if (changed) {
          updateRoomCache(active.key, active, nextMessages);
        }

        return changed ? nextMessages : current;
      });
    };

    window.addEventListener("nexora:chat-unread-count", handleUnread);
    window.addEventListener("nexora:chat-message-received", handleRealtime);
    window.addEventListener("nexora:chat-message-seen", handleSeen);

    return () => {
      window.removeEventListener("nexora:chat-unread-count", handleUnread);
      window.removeEventListener("nexora:chat-message-received", handleRealtime);
      window.removeEventListener("nexora:chat-message-seen", handleSeen);
    };
  }, [
    currentUserId,
    markRoomSeen,
    open,
    scrollToBottom,
    updateRoomCache,
    updateRoomListFromMessage,
  ]);

  useEffect(() => {
    const handleOpenFloatingChat = (event: Event) => {
      const detail = (event as CustomEvent<OpenFloatingChatDetail>).detail;
      const roomId = safeText(detail?.roomId);

      if (detail?.kind === "deal" || detail?.dealId || roomId.startsWith("deal:")) {
        void openFloatingDealChat(detail || {});
        return;
      }

      void openFloatingDirectChat(detail || {});
    };

    window.addEventListener("nexora:open-floating-chat", handleOpenFloatingChat);
    return () => {
      window.removeEventListener(
        "nexora:open-floating-chat",
        handleOpenFloatingChat
      );
    };
  }, [openFloatingDealChat, openFloatingDirectChat]);

  useEffect(() => {
    if (open) {
      scrollToBottom("auto");
    }
  }, [messages.length, open, scrollToBottom]);

  useEffect(() => {
    if (open && otherTyping && activeRoom) {
      scrollToBottom("smooth");
    }
  }, [activeRoom, open, otherTyping, scrollToBottom]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!emojiRootRef.current?.contains(event.target as Node)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  if (status !== "authenticated") {
    return null;
  }

  if (!open) {
    return (
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+104px)] right-3 z-[1110] flex max-w-[calc(100vw-24px)] items-center justify-end gap-2 xl:bottom-6 xl:right-6">
        <button
          type="button"
          onClick={() => {
            setDockMode("chat");
            setOpen(true);
            setMobileListVisible(!activeRoom);
            void loadRooms();
          }}
          className="flex min-w-0 items-center gap-2 rounded-full border border-white/12 bg-black/90 px-3.5 py-3 text-left text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition hover:scale-[1.02] hover:bg-[#111318] active:scale-[0.98] xl:px-4"
          aria-label="เปิดแชท"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.22)]">
            <MessageCircle className="h-4 w-4" />
            {badgeCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-black bg-red-500 px-1 text-center text-[10px] font-black leading-4 text-white">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black">Chat</span>
            <span className="block truncate text-[11px] font-bold text-white/55">
              {badgeCount > 0 ? "มีข้อความใหม่" : "พร้อมคุย"}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDockMode("ai");
            setOpen(true);
            setShowEmoji(false);
            setMobileListVisible(false);
          }}
          className="group relative flex min-h-[58px] min-w-0 max-w-[210px] items-center gap-2 overflow-hidden rounded-full border border-amber-200/35 bg-[linear-gradient(135deg,#fff3b0_0%,#d8a83c_44%,#5d3d10_100%)] px-3 py-2.5 text-left text-black shadow-[0_0_34px_rgba(251,191,36,0.45),0_18px_48px_rgba(0,0,0,0.48)] transition hover:scale-[1.02] active:scale-[0.98] max-[380px]:max-w-[185px]"
          aria-label="คุยกับท่านเบลซ AI"
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.62),transparent_34%),linear-gradient(90deg,transparent,rgba(255,255,255,0.20),transparent)] opacity-70 transition group-hover:opacity-100" />
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-amber-200 shadow-[0_0_24px_rgba(0,0,0,0.28)]">
            <Flame className="h-4 w-4" />
          </span>
          <span className="relative min-w-0">
            <span className="block truncate text-[12px] font-black leading-tight">
              (คุยกับท่านเบลซ AI)
            </span>
            <span className="block truncate text-[10px] font-black uppercase text-black/55">
              Blaze Warlock
            </span>
          </span>
        </button>
      </div>
    );
  }

  if (dockMode === "ai") {
    return (
      <section className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+86px)] top-[calc(env(safe-area-inset-top)+72px)] z-[1120] overflow-hidden rounded-[24px] border border-amber-200/22 bg-[#050403]/96 text-white shadow-[0_30px_100px_rgba(0,0,0,0.66),0_0_54px_rgba(251,191,36,0.18)] backdrop-blur-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:top-auto sm:h-[min(720px,calc(100dvh-40px))] sm:w-[620px] xl:bottom-6 xl:right-6">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200/14 bg-[linear-gradient(135deg,rgba(23,17,6,0.96),rgba(6,5,4,0.96))] px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/28 bg-[radial-gradient(circle_at_top,#ffe7a6,#c58f24_48%,#1a1104_100%)] text-black shadow-[0_0_28px_rgba(251,191,36,0.36)]">
                <Bot className="h-5 w-5" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-black p-0.5 text-amber-200" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-lg font-black leading-tight text-amber-50">
                  ท่านเบลซ
                </div>
                <div className="truncate text-xs font-bold text-amber-100/58">
                  Blaze Warlock • NEXORA AI
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-100/12 bg-white/[0.06] text-amber-100/70 transition hover:bg-white/[0.1] hover:text-white"
                aria-label="ย่อแชท AI"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDockMode("chat");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-100/12 bg-white/[0.06] text-amber-100/70 transition hover:bg-red-500/20 hover:text-white"
                aria-label="ปิดแชท AI"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-black">
            <iframe
              src={BLAZE_AI_URL}
              title="ท่านเบลซ Blaze Warlock NEXORA AI"
              className="h-full w-full border-0 bg-black"
              loading="lazy"
              allow="clipboard-read; clipboard-write; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+86px)] top-[calc(env(safe-area-inset-top)+72px)] z-[1120] overflow-hidden rounded-[24px] border border-white/12 bg-[#050608]/96 text-white shadow-[0_30px_100px_rgba(0,0,0,0.62)] backdrop-blur-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:top-auto sm:h-[min(720px,calc(100dvh-40px))] sm:w-[760px] lg:w-[820px] xl:bottom-6 xl:right-6">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/64 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_28px_rgba(255,255,255,0.14)]">
              <MessagesSquare className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-black sm:text-lg">Chat</div>
              <div className="truncate text-xs font-bold text-white/45">
                ส่วนตัวและดีล
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
              aria-label="ย่อแชท"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActiveRoom(null);
                setMessages([]);
                setMobileListVisible(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-red-500/20 hover:text-white"
              aria-label="ปิดแชท"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[310px_minmax(0,1fr)]">
          <aside
            className={`min-h-0 border-white/10 bg-[#08090d] sm:flex sm:flex-col sm:border-r ${
              mobileListVisible ? "flex flex-col" : "hidden"
            }`}
          >
            <div className="shrink-0 space-y-3 border-b border-white/10 p-3">
              <div className="flex rounded-full border border-white/10 bg-black/60 p-1">
                {[
                  ["all", "ทั้งหมด"],
                  ["direct", "ส่วนตัว"],
                  ["deal", "ดีล"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value as RoomFilter)}
                    className={`min-h-9 flex-1 rounded-full px-3 text-xs font-black transition ${
                      filter === value
                        ? "bg-white text-black"
                        : "text-white/55 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-white/55">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  placeholder="ค้นหาแชท"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {roomsLoading && rooms.length === 0 ? (
                <div className="space-y-2 p-1">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-[74px] animate-pulse rounded-[20px] bg-white/[0.05]"
                    />
                  ))}
                </div>
              ) : visibleRooms.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-5 text-center">
                  <MessageCircle className="h-8 w-8 text-white/18" />
                  <div className="mt-3 text-sm font-black text-white/75">
                    ยังไม่มีแชท
                  </div>
                  <div className="mt-1 text-xs text-white/35">
                    ห้องที่มีข้อความจะมาอยู่ตรงนี้
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {visibleRooms.map((room) => {
                    const active = activeRoom?.key === room.key;
                    const roomOnline = isOnline(room.otherUserId);
                    return (
                      <button
                        key={room.key}
                        type="button"
                        onPointerEnter={() => prefetchRoom(room)}
                        onFocus={() => prefetchRoom(room)}
                        onClick={() => void openRoom(room)}
                        className={`group flex w-full items-center gap-3 rounded-[20px] border p-2.5 text-left transition active:scale-[0.99] ${
                          active
                            ? "border-white/18 bg-white/[0.10]"
                            : "border-transparent hover:border-white/10 hover:bg-white/[0.055]"
                        }`}
                      >
                        <span className="relative h-11 w-11 shrink-0">
                          <span className="block h-11 w-11 overflow-hidden rounded-2xl bg-white/10">
                            <img
                              src={room.otherImage || "/avatar.png"}
                              alt={room.otherName || "profile"}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = "/avatar.png";
                              }}
                            />
                          </span>
                          <span
                            className={`absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#08090d] ${
                              room.kind === "deal"
                                ? room.dealMode === "buy"
                                  ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.28)]"
                                  : "bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.38)]"
                                : "bg-white text-black"
                            }`}
                          >
                            {room.kind === "deal" ? (
                              <Handshake className="h-3 w-3" />
                            ) : (
                              <MessageCircle className="h-3 w-3" />
                            )}
                          </span>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#08090d] ${
                              roomOnline
                                ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.72)]"
                                : "bg-zinc-500"
                            }`}
                          />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-black text-white">
                              {room.otherName}
                            </span>
                            <span className="shrink-0 text-[10px] font-black uppercase text-white/30">
                              {room.kind === "deal" ? "DEAL" : "DM"}
                            </span>
                          </span>
                          {room.kind === "deal" ? (
                            <span className="mt-0.5 block truncate text-[11px] font-bold text-cyan-200/70">
                              {room.dealMode === "buy" ? "รับซื้อ · " : ""}
                              #{safeText(room.dealCardNo) || "001"}{" "}
                              {room.dealCardName || "ดีลการ์ด"}{" "}
                              {formatPrice(room.dealPrice)}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block truncate text-xs text-white/42">
                            {room.lastMessage}
                          </span>
                        </span>

                        <span className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-[10px] text-white/28">
                            {formatActivityTime(room.lastMessageAt || room.createdAt)}
                          </span>
                          {room.unread > 0 ? (
                            <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-black leading-5 text-white">
                              {room.unread > 99 ? "99+" : room.unread}
                            </span>
                          ) : (
                            <span className="h-5" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div
            className={`min-h-0 flex-col bg-[#050608] sm:flex ${
              mobileListVisible ? "hidden" : "flex"
            }`}
          >
            {activeRoom ? (
              <>
                <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/42 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setMobileListVisible(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/70 sm:hidden"
                    aria-label="กลับไปหน้ารายการแชท"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!activeProfileHref) return;
                      setOpen(false);
                      router.push(activeProfileHref);
                    }}
                    disabled={!activeProfileHref}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 py-1 text-left transition hover:bg-white/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
                    aria-label="เปิดโปรไฟล์คู่สนทนา"
                  >
                    <span className="relative h-11 w-11 shrink-0">
                      <span className="block h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                        <img
                          src={activeRoom.other?.image || activeRoom.otherImage || "/avatar.png"}
                          alt={activeRoom.other?.name || activeRoom.otherName || "profile"}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.src = "/avatar.png";
                          }}
                        />
                      </span>
                      <span
                        className={`absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#08090d] ${
                          activeRoom.kind === "deal"
                            ? activeRoom.dealMode === "buy"
                              ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.28)]"
                              : "bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.38)]"
                            : "bg-white text-black"
                        }`}
                      >
                        {activeRoom.kind === "deal" ? (
                          <Handshake className="h-3 w-3" />
                        ) : (
                          <MessageCircle className="h-3 w-3" />
                        )}
                      </span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#08090d] ${
                          activeOtherOnline
                            ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.72)]"
                            : "bg-zinc-500"
                        }`}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black sm:text-base">
                        {activeRoom.other?.name || activeRoom.otherName}
                      </span>
                      <span
                        className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${
                          activeOtherOnline ? "text-emerald-300/90" : "text-white/45"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            activeOtherOnline
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.72)]"
                              : "bg-zinc-500"
                          }`}
                        />
                        <span className="shrink-0">
                          {activeOtherOnline ? "ออนไลน์" : "ออฟไลน์"}
                        </span>
                        <span className="text-white/22">·</span>
                        <span className="truncate text-white/42">
                          {activeRoom.kind === "deal"
                            ? activeRoom.dealMode === "buy"
                              ? `ดีลรับซื้อ #${activeDealCardNo}`
                              : `ดีลการ์ด #${activeDealCardNo}`
                            : "แชทส่วนตัว"}
                        </span>
                      </span>
                    </span>
                  </button>

                  {activeRoom.kind === "deal" ? (
                    <div className="flex max-w-[118px] shrink-0 items-center gap-1.5 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-1 pr-2 sm:max-w-[168px]">
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                        <SafeCardImage
                          cardNo={activeDealCardNo}
                          imageUrl={activeDealCardImage}
                          alt={activeDealCardName}
                          className="aspect-[2/3] h-9 w-auto object-cover sm:h-11"
                          loading="eager"
                          fetchPriority="high"
                        />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="truncate text-[9px] font-black text-cyan-100/65 sm:text-[10px]">
                          {activeRoom.dealMode === "buy" ? "BUY" : `#${activeDealCardNo}`}
                        </div>
                        <div className="truncate text-[11px] font-black text-cyan-100 sm:text-sm">
                          {formatPrice(activeRoom.deal?.offeredPrice || activeRoom.dealPrice)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  {messages.length === 0 && activeRoom.loading ? (
                    <FloatingChatMessageSkeleton />
                  ) : messages.length === 0 && !otherTyping ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                      <MessagesSquare className="h-9 w-9 text-white/16" />
                      <div className="mt-3 text-sm font-black text-white/70">
                        เริ่มบทสนทนา
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-end">
                      {messages.map((message) => {
                        const mine =
                          safeText(message.senderId) ===
                          safeText(activeRoom.me?.id || currentUserId);
                        const sender = mine ? activeRoom.me : activeRoom.other;

                        return (
                          <div
                            key={message.id}
                            className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`flex max-w-[86%] items-end gap-2 ${
                                mine ? "flex-row-reverse" : ""
                              }`}
                            >
                              {!mine ? (
                                <img
                                  src={sender?.image || "/avatar.png"}
                                  alt={sender?.name || "profile"}
                                  className="h-7 w-7 shrink-0 rounded-full border border-white/10 object-cover"
                                  onError={(event) => {
                                    event.currentTarget.src = "/avatar.png";
                                  }}
                                />
                              ) : null}
                              <div
                                className={`flex flex-col ${
                                  mine ? "items-end" : "items-start"
                                }`}
                              >
                                <div
                                  className={`break-words rounded-[20px] px-3.5 py-2.5 text-[13px] leading-relaxed shadow-lg sm:text-sm ${
                                    mine
                                      ? "bg-white text-black"
                                      : "bg-white/[0.10] text-white"
                                  }`}
                                >
                                  {message.imageUrl ? (
                                    <img
                                      src={message.imageUrl}
                                      alt="chat attachment"
                                      className="mb-2 max-h-[180px] max-w-full rounded-xl object-contain"
                                    />
                                  ) : null}
                                  <ChatMessageText text={message.content} mine={mine} />
                                </div>
                                <div
                                  className={`mt-1 px-1 text-[10px] text-white/28 ${
                                    mine ? "text-right" : "text-left"
                                  }`}
                                >
                                  {message.optimistic ? "กำลังส่ง..." : formatActivityTime(message.createdAt)}
                                </div>
                                {mine && lastSeenMineId === message.id && message.seenAt ? (
                                  <div className="mt-1 px-1 text-[10px] text-emerald-400/80">
                                    อ่านแล้ว
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <ChatTypingIndicator
                        visible={otherTyping}
                        avatar={activeRoom.other?.image || activeRoom.otherImage}
                        name={activeRoom.other?.name || activeRoom.otherName}
                        compact
                      />
                      <div ref={bottomRef} className="h-1 w-full" />
                    </div>
                  )}
                </div>

                <div
                  ref={emojiRootRef}
                  className="relative shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,6,8,0.24),rgba(5,6,8,0.96))] p-3"
                >
                  {error ? (
                    <div className="mb-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">
                      {error}
                    </div>
                  ) : null}

                  {showEmoji ? (
                    <div
                      className="absolute bottom-[calc(100%+10px)] right-3 z-[70]"
                    >
                      <ChatEmojiPicker
                        onClose={() => setShowEmoji(false)}
                        onSelect={(emoji) => {
                          const nextText = `${draftRef.current}${emoji}`;
                          draftRef.current = nextText;
                          setDraft(nextText);
                          setShowEmoji(false);
                        }}
                      />
                    </div>
                  ) : null}

                  {file && filePreview ? (
                    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-2">
                      <img
                        src={filePreview}
                        alt="selected image preview"
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-white/80">
                          {file.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70"
                        aria-label="ลบรูป"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 rounded-[24px] border border-white/10 bg-black/68 p-2">
                    <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition hover:bg-white/[0.13] hover:text-white">
                      <ImageIcon className="h-4 w-4" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          setFile(event.target.files?.[0] || null);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowEmoji((current) => !current)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition hover:bg-white/[0.13] hover:text-white"
                      aria-label="เลือกอีโมจิ"
                    >
                      <Smile className="h-4 w-4" />
                    </button>

                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onFocus={markActiveRoomSeenNow}
                      onPointerDown={markActiveRoomSeenNow}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      inputMode="text"
                      autoComplete="off"
                      className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.08] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                      placeholder="พิมพ์ข้อความ..."
                    />

                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={!canSend}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_0_22px_rgba(255,255,255,0.16)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label="ส่งข้อความ"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="hidden h-full min-h-[360px] flex-col items-center justify-center text-center sm:flex">
                <MessagesSquare className="h-10 w-10 text-white/16" />
                <div className="mt-3 text-sm font-black text-white/72">
                  เลือกแชทเพื่อเริ่มคุย
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
