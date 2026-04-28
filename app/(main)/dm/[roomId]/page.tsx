"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Send, ArrowLeft, Image as ImageIcon, Smile, X, MoreHorizontal } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { prepareChatImageFile } from "@/lib/chat-image-client";
import {
  CHAT_HISTORY_PAGE_SIZE,
  buildChatSender,
  buildChatUser,
  mergeChatMessages,
  mergeSingleChatMessage,
  normalizeChatMessage,
  removeChatMessage,
  type ChatMessage as DMMessage,
  type ChatUser,
} from "@/lib/chat-room-types";
import { readChatHistoryCache, writeChatHistoryCache } from "@/lib/chat-history-cache";
import { readDmRoomSeed } from "@/lib/dm-room-seed";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { formatThaiTime } from "@/lib/thai-time";

type DMRoomCacheMeta = {
  me?: ChatUser | null;
  other?: ChatUser | null;
  hasMore?: boolean;
  nextCursor?: string | null;
};

type DirectChatBootstrap = {
  roomId: string;
  me: ChatUser;
  other: ChatUser;
  messages: DMMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

type DirectChatPage = {
  messages: DMMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

export default function DMPage() {
  const params = useParams();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const searchParams = useSearchParams();
  const backHref = String(searchParams?.get("back") || "").trim();

  if (!roomId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center pb-[env(safe-area-inset-bottom)] text-white">
        กำลังโหลดห้องแชท...
      </div>
    );
  }

  return <DMRoomContent key={roomId} roomId={roomId} backHref={backHref} />;
}

function DMRoomContent({
  roomId,
  backHref,
}: {
  roomId: string;
  backHref: string;
}) {
  const router = useRouter();
  const seededRoom = useMemo(() => readDmRoomSeed(roomId), [roomId]);
  const cachedRoom = useMemo(
    () =>
      readChatHistoryCache<DMMessage, DMRoomCacheMeta>("dm-room", roomId),
    [roomId]
  );

  const initialOther = useMemo(() => {
    const otherId = String(seededRoom?.otherUserId || "").trim();
    const otherName = String(seededRoom?.name || "").trim();
    const otherImage = String(seededRoom?.image || "").trim();

    if (!otherId && !otherName && !otherImage) {
      return null;
    }

    return buildChatUser(
      otherId,
      otherName || "User",
      otherImage || "/avatar.png"
    );
  }, [seededRoom]);

  const [messages, setMessages] = useState<DMMessage[]>(cachedRoom?.messages || []);
  const [text, setText] = useState("");
  const [me, setMe] = useState<ChatUser | null>(cachedRoom?.meta?.me || null);
  const [other, setOther] = useState<ChatUser | null>(
    cachedRoom?.meta?.other || initialOther
  );
  const [loadingRoom, setLoadingRoom] = useState(
    !(
      cachedRoom?.messages?.length ||
      cachedRoom?.meta?.me ||
      cachedRoom?.meta?.other ||
      initialOther
    )
  );
  const [roomClosed, setRoomClosed] = useState(false);
  const [hasMore, setHasMore] = useState(Boolean(cachedRoom?.meta?.hasMore));
  const [nextCursor, setNextCursor] = useState<string | null>(
    cachedRoom?.meta?.nextCursor || null
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const hasMarkedSeenRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRoomIdRef = useRef(roomId);
  const loadingOlderRef = useRef(false);
  const olderTimerRef = useRef<number | null>(null);
  const olderIdleRef = useRef<number | null>(null);

  const selectedImagePreview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  const cancelOlderPrefetch = () => {
    if (olderTimerRef.current) {
      window.clearTimeout(olderTimerRef.current);
      olderTimerRef.current = null;
    }

    if (olderIdleRef.current && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(olderIdleRef.current);
      olderIdleRef.current = null;
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior,
    });
  };

  const getDistanceFromBottom = () => {
    const el = scrollRef.current;
    if (!el) return 0;

    return el.scrollHeight - el.scrollTop - el.clientHeight;
  };

  const checkIsNearBottom = () => getDistanceFromBottom() < 120;

  const shouldAutoScrollOnIncoming = () => {
    const el = scrollRef.current;
    if (!el) return true;

    const distanceFromBottom = getDistanceFromBottom();
    const autoScrollThreshold = Math.max(el.clientHeight, 220);

    return distanceFromBottom <= autoScrollThreshold;
  };

  const persistCache = useEffectEvent(() => {
    if (!roomId) return;

    writeChatHistoryCache("dm-room", roomId, {
      messages,
      meta: {
        me,
        other,
        hasMore,
        nextCursor,
      },
      cachedAt: Date.now(),
    });
  });

  const emitChatRead = useEffectEvent((targetRoomId: string) => {
    window.dispatchEvent(
      new CustomEvent("nexora:chat-read", {
        detail: { roomId: targetRoomId },
      })
    );
  });

  const markLoadedRoomSeen = useEffectEvent(
    async (targetRoomId: string, nextMessages: DMMessage[], meData?: ChatUser | null) => {
      const myId = String(meData?.id || "").trim();
      if (!targetRoomId || !myId) return;

      const hasUnread = nextMessages.some(
        (message) => message.senderId !== myId && !message.seenAt
      );
      if (!hasUnread) return;

      const seenAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((message) =>
          message.senderId !== myId && !message.seenAt
            ? { ...message, seenAt }
            : message
        )
      );

      emitChatRead(targetRoomId);

      const res = await fetch("/api/dm/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: targetRoomId,
          action: "markSeen",
        }),
      }).catch(() => null);

      if (!res?.ok) {
        return;
      }

      emitChatRead(targetRoomId);
    }
  );

  const applyBootstrap = useEffectEvent((data: DirectChatBootstrap) => {
    if (!data?.roomId || activeRoomIdRef.current !== data.roomId) {
      return;
    }

    const nextMe = data.me ? buildChatUser(data.me.id, data.me.name, data.me.image, "You") : null;
    const nextOther = data.other
      ? buildChatUser(data.other.id, data.other.name, data.other.image)
      : null;
    const nextMessages = Array.isArray(data.messages)
      ? data.messages.map((message) =>
          normalizeChatMessage(message, data.roomId, nextMe, nextOther)
        )
      : [];

    setMe(nextMe);
    setOther(nextOther);
    setRoomClosed(false);
    setLoadingRoom(false);
    setHasMore(Boolean(data.hasMore));
    setNextCursor(String(data.nextCursor || "").trim() || null);
    setMessages((prev) => {
      const optimisticMessages = prev.filter((message) => message.optimistic);
      return mergeChatMessages(
        nextMessages,
        optimisticMessages,
        data.roomId,
        nextMe,
        nextOther
      );
    });
    void markLoadedRoomSeen(data.roomId, nextMessages, nextMe);
  });

  const loadBootstrap = useEffectEvent(async () => {
    if (!roomId) return;

    const expectedRoomId = roomId;
    const res = await fetch(`/api/dm/bootstrap?roomId=${encodeURIComponent(roomId)}`, {
      cache: "no-store",
    }).catch(() => null);

    if (activeRoomIdRef.current !== expectedRoomId) {
      return;
    }

    if (!res?.ok) {
      if (initialOther?.id) {
        const repairRes = await fetch("/api/dm/create-room", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user2: initialOther.id,
            user2Name: initialOther.name,
            user2Image: initialOther.image,
          }),
        }).catch(() => null);

        if (repairRes?.ok) {
          const repaired = await repairRes.json().catch(() => null);
          const repairedRoomId = String(repaired?.roomId || "").trim();

          if (repairedRoomId && repairedRoomId !== roomId) {
            router.replace(
              `/dm/${encodeURIComponent(repairedRoomId)}?back=${encodeURIComponent("/dm")}`
            );
            return;
          }

          const retryRes = await fetch(
            `/api/dm/bootstrap?roomId=${encodeURIComponent(repairedRoomId || roomId)}`,
            {
              cache: "no-store",
            }
          ).catch(() => null);

          if (activeRoomIdRef.current !== expectedRoomId) {
            return;
          }

          if (retryRes?.ok) {
            const retryData = (await retryRes.json()) as DirectChatBootstrap;
            applyBootstrap(retryData);
            return;
          }
        }
      }

      if (res?.status === 403 || res?.status === 404 || res?.status === 409) {
        setRoomClosed(true);
      }
      setLoadingRoom(false);
      return;
    }

    const data = (await res.json()) as DirectChatBootstrap;
    applyBootstrap(data);
  });

  const loadOlderMessages = async () => {
    const cursor = String(nextCursor || "").trim();
    if (!roomId || !cursor || loadingOlderRef.current || roomClosed) return;

    loadingOlderRef.current = true;

    try {
      const res = await fetch(
        `/api/dm/messages?roomId=${encodeURIComponent(roomId)}&before=${encodeURIComponent(cursor)}&limit=${CHAT_HISTORY_PAGE_SIZE}`,
        {
          cache: "no-store",
        }
      );

      if (activeRoomIdRef.current !== roomId) {
        return;
      }

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 409) {
          setRoomClosed(true);
        }
        return;
      }

      const data = (await res.json()) as DirectChatPage;
      const olderMessages = Array.isArray(data?.messages)
        ? data.messages.map((message) =>
            normalizeChatMessage(message, roomId, me, other)
          )
        : [];

      setHasMore(Boolean(data?.hasMore));
      setNextCursor(String(data?.nextCursor || "").trim() || null);
      setMessages((prev) => mergeChatMessages(prev, olderMessages, roomId, me, other));
    } finally {
      loadingOlderRef.current = false;
    }
  };

  const scheduleOlderPrefetch = useEffectEvent(() => {
    if (!roomId || roomClosed || !hasMore || !nextCursor || loadingOlderRef.current) {
      return;
    }

    cancelOlderPrefetch();
    const requestIdleCallback = (window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
    }).requestIdleCallback;

    if (requestIdleCallback) {
      olderIdleRef.current = requestIdleCallback(
        () => {
          olderIdleRef.current = null;
          void loadOlderMessages();
        },
        { timeout: 1400 }
      );
      return;
    }

    olderTimerRef.current = window.setTimeout(() => {
      olderTimerRef.current = null;
      void loadOlderMessages();
    }, 320);
  });

  useEffect(() => {
    const cached = readChatHistoryCache<DMMessage, DMRoomCacheMeta>(
      "dm-room",
      roomId
    );

    if (!cached) {
      return;
    }

    const cachedMe = cached.meta?.me
      ? buildChatUser(cached.meta.me.id, cached.meta.me.name, cached.meta.me.image, "You")
      : null;
    const cachedOther = cached.meta?.other
      ? buildChatUser(cached.meta.other.id, cached.meta.other.name, cached.meta.other.image)
      : initialOther;
    const cachedMessages = Array.isArray(cached.messages)
      ? cached.messages.map((message) =>
          normalizeChatMessage(message, roomId, cachedMe, cachedOther)
        )
      : [];

    if (cachedMessages.length > 0) {
      setMessages((prev) =>
        prev.length > 0
          ? prev
          : mergeChatMessages(prev, cachedMessages, roomId, cachedMe, cachedOther)
      );
    }

    if (cachedMe) {
      setMe((prev) => prev || cachedMe);
    }

    if (cachedOther) {
      setOther((prev) => prev || cachedOther);
    }

    if (cached.meta?.hasMore) {
      setHasMore(true);
    }

    if (cached.meta?.nextCursor) {
      setNextCursor((prev) => prev || cached.meta?.nextCursor || null);
    }

    if (cachedMessages.length > 0 || cachedMe || cachedOther) {
      setLoadingRoom(false);
    }
  }, [initialOther, roomId]);

  const markSeenNow = async () => {
    if (!roomId || !me?.id) return;

    const hasUnread = messages.some((message) => message.senderId !== me.id && !message.seenAt);
    if (!hasUnread) return;

    const res = await fetch("/api/dm/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        action: "markSeen",
      }),
    });

    if (!res.ok) {
      return;
    }

    const payload = await res.json();
    const seenAt = String(payload?.seenAt || new Date().toISOString());

    setMessages((prev) =>
      prev.map((message) =>
        message.senderId !== me.id && !message.seenAt
          ? { ...message, seenAt }
          : message
      )
    );
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    const nearBottom = checkIsNearBottom();
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setNewMessageCount(0);
    }

    if (el && el.scrollTop < 160 && hasMore) {
      void loadOlderMessages();
    }
  };

  useEffect(() => {
    activeRoomIdRef.current = roomId;
    hasInitialScrolledRef.current = false;
    hasMarkedSeenRef.current = false;
    isNearBottomRef.current = true;
    lastMessageIdRef.current = null;
    loadingOlderRef.current = false;
    cancelOlderPrefetch();

    queueMicrotask(() => {
      void loadBootstrap();
    });

    return () => {
      cancelOlderPrefetch();
    };
  }, [roomId]);

  useEffect(() => {
    persistCache();
  }, [hasMore, me, messages, nextCursor, other, roomId]);

  useEffect(() => {
    if (!roomId || roomClosed) return;
    scheduleOlderPrefetch();

    return () => {
      cancelOlderPrefetch();
    };
  }, [hasMore, messages.length, nextCursor, roomClosed, roomId]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || !roomId || roomClosed) {
      return;
    }

    const channel = supabase.channel(`dm-room-${roomId}-${Date.now()}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmMessage", filter: `roomId=eq.${roomId}` },
      (payload) => {
        if (activeRoomIdRef.current !== roomId) {
          return;
        }

        if (payload.eventType === "DELETE") {
          const deletedId = String((payload.old as { id?: string } | null)?.id || "").trim();
          if (!deletedId) return;

          setMessages((prev) => removeChatMessage(prev, deletedId));
          setMessageMenuId((current) => (current === deletedId ? null : current));
          return;
        }

        const incoming = normalizeChatMessage(
          payload.new as DMMessage,
          roomId,
          me,
          other
        );

        setMessages((prev) =>
          payload.eventType === "UPDATE"
            ? mergeSingleChatMessage(prev, incoming, roomId, me, other)
            : mergeSingleChatMessage(prev, incoming, roomId, me, other)
        );

        if (
          payload.eventType === "INSERT" &&
          incoming.senderId !== me?.id &&
          document.visibilityState === "visible"
        ) {
          void markLoadedRoomSeen(roomId, [incoming], me);
        }
      }
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me, other, roomClosed, roomId]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!emojiRef.current?.contains(event.target as Node)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (selectedImagePreview) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

  useLayoutEffect(() => {
    if (!messages.length || hasInitialScrolledRef.current) return;

    requestAnimationFrame(() => {
      scrollToBottom("auto");
      isNearBottomRef.current = true;
      lastMessageIdRef.current = messages[messages.length - 1]?.id || null;
      hasInitialScrolledRef.current = true;
    });
  }, [messages]);

  useEffect(() => {
    if (!messages.length || !hasInitialScrolledRef.current) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    if (!lastMessageIdRef.current) {
      lastMessageIdRef.current = latestMessage.id;
      return;
    }

    if (lastMessageIdRef.current === latestMessage.id) return;
    lastMessageIdRef.current = latestMessage.id;

    const isMine = latestMessage.senderId === me?.id || latestMessage.optimistic;
    const nearBottom = checkIsNearBottom();
    const shouldAutoScroll = isMine || shouldAutoScrollOnIncoming();
    isNearBottomRef.current = nearBottom;

    if (shouldAutoScroll) {
      requestAnimationFrame(() => {
        scrollToBottom(isMine ? "smooth" : "auto");
        setNewMessageCount(0);
        isNearBottomRef.current = true;
      });
      return;
    }

    requestAnimationFrame(() => {
      setNewMessageCount((prev) => prev + 1);
    });
  }, [me?.id, messages]);

  const lastSeenMineId = useMemo(() => {
    const mineSeen = messages.filter((message) => message.senderId === me?.id && !!message.seenAt);
    if (mineSeen.length === 0) return null;
    return mineSeen[mineSeen.length - 1]?.id || null;
  }, [messages, me?.id]);

  const send = async () => {
    if (sending || (!text.trim() && !file) || !me?.id || !roomId || roomClosed) return;

    const msg = text.trim();
    const selectedFile = file;
    const optimisticImageUrl = selectedFile ? selectedImagePreview : null;
    let uploadFile: File | null = null;

    if (selectedFile) {
      try {
        uploadFile = await prepareChatImageFile(selectedFile);
      } catch (error) {
        console.error("UPLOAD ERROR:", error);
        alert(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
    }

    setSending(true);
    setShowEmoji(false);

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: DMMessage = {
      id: optimisticId,
      roomId,
      senderId: me.id,
      content: msg || null,
      imageUrl: optimisticImageUrl,
      seenAt: null,
      createdAt: new Date().toISOString(),
      senderName: me.name,
      senderImage: me.image,
      sender: buildChatSender(
        me.id,
        {
          senderName: me.name,
          senderImage: me.image,
        },
        me,
        other
      ),
      optimistic: true,
    };

    setMessages((prev) => mergeSingleChatMessage(prev, optimisticMessage, roomId, me, other));
    scrollToBottom("smooth");

    let res: Response;

    try {
      if (uploadFile) {
        const formData = new FormData();
        formData.append("roomId", roomId);
        formData.append("content", msg);
        formData.append("file", uploadFile);

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
            roomId,
            content: msg,
          }),
        });
      }
    } catch (error) {
      console.error("SEND DM ERROR:", error);
      setMessages((prev) => removeChatMessage(prev, optimisticId));
      setSending(false);
      return;
    }

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => null);
      setMessages((prev) => removeChatMessage(prev, optimisticId));
      if (res.status === 403 || res.status === 404 || res.status === 409) {
        setRoomClosed(true);
      }
      alert(
        String(errorPayload?.error || "").trim() ||
          "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      );
      setSending(false);
      return;
    }

    const insertedMessage = normalizeChatMessage(
      (await res.json()) as DMMessage,
      roomId,
      me,
      other
    );
    setMessages((prev) => {
      const withoutOptimistic = removeChatMessage(prev, optimisticId);
      return mergeSingleChatMessage(withoutOptimistic, insertedMessage, roomId, me, other);
    });
    setText("");
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSending(false);
    scrollToBottom("smooth");
  };

  const deleteMessage = async (messageId: string) => {
    if (!messageId || !roomId) return;

    const snapshot = messages;
    setMessages((prev) => removeChatMessage(prev, messageId));
    setMessageMenuId(null);

    const res = await fetch("/api/dm/messages", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        messageId,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setMessages(snapshot);
      alert("ลบข้อความไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const startLongPress = (messageId: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      setMessageMenuId(messageId);
    }, 650);
  };

  const stopLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openOtherProfile = () => {
    if (!other?.id) return;
    router.push(`/profile/${other.id}`);
  };

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
      return;
    }

    router.back();
  };

  if (roomClosed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 text-white">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-center">
          <div className="text-lg font-black">ห้องแชทนี้ไม่สามารถใช้งานได้</div>
          <div className="mt-2 text-sm text-white/60">
            คุณไม่มีสิทธิ์เข้าถึงห้องนี้ หรือห้องถูกปิดไปแล้ว
          </div>
          <button
            onClick={() => router.push("/dm")}
            className="mt-4 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"
          >
            กลับไปหน้าแชท
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col bg-[#050608]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-black/75 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[980px] items-center gap-3 px-3 py-3 sm:px-4">
            <button
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>

            <button
              onClick={openOtherProfile}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1 text-left transition hover:bg-white/5 active:scale-[0.98]"
            >
              {loadingRoom ? (
                <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
              ) : other?.image ? (
                <img
                  src={other.image}
                  alt={other.name || "profile"}
                  className="h-11 w-11 rounded-full border border-white/15 object-cover"
                  onError={(event) => {
                    event.currentTarget.src = "/avatar.png";
                  }}
                />
              ) : (
                <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
              )}

              <div className="min-w-0">
                {other?.name ? (
                  <div className="truncate text-[15px] font-bold sm:text-base">
                    {other.name}
                  </div>
                ) : (
                  <div className="h-4 w-28 animate-pulse rounded-full bg-white/10 sm:h-5 sm:w-36" />
                )}

                <div className="flex items-center gap-2 text-xs text-white/45">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span>Private Chat</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto flex min-h-full w-full max-w-[980px] flex-col justify-end px-3 pb-4 pt-4 sm:px-4 sm:pb-5">
            {loadingRoom && messages.length === 0 ? (
              <div className="space-y-3">
                <div className="ml-auto h-16 w-[68%] animate-pulse rounded-[22px] bg-yellow-400/15" />
                <div className="h-16 w-[76%] animate-pulse rounded-[22px] bg-white/8" />
                <div className="ml-auto h-16 w-[54%] animate-pulse rounded-[22px] bg-yellow-400/15" />
              </div>
            ) : null}

            {messages.map((message) => {
              const mine = message.senderId === me?.id;
              const sender = mine
                ? buildChatSender(
                    String(message.senderId || "").trim(),
                    {
                      senderName: message.senderName,
                      senderImage: message.senderImage,
                    },
                    me,
                    other
                  )
                : {
                    id: String(other?.id || message.senderId || "").trim(),
                    name:
                      String(other?.name || message.senderName || "").trim() || null,
                    image:
                      String(other?.image || message.senderImage || "").trim() || null,
                  };

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    mine ? "mb-3 justify-end pr-0 sm:pr-10" : "mb-3 justify-start pl-0"
                  }`}
                >
                  <div className="flex max-w-[94%] items-end gap-2 sm:max-w-[78%]">
                    {!mine &&
                      (!sender.image && !message.senderImage ? (
                        <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                      ) : (
                        <img
                          src={sender.image || "/avatar.png"}
                          alt={sender.name || "profile"}
                          className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover"
                          onError={(event) => {
                            event.currentTarget.src = "/avatar.png";
                          }}
                        />
                      ))}

                    <div className={`${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && sender.name ? (
                        <button
                          onClick={openOtherProfile}
                          className="mb-1 text-left text-[11px] text-white/40 transition hover:text-white/70"
                        >
                          {sender.name}
                        </button>
                      ) : null}

                      <div
                        className="group/message relative"
                        onTouchStart={() => mine && startLongPress(message.id)}
                        onTouchEnd={stopLongPress}
                        onTouchCancel={stopLongPress}
                      >
                        <div
                          className={`break-words rounded-[22px] px-4 py-2.5 text-[14px] leading-relaxed shadow-lg sm:text-[15px] ${
                            mine
                              ? "bg-gradient-to-r from-yellow-400 to-yellow-300 text-black"
                              : "bg-white/10 text-white backdrop-blur"
                          }`}
                        >
                          {message.imageUrl ? (
                            <img
                              src={message.imageUrl}
                              alt="chat attachment"
                              onClick={() => setPreview(message.imageUrl || null)}
                              className="mb-2 max-h-[220px] cursor-pointer rounded-xl"
                            />
                          ) : null}

                          {message.content}
                        </div>

                        {mine && !message.optimistic ? (
                          <button
                            type="button"
                            onClick={() =>
                              setMessageMenuId((current) =>
                                current === message.id ? null : message.id
                              )
                            }
                            className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#111318]/95 p-1.5 text-white/65 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:text-white group-hover/message:opacity-100 ${
                              mine ? "-left-9" : "-right-9"
                            } ${messageMenuId === message.id ? "opacity-100" : ""}`}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        ) : null}

                        {messageMenuId === message.id ? (
                          <div
                            className={`absolute z-30 mt-2 min-w-[132px] overflow-hidden rounded-2xl border border-red-300/15 bg-[#121318]/98 p-1 shadow-[0_20px_55px_rgba(0,0,0,0.55)] ${
                              mine ? "right-0" : "left-0"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void deleteMessage(message.id)}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-300 transition hover:bg-red-500/12"
                            >
                              ลบข้อความ
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div
                        className={`mt-1 px-1 text-[10px] text-white/30 ${
                          mine ? "text-right" : "text-left"
                        }`}
                      >
                        {formatThaiTime(message.createdAt)}
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
            <div ref={bottomRef} className="h-1 w-full" />
          </div>
        </div>

        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,6,8,0.18),rgba(5,6,8,0.92)_18%,rgba(5,6,8,0.98)_100%)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-2xl sm:px-4">
          <div className="relative mx-auto w-full max-w-[980px]">
            {newMessageCount > 0 ? (
              <div className="pointer-events-none absolute -top-14 left-1/2 z-20 -translate-x-1/2">
                <button
                  type="button"
                  onClick={() => {
                    scrollToBottom("smooth");
                    setNewMessageCount(0);
                    isNearBottomRef.current = true;
                  }}
                  className="pointer-events-auto rounded-full border border-yellow-300/25 bg-[#16181d]/95 px-4 py-2 text-sm font-bold text-yellow-300 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:scale-[1.02] hover:bg-[#1b1e24]"
                >
                  มีข้อความใหม่ {newMessageCount > 1 ? `(${newMessageCount}) ` : ""}ดู
                </button>
              </div>
            ) : null}

            {showEmoji ? (
              <div
                ref={emojiRef}
                className="absolute bottom-[calc(100%+12px)] right-0 z-[9999] overflow-hidden rounded-2xl border border-white/10 bg-[#111318] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
              >
                <div className="mb-2 text-xs font-bold text-white/50">เลือกอีโมจิ</div>

                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setText((prev) => prev + emojiData.emoji);
                    setShowEmoji(false);
                  }}
                  theme={Theme.DARK}
                  width={300}
                  height={400}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-black/70 px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
              <input
                ref={textInputRef}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                }}
                onFocus={async () => {
                  if (hasMarkedSeenRef.current) return;
                  hasMarkedSeenRef.current = true;
                  await markSeenNow();
                  setTimeout(() => {
                    hasMarkedSeenRef.current = false;
                  }, 300);
                }}
                inputMode="text"
                autoComplete="off"
                className="h-12 min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 sm:text-[15px]"
                placeholder="พิมพ์ข้อความ..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />

              <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
                <ImageIcon size={18} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    requestAnimationFrame(() => {
                      textInputRef.current?.focus();
                    });
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setShowEmoji((current) => !current)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              >
                <Smile size={18} />
              </button>

              <button
                onClick={() => void send()}
                disabled={sending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.22)] transition hover:scale-[1.02] hover:bg-yellow-300 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                <Send size={18} />
              </button>
            </div>

            {file && selectedImagePreview ? (
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-yellow-300/20 bg-[linear-gradient(135deg,rgba(250,204,21,0.12),rgba(255,255,255,0.04))] p-2 pr-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <img
                  src={selectedImagePreview}
                  alt="selected image preview"
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white/85">{file.name}</div>
                  <div className="mt-1 text-[11px] text-yellow-200/70">Enter เพื่อส่งรูป</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                    requestAnimationFrame(() => {
                      textInputRef.current?.focus();
                    });
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/75 transition hover:bg-white/20 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {preview ? (
          <div
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          >
            <img src={preview} alt="chat preview" className="max-h-[90%] max-w-[90%] rounded-xl" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
