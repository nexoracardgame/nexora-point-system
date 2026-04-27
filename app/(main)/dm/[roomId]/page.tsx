"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Send, ArrowLeft, Image as ImageIcon, Smile, X } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { prepareChatImageFile } from "@/lib/chat-image-client";
import { readDmRoomSeed } from "@/lib/dm-room-seed";

type DMMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  sender?: {
    id: string;
    name: string;
    image: string;
  };
  optimistic?: boolean;
};

type ChatUser = {
  id: string;
  name?: string | null;
  image?: string | null;
} | null;

function formatTime(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSender(
  senderId: string,
  msg?: { senderName?: string | null; senderImage?: string | null },
  meData?: ChatUser,
  otherData?: ChatUser
) {
  const isMine = senderId === meData?.id;

  if (isMine) {
    return {
      id: senderId,
      name: meData?.name || msg?.senderName || "You",
      image: meData?.image || msg?.senderImage || "/avatar.png",
    };
  }

  return {
    id: senderId,
    name: otherData?.name || msg?.senderName || "User",
    image: otherData?.image || msg?.senderImage || "/avatar.png",
  };
}

function mergeMessage(
  prev: DMMessage[],
  incoming: DMMessage,
  meData?: ChatUser,
  otherData?: ChatUser
) {
  const nextMessage = {
    ...incoming,
    sender:
      incoming.sender ||
      buildSender(
        incoming.senderId,
        {
          senderName: incoming.senderName,
          senderImage: incoming.senderImage,
        },
        meData,
        otherData
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

export default function DMPage() {
  const params = useParams();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const seededFromStorage = useMemo(() => readDmRoomSeed(roomId), [roomId]);
  const initialOtherName = String(seededFromStorage?.name || "").trim();
  const initialOtherImage = String(seededFromStorage?.image || "").trim();
  const seededOther = useMemo<ChatUser>(
    () =>
      initialOtherName || initialOtherImage
        ? {
            id: "",
            name: initialOtherName || "User",
            image: initialOtherImage || "/avatar.png",
          }
        : null,
    [initialOtherImage, initialOtherName]
  );

  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<ChatUser>(null);
  const [other, setOther] = useState<ChatUser>(seededOther);
  const [loadingRoom, setLoadingRoom] = useState(!seededOther);
  const [roomClosed, setRoomClosed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const hasMarkedSeenRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  const hasValidRoom = Boolean(roomId);
  const backHref = String(searchParams?.get("back") || "").trim();

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

  const checkIsNearBottom = () => {
    return getDistanceFromBottom() < 120;
  };

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

  const loadSession = async () => {
    const res = await fetch("/api/auth/session", {
      cache: "no-store",
    });
    const data = await res.json();

    setMe(data.user);
    return data.user;
  };

  const loadRoom = async () => {
    if (!roomId) return null;

    const res = await fetch(`/api/dm/room-info?roomId=${encodeURIComponent(roomId)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      setRoomClosed(true);
      setLoadingRoom(false);
      return null;
    }

    const data = await res.json();
    setOther(data.otherUser);
    setRoomClosed(false);
    setLoadingRoom(false);
    return data.otherUser;
  };

  const loadMessages = async (meData?: ChatUser, otherData?: ChatUser) => {
    if (!roomId) return;

    const res = await fetch(`/api/dm/messages?roomId=${encodeURIComponent(roomId)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 404 || res.status === 409) {
        setRoomClosed(true);
      }
      return;
    }

    const data = (await res.json()) as DMMessage[];
    const withSender: DMMessage[] = (data || []).map((m) => ({
      ...m,
      sender: buildSender(
        m.senderId,
        {
          senderName: m.senderName,
          senderImage: m.senderImage,
        },
        meData,
        otherData
      ),
    }));

    setMessages((prev) => {
      const optimisticMessages = prev.filter((message) => message.optimistic);
      let next: DMMessage[] = withSender;

      optimisticMessages.forEach((message) => {
        next = mergeMessage(next, message, meData, otherData);
      });

      return next;
    });
  };

  const markSeenNow = async () => {
    if (!roomId || !me?.id) return;

    const hasUnread = messages.some((m) => m.senderId !== me.id && !m.seenAt);
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

  useEffect(() => {
    if (!roomId) return;

    hasInitialScrolledRef.current = false;
    hasMarkedSeenRef.current = false;
    isNearBottomRef.current = true;
    lastMessageIdRef.current = null;
    requestAnimationFrame(() => {
      setLoadingRoom(!seededOther);
      setNewMessageCount(0);
    });

    const init = async () => {
      const [meData, otherData] = await Promise.all([loadSession(), loadRoom()]);
      await loadMessages(meData, otherData);
    };

    void init();
  }, [roomId, seededOther]);

  useEffect(() => {
    if (!roomId || !me?.id || roomClosed) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages(me, other);
      }
    }, 1800);

    const onFocus = () => {
      void loadMessages(me, other);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadMessages(me, other);
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

  const lastSeenMineId = useMemo(() => {
    const mineSeen = messages.filter((m) => m.senderId === me?.id && !!m.seenAt);
    if (mineSeen.length === 0) return null;
    return mineSeen[mineSeen.length - 1].id;
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
      senderName: me.name || "You",
      senderImage: me.image || "/avatar.png",
      sender: buildSender(
        me.id,
        {
          senderName: me.name || "You",
          senderImage: me.image || "/avatar.png",
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
      console.error("SEND DM ERROR:", error);
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setSending(false);
      return;
    }

    if (!res.ok) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      if (res.status === 403 || res.status === 404 || res.status === 409) {
        setRoomClosed(true);
      }
      setSending(false);
      return;
    }

    const insertedMessage = (await res.json()) as DMMessage;
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

  if (!hasValidRoom) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-white pb-[env(safe-area-inset-bottom)]">
        กำลังโหลดห้องแชท...
      </div>
    );
  }

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
        <div className="sticky top-0 z-20 border-b border-white/10 bg-black/75 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
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
                <div className="h-11 w-11 rounded-full bg-white/10 animate-pulse" />
              ) : (
                <img
                  src={other?.image || "/avatar.png"}
                  alt={other?.name || "profile"}
                  className="h-11 w-11 rounded-full object-cover border border-white/15"
                  onError={(e) => {
                    e.currentTarget.src = "/avatar.png";
                  }}
                />
              )}

              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold sm:text-base">
                  {other?.name || "User"}
                </div>

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
            {messages.map((m) => {
              const mine = m.senderId === me?.id;
              const sender = m.sender;

              return (
                <div
                  key={m.id}
                  className={`flex ${
                    mine ? "mb-3 justify-end pr-0 sm:pr-10" : "mb-3 justify-start pl-0"
                  }`}
                >
                  <div className="flex max-w-[94%] items-end gap-2 sm:max-w-[78%]">
                    {!mine &&
                      (loadingRoom ? (
                        <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
                      ) : (
                        <img
                          src={sender?.image || "/avatar.png"}
                          className="h-8 w-8 shrink-0 rounded-full object-cover border border-white/10 opacity-0 animate-[fadeIn_.25s_ease_forwards]"
                          onError={(e) => {
                            e.currentTarget.src = "/avatar.png";
                          }}
                        />
                      ))}

                    <div className={`${mine ? "items-end" : "items-start"} flex flex-col`}>
                      {!mine && (
                        <button
                          onClick={openOtherProfile}
                          className="mb-1 text-left text-[11px] text-white/40 transition hover:text-white/70"
                        >
                          {sender?.name || "User"}
                        </button>
                      )}

                      <div
                        className={`bubble-in break-words rounded-[22px] px-4 py-2.5 text-[14px] leading-relaxed shadow-lg sm:text-[15px] ${
                          mine
                            ? "bg-gradient-to-r from-yellow-400 to-yellow-300 text-black"
                            : "bg-white/10 text-white backdrop-blur"
                        }`}
                      >
                        {m.imageUrl && (
                          <img
                            src={m.imageUrl}
                            onClick={() => setPreview(m.imageUrl || null)}
                            className="mb-2 rounded-xl max-h-[220px] cursor-pointer"
                          />
                        )}

                        {m.content}
                      </div>

                      <div
                        className={`mt-1 px-1 text-[10px] text-white/30 ${
                          mine ? "text-right" : "text-left"
                        }`}
                      >
                        {formatTime(m.createdAt)}
                      </div>

                      {mine && lastSeenMineId === m.id && m.seenAt && (
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
                placeholder="พิมพ์ข้อความ..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
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
                onClick={() => setShowEmoji((v) => !v)}
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

            {file && selectedImagePreview && (
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
            )}
          </div>
        </div>

        {preview && (
          <div
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
          >
            <img src={preview} className="max-h-[90%] max-w-[90%] rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}
