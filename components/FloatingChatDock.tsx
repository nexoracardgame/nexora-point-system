"use client";

import {
  ArrowLeft,
  Handshake,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Minimize2,
  Search,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import ChatMessageText from "@/components/ChatMessageText";
import { prepareChatImageFile } from "@/lib/chat-image-client";
import { dispatchClientChatRead } from "@/lib/chat-read-sync";
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
  } | null;
};

type BootstrapPayload = {
  ok?: boolean;
  roomId?: string;
  me?: ChatUser | null;
  other?: ChatUser | null;
  card?: ActiveFloatingRoom["card"];
  deal?: ActiveFloatingRoom["deal"];
  messages?: ChatMessage[];
  hasMore?: boolean;
  nextCursor?: string | null;
  error?: string;
};

type RealtimeChatDetail = Partial<ChatMessage> & {
  isMine?: boolean | null;
  roomIds?: Array<string | null | undefined> | null;
};

const LIST_REFRESH_MS = 8500;
const ROOM_SYNC_MS = 14000;

function safeText(value?: string | number | null) {
  return String(value || "").trim();
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
  const incomingRoomIds = new Set(
    [detail.roomId, ...(detail.roomIds || [])]
      .map((item) => safeText(item))
      .filter(Boolean)
  );
  const activeRoomIds = getReadRoomIds(active, active.actualRoomId);

  return activeRoomIds.some((item) => incomingRoomIds.has(item));
}

export default function FloatingChatDock({
  unreadCount = 0,
}: {
  unreadCount?: number;
}) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<FloatingRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ActiveFloatingRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [mobileListVisible, setMobileListVisible] = useState(true);

  const activeRoomRef = useRef<ActiveFloatingRoom | null>(activeRoom);
  const loadingRoomKeyRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const fileRef = useRef<File | null>(file);

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

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

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

  const openRoom = useCallback(
    async (room: FloatingRoom) => {
      const key = room.key;
      loadingRoomKeyRef.current = key;
      setError("");
      setMobileListVisible(false);
      setActiveRoom({
        ...room,
        actualRoomId: room.roomId,
        me: null,
        other: buildChatUser(room.otherUserId, room.otherName, room.otherImage),
        loading: true,
        hasMore: false,
        nextCursor: null,
      });
      setMessages([]);

      const url =
        room.kind === "deal"
          ? `/api/market/deal-chat/bootstrap?dealId=${encodeURIComponent(
              safeText(room.dealId)
            )}`
          : `/api/dm/bootstrap?roomId=${encodeURIComponent(room.roomId)}`;

      try {
        const res = await fetch(url, {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as BootstrapPayload | null;

        if (loadingRoomKeyRef.current !== key) {
          return;
        }

        if (!res.ok || payload?.ok === false || !payload?.roomId) {
          throw new Error(payload?.error || "เปิดแชทไม่สำเร็จ");
        }

        const me = payload.me
          ? buildChatUser(payload.me.id, payload.me.name, payload.me.image, "You")
          : null;
        const other = payload.other
          ? buildChatUser(payload.other.id, payload.other.name, payload.other.image)
          : buildChatUser(room.otherUserId, room.otherName, room.otherImage);
        const actualRoomId = safeText(payload.roomId);
        const nextMessages = (Array.isArray(payload.messages)
          ? payload.messages
          : []
        ).map((message) => normalizeChatMessage(message, actualRoomId, me, other));
        const nextActive: ActiveFloatingRoom = {
          ...room,
          actualRoomId,
          me,
          other,
          card: payload.card || null,
          deal: payload.deal || null,
          loading: false,
          hasMore: Boolean(payload.hasMore),
          nextCursor: safeText(payload.nextCursor) || null,
          unread: 0,
        };

        setActiveRoom(nextActive);
        setMessages(nextMessages);
        void markRoomSeen(nextActive, actualRoomId, nextMessages, me);
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
    [markRoomSeen, scrollToBottom]
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

    setMessages((current) =>
      reconcileRecentChatMessages(
        current,
        freshMessages,
        active.actualRoomId,
        active.me,
        active.other
      )
    );
    setActiveRoom((current) =>
      current?.actualRoomId === active.actualRoomId
        ? {
            ...current,
            hasMore: Boolean(payload?.hasMore),
            nextCursor: safeText(payload?.nextCursor) || null,
          }
        : current
    );

    void markRoomSeen(active, active.actualRoomId, freshMessages, active.me);
  }, [markRoomSeen]);

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
    setDraft("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setMessages((current) =>
      mergeSingleChatMessage(current, optimistic, active.actualRoomId, active.me, active.other)
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
      setMessages((current) =>
        mergeChatMessages(current, [sentMessage], active.actualRoomId, active.me, active.other)
      );
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
  }, [currentUserId, loadRooms, scrollToBottom, sending, session?.user?.image, session?.user?.name]);

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

      void loadRooms();

      if (!active || !detail?.id || !sameRoomEvent(active, detail)) {
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

      setMessages((current) =>
        mergeSingleChatMessage(current, incoming, active.actualRoomId, active.me, active.other)
      );
      scrollToBottom("smooth");

      if (!detail.isMine && open) {
        void markRoomSeen(active, active.actualRoomId, [incoming], active.me);
      }
    };

    window.addEventListener("nexora:chat-unread-count", handleUnread);
    window.addEventListener("nexora:chat-message-received", handleRealtime);

    return () => {
      window.removeEventListener("nexora:chat-unread-count", handleUnread);
      window.removeEventListener("nexora:chat-message-received", handleRealtime);
    };
  }, [loadRooms, markRoomSeen, open, scrollToBottom]);

  useEffect(() => {
    if (open) {
      scrollToBottom("auto");
    }
  }, [messages.length, open, scrollToBottom]);

  if (status !== "authenticated") {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMobileListVisible(!activeRoom);
          void loadRooms();
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+104px)] right-3 z-[1110] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border border-white/12 bg-black/90 px-3.5 py-3 text-left text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition hover:scale-[1.02] hover:bg-[#111318] active:scale-[0.98] xl:bottom-6 xl:right-6 xl:px-4"
        aria-label="เปิดแชท"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.22)]">
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
                    return (
                      <button
                        key={room.key}
                        type="button"
                        onClick={() => void openRoom(room)}
                        className={`group flex w-full items-center gap-3 rounded-[20px] border p-2.5 text-left transition active:scale-[0.99] ${
                          active
                            ? "border-white/18 bg-white/[0.10]"
                            : "border-transparent hover:border-white/10 hover:bg-white/[0.055]"
                        }`}
                      >
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                          <img
                            src={room.otherImage || "/avatar.png"}
                            alt={room.otherName || "profile"}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.src = "/avatar.png";
                            }}
                          />
                          <span
                            className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#08090d] ${
                              room.kind === "deal"
                                ? "bg-cyan-400 text-black"
                                : "bg-white text-black"
                            }`}
                          >
                            {room.kind === "deal" ? (
                              <Handshake className="h-3 w-3" />
                            ) : (
                              <MessageCircle className="h-3 w-3" />
                            )}
                          </span>
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-black text-white">
                              {room.otherName}
                            </span>
                            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-white/30">
                              {room.kind === "deal" ? "DEAL" : "DM"}
                            </span>
                          </span>
                          {room.kind === "deal" ? (
                            <span className="mt-0.5 block truncate text-[11px] font-bold text-cyan-200/70">
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

                  <img
                    src={activeRoom.other?.image || activeRoom.otherImage || "/avatar.png"}
                    alt={activeRoom.other?.name || activeRoom.otherName || "profile"}
                    className="h-11 w-11 shrink-0 rounded-2xl border border-white/10 object-cover"
                    onError={(event) => {
                      event.currentTarget.src = "/avatar.png";
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black sm:text-base">
                      {activeRoom.other?.name || activeRoom.otherName}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-white/42">
                      {activeRoom.kind === "deal"
                        ? activeRoom.card?.name || activeRoom.dealCardName || "แชทดีล"
                        : "แชทส่วนตัว"}
                    </div>
                  </div>

                  {activeRoom.kind === "deal" ? (
                    <div className="hidden max-w-[124px] shrink-0 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-right sm:block">
                      <div className="truncate text-[10px] font-bold text-cyan-100/60">
                        ราคาดีล
                      </div>
                      <div className="truncate text-sm font-black text-cyan-100">
                        {formatPrice(activeRoom.deal?.offeredPrice || activeRoom.dealPrice)}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  {activeRoom.loading ? (
                    <div className="flex h-full min-h-[260px] items-center justify-center">
                      <Loader2 className="h-7 w-7 animate-spin text-white/45" />
                    </div>
                  ) : messages.length === 0 ? (
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
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} className="h-1 w-full" />
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,6,8,0.24),rgba(5,6,8,0.96))] p-3">
                  {error ? (
                    <div className="mb-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">
                      {error}
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

                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
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
