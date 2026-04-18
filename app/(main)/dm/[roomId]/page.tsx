"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Send, ArrowLeft } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function safeProfileSrc(image?: string | null) {
  const raw = String(image || "").trim();
  return raw || "/avatar.png";
}

function formatTime(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);

  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DMPage() {

  // ✅ ย้าย hook เข้ามาใน component (ตัวแก้ crash)
  const params = useParams();
  const roomId = params?.roomId as string | undefined;
  const router = useRouter();

  // ✅ กันมือถือ crash
  if (!roomId) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white">
        กำลังโหลดห้องแชท...
      </div>
    );
  }

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [typing, setTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const scrollBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    });
  };

  useEffect(() => {
  if (!roomId) return;

  let mounted = true; // ✅ เพิ่ม

  loadSession();
  loadRoom();
  loadMessages();

  const channel = supabase.channel(`dm-${roomId}`, {
    config: {
      broadcast: { self: false },
    },
  });

  channelRef.current = channel;

    channel.on(
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
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    );

    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload.senderId === me?.id) return;
      if (payload.roomId !== roomId) return;

      setTyping(true);

      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }

      typingTimeout.current = setTimeout(() => {
        setTyping(false);
      }, 1500);
    });

    channel.subscribe();

    return () => {
  mounted = false; // ✅ เพิ่ม

  if (typingTimeout.current) {
    clearTimeout(typingTimeout.current);
  }

  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }
};
  }, [roomId, me?.id]);

  useEffect(() => {
    scrollBottom(messages.length > 0);
  }, [messages]);

  const loadSession = async () => {
    const res = await fetch("/api/auth/session");
    const data = await res.json();
    setMe(data.user);
  };

  const loadRoom = async () => {
    const res = await fetch(`/api/dm/room-info?roomId=${roomId}`);
    const data = await res.json();
    setOther(data.otherUser);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("dmMessage")
      .select("*")
      .eq("roomId", roomId)
      .order("createdAt", { ascending: true });

    if (error) {
      console.error("LOAD MESSAGES ERROR:", error);
      return;
    }

    setMessages(data || []);
    scrollBottom(false);
  };

  const send = async () => {
    if (!text.trim() || !me?.id) return;

    const msg = text.trim();
    setText("");

    const { error } = await supabase.from("dmMessage").insert({
      roomId,
      senderId: me.id,
      content: msg,
    });

    if (error) {
      console.error("INSERT ERROR:", error);
    }
  };

  const sendTyping = async () => {
    if (!channelRef.current || !me?.id) return;

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

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-black via-[#0b0b0b] to-black text-white flex justify-center">
      <div className="w-full max-w-[920px] h-full flex flex-col">

        {/* HEADER */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>

            <button
              onClick={openOtherProfile}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left transition hover:bg-white/5"
            >
              <img
                src={safeProfileSrc(other?.image)}
                alt={other?.name || "profile"}
                className="h-11 w-11 rounded-full object-cover border border-white/15 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                onError={(e) => {
                  e.currentTarget.src = "/avatar.png";
                }}
              />

              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold sm:text-base">
                  {other?.name || "Loading..."}
                </div>

                <div className="flex items-center gap-2 text-xs text-white/45">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      typing ? "bg-yellow-400" : "bg-green-400"
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
          className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 space-y-4"
        >
          {messages.map((m) => {
            const mine = m.senderId === me?.id;

            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="flex max-w-[88%] items-end gap-2 sm:max-w-[78%]">
                  {!mine && (
                    <img
                      src={safeProfileSrc(other?.image)}
                      alt={other?.name || "profile"}
                      className="h-8 w-8 shrink-0 rounded-full object-cover border border-white/10"
                      onError={(e) => {
                        e.currentTarget.src = "/avatar.png";
                      }}
                    />
                  )}

                  <div className={`${mine ? "items-end" : "items-start"} flex flex-col`}>
                    {!mine && (
                      <button
                        onClick={openOtherProfile}
                        className="mb-1 text-left text-[11px] text-white/40 transition hover:text-white/70"
                      >
                        {other?.name || "User"}
                      </button>
                    )}

                    <div
                      className={`break-words rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-lg sm:text-[15px] ${
                        mine
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-300 text-black"
                          : "bg-white/10 text-white backdrop-blur"
                      }`}
                    >
                      {m.content}
                    </div>

                    <div
                      className={`mt-1 px-1 text-[10px] text-white/30 ${
                        mine ? "text-right" : "text-left"
                      }`}
                    >
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* INPUT */}
        <div className="sticky bottom-0 border-t border-white/10 bg-black/50 backdrop-blur-xl">
          <div className="flex items-center gap-2 p-3 sm:p-4">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                sendTyping();
              }}
              className="h-12 flex-1 rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-yellow-400/40 focus:ring-2 focus:ring-yellow-400/20 sm:text-[15px]"
              placeholder="พิมพ์ข้อความ..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />

            <button
              onClick={send}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.22)] transition hover:scale-[1.02] hover:bg-yellow-300 active:scale-[0.98]"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}