"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Send, ArrowLeft, Image as ImageIcon, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
};

type UserMapValue = {
  name?: string | null;
  image?: string | null;
};

function formatTime(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DMPage() {
  const params = useParams();
  const roomId = typeof params?.roomId === "string" ? params.roomId : "";
  const router = useRouter();

  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [typing, setTyping] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const [userMap, setUserMap] = useState<Record<string, UserMapValue>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const hasValidRoom = Boolean(roomId);

  const buildSender = (
  senderId: string,
  msg?: { senderName?: string | null; senderImage?: string | null },
  meData?: any,
  otherData?: any
) => {
  const isMine = senderId === meData?.id;

  if (isMine) {
    return {
      id: senderId,
      name: meData?.name || "You",
      image: meData?.image || "/avatar.png",
    };
  }

  return {
    id: senderId,
    name: otherData?.name || "User",
    image: otherData?.image || "/avatar.png",
  };
};

  useEffect(() => {
    if (!roomId) return;

    const init = async () => {
      const meData = await loadSession();
      const otherData = await loadRoom();
      const mapData = await loadUsersMap();
      await loadMessages(meData, otherData, mapData);
    };

    init();
  }, [roomId]);

  const lastSeenMineId = useMemo(() => {
    const mineSeen = messages.filter((m) => m.senderId === me?.id && !!m.seenAt);
    if (mineSeen.length === 0) return null;
    return mineSeen[mineSeen.length - 1].id;
  }, [messages, me?.id]);

  const scrollBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    });
  };

  useEffect(() => {
    if (!hasValidRoom || !me?.id) return;

    const channel = supabase.channel(`dm-${roomId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dmMessage",
        },
        (payload) => {
          const msg = payload.new as any;

          if (msg.roomId !== roomId) return;

          setMessages((prev) => {
            if (prev.find((x) => x.id === msg.id)) return prev;

            return [
              ...prev,
              {
                ...msg,
                sender: buildSender(
                  msg.senderId,
                  {
                    senderName: msg.senderName,
                    senderImage: msg.senderImage,
                  },
                  me,
                  other
                ),
              },
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dmMessage",
        },
        (payload) => {
          const updated = payload.new as any;

          if (updated.roomId !== roomId) return;

          setMessages((prev) =>
            prev.map((x) =>
              x.id === updated.id
                ? {
                    ...x,
                    ...updated,
                    sender: buildSender(
                      updated.senderId,
                      {
                        senderName: updated.senderName,
                        senderImage: updated.senderImage,
                      },
                      me,
                      other
                    ),
                  }
                : x
            )
          );
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.senderId === me?.id) return;
        if (payload.roomId !== roomId) return;

        setTyping(true);

        if (typingTimeout.current) {
          clearTimeout(typingTimeout.current);
        }

        typingTimeout.current = setTimeout(() => {
          setTyping(false);
        }, 1500);
      })
      .subscribe();

    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [hasValidRoom, me?.id, roomId, other, userMap]);

  useEffect(() => {
    scrollBottom(messages.length > 0);
  }, [messages]);

  useEffect(() => {
    if (!roomId || !me?.id || messages.length === 0) return;

    const markSeen = async () => {
      const unread = messages.filter(
        (m) => m.senderId !== me.id && !m.seenAt
      );

      if (unread.length === 0) return;

      const unreadIds = unread.map((m) => m.id);

      const { error } = await supabase
        .from("dmMessage")
        .update({ seenAt: new Date().toISOString() })
        .in("id", unreadIds);

      if (error) {
        console.error("SEEN ERROR:", error);
      }
    };

    markSeen();
  }, [messages, me?.id, roomId]);

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

  const loadSession = async () => {
    const res = await fetch("/api/auth/session");
    const data = await res.json();

    setMe(data.user);
    return data.user;
  };

  const loadRoom = async () => {
    if (!roomId) return null;

    const res = await fetch(`/api/dm/room-info?roomId=${roomId}`, {
      cache: "no-store",
    });

    const data = await res.json();

    setOther(data.otherUser);
    setLoadingRoom(false);
    return data.otherUser;
  };

  const loadUsersMap = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id,name,image");

    if (error) {
      console.error("LOAD USERS MAP ERROR:", error);
      return {};
    }

    const map: Record<string, UserMapValue> = {};

    (data || []).forEach((u: any) => {
      map[u.id] = {
        name: u.name || null,
        image: u.image || null,
      };
    });

    setUserMap(map);
    return map;
  };

  const loadMessages = async (
    meData?: any,
    otherData?: any,
    mapData?: Record<string, UserMapValue>
  ) => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("dmMessage")
      .select("*")
      .eq("roomId", roomId)
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("LOAD MESSAGES ERROR:", error);
      return;
    }

    const withSender = (data || []).map((m: any) => ({
      ...m,
      sender: buildSender(
        m.senderId,
        {
          senderName: m.senderName,
          senderImage: m.senderImage,
        },
        meData,
        otherData,
        mapData
      ),
    }));

    setMessages(withSender);
  };

  const send = async () => {
    if ((!text.trim() && !file) || !me?.id || !roomId) return;

    let imageUrl: string | null = null;

    if (file) {
      const fileName = `${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("chat-images")
        .upload(fileName, file);

      if (error) {
        console.error("UPLOAD ERROR:", error);
        return;
      }

      const { data: url } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      imageUrl = url.publicUrl;
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    const msg = text.trim();
    setText("");
    setShowEmoji(false);

    if (!me || !me.id) {
      alert("ยังไม่ได้ login");
      return;
    }

    const { error } = await supabase.from("dmMessage").insert({
      roomId,
      senderId: me.id,
      content: msg,
      imageUrl,
      seenAt: null,
      senderName: me.name || "You",
      senderImage: me.image || "/avatar.png",
    });

    if (error) {
      console.error("INSERT ERROR:", error);
      return;
    }

    scrollBottom(true);
  };

  const sendTyping = async () => {
    if (!channelRef.current || !me?.id || !roomId) return;

    await channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        senderId: me.id,
        roomId,
      },
    });
  };

  const openOtherProfile = () => {
    if (!other?.id) return;
    router.push(`/profile/${other.id}`);
  };

  if (!hasValidRoom) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-white pb-[env(safe-area-inset-bottom)]">
        กำลังโหลดห้องแชท...
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-[920px] h-full flex flex-col mx-auto px-2 sm:px-4 xl:px-0">

        {/* HEADER */}
        <div className="fixed top-[72px] left-1/2 -translate-x-1/2 w-full max-w-[3200px] z-[3000] border-b border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <div className="mx-auto w-full max-w-[920px] flex items-center gap-3 px-3 py-3 sm:px-4">
            <button
              onClick={() => router.back()}
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
                  <span
                    className={`h-2 w-2 rounded-full ${
                      typing ? "bg-yellow-400 animate-pulse" : "bg-green-400"
                    }`}
                  />
                  <span>{typing ? "กำลังพิมพ์..." : "Online"}</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* CHAT */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 pt-[80px] py-4 sm:px-4 space-y-4 pb-[calc(200px+env(safe-area-inset-bottom))]"
        >
          {messages.map((m) => {
            const mine = m.senderId === me?.id;
            const sender = m.sender;

            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className="flex max-w-[88%] items-end gap-2 sm:max-w-[78%]">
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

                  <div
                    className={`${
                      mine ? "items-end" : "items-start"
                    } flex flex-col`}
                  >
                    {!mine && (
                      <button
                        onClick={openOtherProfile}
                        className="mb-1 text-left text-[11px] text-white/40 transition hover:text-white/70"
                      >
                        {sender?.name || "User"}
                      </button>
                    )}

                    <div
                      className={`bubble-in break-words rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-lg sm:text-[15px] ${
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
        </div>

        {/* INPUT */}
        <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom)+12px)] left-0 right-0 z-[1200] px-3 sm:px-4">
          <div className="mx-auto max-w-[920px] relative">
            {showEmoji && (
              <div
                ref={emojiRef}
                className="absolute bottom-[90px] right-0 z-[9999] rounded-2xl border border-white/10 bg-[#111318] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
              >
                <div className="mb-2 text-xs font-bold text-white/50">
                  เลือกอีโมจิ
                </div>

                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setText((prev) => prev + emojiData.emoji);
                    setShowEmoji(false);
                  }}
                  theme="dark"
                  width={300}
                  height={400}
                />
              </div>
            )}

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 backdrop-blur-2xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  sendTyping();
                }}
                inputMode="text"
                autoComplete="off"
                className="h-12 flex-1 rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 sm:text-[15px]"
                placeholder="พิมพ์ข้อความ... 😊"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />

              <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
                <ImageIcon size={18} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
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
                onClick={send}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.22)] transition hover:scale-[1.02] hover:bg-yellow-300 active:scale-[0.98]"
              >
                <Send size={18} />
              </button>
            </div>

            {file && (
              <div className="mt-2 text-xs text-white/60">
                เลือกไฟล์แล้ว: {file.name}
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
              className="max-h-[90%] max-w-[90%] rounded-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}