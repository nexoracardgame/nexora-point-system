"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Image as ImageIcon, Send, Smile, X, MoreHorizontal } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { prepareChatImageFile } from "@/lib/chat-image-client";

type ChatUser = {
  id: string;
  name: string;
  image: string;
};

type DealCardInfo = {
  id: string;
  no: string;
  name: string;
  image: string;
  listedPrice: number;
};

type DealInfo = {
  id: string;
  offeredPrice: number;
};

type DealMessage = {
  id: string;
  roomId: string;
  senderId: string;
  sender: ChatUser;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  optimistic?: boolean;
};

function formatTime(dateString?: string | null) {
  if (!dateString) return "";

  return new Date(dateString).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function buildSender(
  senderId: string,
  msg?: { senderName?: string | null; senderImage?: string | null },
  me?: ChatUser | null,
  other?: ChatUser | null
) {
  const isMine = senderId === me?.id;

  if (isMine) {
    return {
      id: senderId,
      name: me?.name || msg?.senderName || "You",
      image: me?.image || msg?.senderImage || "/avatar.png",
    };
  }

  return {
    id: senderId,
    name: other?.name || msg?.senderName || "User",
    image: other?.image || msg?.senderImage || "/avatar.png",
  };
}

function mergeMessage(
  prev: DealMessage[],
  incoming: DealMessage,
  me?: ChatUser | null,
  other?: ChatUser | null
) {
  const nextMessage: DealMessage = {
    ...incoming,
    sender:
      incoming.sender ||
      buildSender(
        incoming.senderId,
        {
          senderName: incoming.senderName,
          senderImage: incoming.senderImage,
        },
        me,
        other
      ),
  };

  const existingIndex = prev.findIndex((item) => item.id === incoming.id);

  if (existingIndex >= 0) {
    const next = [...prev];
    next[existingIndex] = {
      ...next[existingIndex],
      ...nextMessage,
    };
    return next;
  }

  return [...prev, nextMessage];
}

export default function DealChatPage() {
  const params = useParams();
  const dealId = typeof params?.dealId === "string" ? params.dealId : "";
  const router = useRouter();

  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<ChatUser | null>(null);
  const [other, setOther] = useState<ChatUser | null>(null);
  const [card, setCard] = useState<DealCardInfo | null>(null);
  const [deal, setDeal] = useState<DealInfo | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomClosed, setRoomClosed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
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
  const activeDealIdRef = useRef(dealId);
  const activeRoomIdRef = useRef("");
  const messageRequestIdRef = useRef(0);
  const hasValidDealRoom = Boolean(dealId);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;

    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    }

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

  const handleScroll = () => {
    const nearBottom = checkIsNearBottom();
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setNewMessageCount(0);
    }
  };

  const loadRoomInfo = async (showClosedState = true) => {
    if (!dealId) return null;
    const expectedDealId = dealId;

    const res = await fetch(`/api/market/deal-chat/info?dealId=${encodeURIComponent(dealId)}`, {
      cache: "no-store",
    });

    if (activeDealIdRef.current !== expectedDealId) {
      return null;
    }

    if (!res.ok) {
      if (showClosedState && (res.status === 403 || res.status === 404 || res.status === 409)) {
        setRoomClosed(true);
        setLoadingRoom(false);
      }
      return null;
    }

    const data = await res.json();

    setRoomClosed(false);
    const nextRoomId = String(data?.roomId || "");
    activeRoomIdRef.current = nextRoomId;
    setRoomId(nextRoomId);
    setMe(data?.me || null);
    setOther(data?.other || null);
    setCard(data?.card || null);
    setDeal(data?.deal || null);
    setLoadingRoom(false);

    return data;
  };

  const loadMessages = async (
    nextRoomId: string,
    meData?: ChatUser | null,
    otherData?: ChatUser | null
  ) => {
    if (!nextRoomId) return;
    const expectedRoomId = nextRoomId;
    const requestId = ++messageRequestIdRef.current;

    const res = await fetch(`/api/dm/messages?roomId=${encodeURIComponent(nextRoomId)}`, {
      cache: "no-store",
    });

    if (
      requestId !== messageRequestIdRef.current ||
      activeRoomIdRef.current !== expectedRoomId
    ) {
      return;
    }

    if (!res.ok) {
      if (res.status === 403 || res.status === 404 || res.status === 409) {
        setRoomClosed(true);
      }
      return;
    }

    const data = (await res.json()) as Omit<DealMessage, "sender">[];
    const withSender: DealMessage[] = (data || [])
      .filter((message) => String(message.roomId || "") === expectedRoomId)
      .map((message) => ({
        ...message,
        sender: buildSender(
          message.senderId,
          {
            senderName: message.senderName,
            senderImage: message.senderImage,
          },
          meData,
          otherData
        ),
      }));

    setMessages((prev) => {
      const optimisticMessages = prev.filter((message) => message.optimistic);
      let next = withSender;

      optimisticMessages.forEach((message) => {
        next = mergeMessage(next, message, meData, otherData);
      });

      return next;
    });

    if (!hasInitialScrolledRef.current || isNearBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom("auto");
        isNearBottomRef.current = true;
      });
    }
  };

  const refreshChatState = async (showClosedState = false) => {
    const info = await loadRoomInfo(showClosedState);
    if (!info?.roomId) return;
    await loadMessages(info.roomId, info.me, info.other);
  };

  const markSeenNow = async () => {
    if (!roomId || !me?.id) return;

    const hasUnread = messages.some(
      (message) => message.senderId !== me.id && !message.seenAt
    );

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

    if (!res.ok) return;

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

  useEffect(() => {
    if (!dealId) return;

    activeDealIdRef.current = dealId;
    activeRoomIdRef.current = "";
    messageRequestIdRef.current += 1;
    hasInitialScrolledRef.current = false;
    hasMarkedSeenRef.current = false;
    isNearBottomRef.current = true;
    lastMessageIdRef.current = null;
    setMessages([]);
    setRoomId("");
    setRoomClosed(false);
    setLoadingRoom(true);
    setNewMessageCount(0);

    queueMicrotask(() => {
      void refreshChatState(true);
    });
  }, [dealId]);

  useEffect(() => {
    if (!roomId || !me?.id || roomClosed) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages(roomId, me, other);
      }
    }, 650);

    const onFocus = () => {
      void loadMessages(roomId, me, other);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadMessages(roomId, me, other);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomId, me, other, roomClosed]);

  useEffect(() => {
    if (!dealId || !roomId || roomClosed) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRoomInfo(true);
      }
    }, 2500);

    const onFocus = () => {
      void loadRoomInfo(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadRoomInfo(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dealId, roomId, roomClosed]);

  const lastSeenMineId = useMemo(() => {
    const mineSeen = messages.filter((message) => message.senderId === me?.id && !!message.seenAt);
    if (mineSeen.length === 0) return null;
    return mineSeen[mineSeen.length - 1]?.id || null;
  }, [messages, me?.id]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!emojiRef.current) return;
      if (!emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!file) {
      setSelectedImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file]);

  useLayoutEffect(() => {
    if (!messages.length || hasInitialScrolledRef.current) return;

    requestAnimationFrame(() => {
      scrollToBottom("auto");
      isNearBottomRef.current = true;
      lastMessageIdRef.current = messages[messages.length - 1]?.id || null;
      hasInitialScrolledRef.current = true;
    });
  }, [messages.length]);

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
  }, [messages, me?.id]);

  const openOtherProfile = () => {
    if (!other?.id) return;
    router.push(`/profile/${other.id}`);
  };

  const send = async () => {
    if (sending || (!text.trim() && !file) || !me?.id || !other?.id || !roomId || roomClosed) return;

    const msg = text.trim();
    const selectedFile = file;
    const optimisticImageUrl = selectedFile ? selectedImagePreview : null;
    let uploadFile: File | null = null;

    if (selectedFile) {
      try {
        uploadFile = await prepareChatImageFile(selectedFile);
      } catch (error) {
        console.error("DEAL CHAT UPLOAD ERROR:", error);
        alert(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
    }

    setSending(true);
    setShowEmoji(false);

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: DealMessage = {
      id: optimisticId,
      roomId,
      senderId: me.id,
      content: msg || null,
      imageUrl: optimisticImageUrl,
      seenAt: null,
      createdAt: new Date().toISOString(),
      senderName: me.name,
      senderImage: me.image,
      sender: buildSender(
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

    setMessages((prev) => mergeMessage(prev, optimisticMessage, me, other));
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
      console.error("SEND DEAL CHAT ERROR:", error);
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setSending(false);
      return;
    }

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => null);
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      if (res.status === 403 || res.status === 404 || res.status === 409) {
        setRoomClosed(true);
      }
      alert(
        String(errorPayload?.error || "").trim() ||
          "ส่งรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      );
      setSending(false);
      return;
    }

    const insertedMessage = (await res.json()) as DealMessage;
    setMessages((prev) => {
      const withoutOptimistic = prev.filter((message) => message.id !== optimisticId);
      return mergeMessage(withoutOptimistic, insertedMessage, me, other);
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
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
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

  if (!hasValidDealRoom || loadingRoom) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center pb-[env(safe-area-inset-bottom)] text-white">
        กำลังโหลดห้องแชทดีล...
      </div>
    );
  }

  if (roomClosed || !roomId || !me || !other || !card || !deal) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 text-white">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 text-center">
          <div className="text-lg font-black">ห้องแชทดีลนี้ปิดแล้ว</div>
          <div className="mt-2 text-sm text-white/60">
            ดีลนี้ถูกยกเลิก ปิดขาย หรือคุณไม่มีสิทธิ์เข้าถึงแล้ว
          </div>
          <button
            onClick={() => router.push("/market/deals")}
            className="mt-4 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black"
          >
            กลับไป Deal Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col bg-[#050608]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-black/75 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="mx-auto flex w-full max-w-[980px] items-center gap-3 px-3 py-3 sm:px-4">
            <button
              onClick={() => router.push("/market/deals")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>

            <button
              onClick={openOtherProfile}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1 text-left transition hover:bg-white/5 active:scale-[0.98]"
            >
              <img
                src={other.image || "/avatar.png"}
                alt={other.name}
                className="h-11 w-11 rounded-full border border-white/15 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/avatar.png";
                }}
              />

              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold sm:text-base">
                  {other.name}
                </div>

                <div className="truncate text-xs text-white/45">
                  ดีลการ์ด {card.name} #{card.no}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-200 sm:px-3 sm:text-[11px]">
                    ราคาตั้งขาย {formatPrice(card.listedPrice)}
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200 sm:px-3 sm:text-[11px]">
                    ราคาดีล {formatPrice(deal.offeredPrice)}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span>ห้องนัดสถานที่ของดีลนี้</span>
                </div>
              </div>

              <div className="ml-1 shrink-0">
                <div className="overflow-hidden rounded-2xl border border-cyan-300/18 bg-white/[0.04] p-1 shadow-[0_0_18px_rgba(34,211,238,0.10)]">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="aspect-[2/3] h-[44px] w-auto rounded-xl object-cover sm:h-[52px]"
                    onError={(e) => {
                      e.currentTarget.src = "/cards/001.jpg";
                    }}
                  />
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
            <div className="mb-4 rounded-[22px] border border-cyan-300/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(8,10,16,0.92))] p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <img
                  src={card.image}
                  alt={card.name}
                  className="aspect-[2/3] w-14 rounded-xl border border-white/10 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/cards/001.jpg";
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">
                    {card.name}
                  </div>
                  <div className="text-xs text-cyan-300">ห้องดีลของการ์ดใบนี้เท่านั้น</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    ราคาตั้งขาย
                  </div>
                  <div className="mt-1 text-sm font-black text-amber-300 sm:text-base">
                    {formatPrice(card.listedPrice)}
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">
                    ราคาขอดีล
                  </div>
                  <div className="mt-1 text-sm font-black text-cyan-200 sm:text-base">
                    {formatPrice(deal.offeredPrice)}
                  </div>
                </div>
              </div>
            </div>

            {messages.map((message) => {
              const mine = message.senderId === me.id;
              const sender = message.sender;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    mine ? "mb-3 justify-end pr-0 sm:pr-10" : "mb-3 justify-start pl-0"
                  }`}
                >
                  <div className="flex max-w-[94%] items-end gap-2 sm:max-w-[78%]">
                    {!mine && (
                      <img
                        src={sender?.image || "/avatar.png"}
                        alt={sender?.name || "User"}
                        className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/avatar.png";
                        }}
                      />
                    )}

                    <div className={`${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && (
                        <div className="mb-1 text-left text-[11px] text-white/40">
                          {sender?.name || "User"}
                        </div>
                      )}

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
                          {message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="deal chat attachment"
                              onClick={() => setPreview(message.imageUrl || null)}
                              className="mb-2 max-h-[220px] cursor-pointer rounded-xl"
                            />
                          )}

                          {message.content}
                        </div>

                        {mine && !message.optimistic && (
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
                        )}

                        {messageMenuId === message.id && (
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
                        )}
                      </div>

                      <div
                        className={`mt-1 px-1 text-[10px] text-white/30 ${
                          mine ? "text-right" : "text-left"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </div>

                      {mine && lastSeenMineId === message.id && message.seenAt && (
                        <div className="mt-1 px-1 text-[10px] text-emerald-400/80">
                          อ่านแล้ว
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} className="h-1 w-full" />
          </div>
        </div>

        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,6,8,0.18),rgba(5,6,8,0.92)_18%,rgba(5,6,8,0.98)_100%)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-2xl sm:px-4">
          <div className="mx-auto relative w-full max-w-[980px]">
            {newMessageCount > 0 && (
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
            )}

            {showEmoji && (
              <div
                ref={emojiRef}
                className="absolute bottom-[calc(100%+12px)] right-0 z-[9999] overflow-hidden rounded-2xl border border-white/10 bg-[#111318] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
              >
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
            )}

            <div className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-black/70 px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
              <input
                ref={textInputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
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
                placeholder="พิมพ์นัดสถานที่หรือรายละเอียดดีล..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95">
                <ImageIcon size={18} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    requestAnimationFrame(() => {
                      textInputRef.current?.focus();
                    });
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setShowEmoji((prev) => !prev)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
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

            {file && selectedImagePreview && (
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.13),rgba(250,204,21,0.06),rgba(255,255,255,0.04))] p-2 pr-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <img
                  src={selectedImagePreview}
                  alt="selected deal chat image preview"
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white/85">{file.name}</div>
                  <div className="mt-1 text-[11px] text-cyan-100/70">Enter เพื่อส่งรูป</div>
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
            )}
          </div>
        </div>

        {preview && (
          <div
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          >
            <img
              src={preview}
              alt="deal chat preview"
              className="max-h-[90%] max-w-[90%] rounded-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}
