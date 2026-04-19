"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import type { DMRoomListItem } from "@/lib/dm-list";
import { saveDmRoomSeed } from "@/lib/dm-room-seed";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SessionUser = {
  id: string;
  lineId?: string | null;
  name?: string | null;
  image?: string | null;
};

type MessageRow = {
  roomId?: string;
  senderId?: string;
  senderName?: string | null;
  senderImage?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  seenAt?: string | null;
};

function buildPreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "รูปภาพ";
  return "เริ่มแชท";
}

function formatRoomTime(dateString?: string) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

export default function DMListClient({
  initialRooms,
  initialMe,
}: {
  initialRooms: DMRoomListItem[];
  initialMe: SessionUser | null;
}) {
  const [rooms, setRooms] = useState<DMRoomListItem[]>(initialRooms);
  const [loading, setLoading] = useState(initialRooms.length === 0);

  const hasInit = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<SessionUser | null>(initialMe);

  const hydrateUnknownRooms = async (baseRooms: DMRoomListItem[]) => {
    const unknownRooms = baseRooms.filter(
      (room) => room.otherName === "User" || room.otherImage === "/avatar.png"
    );

    if (unknownRooms.length === 0) return;

    await Promise.all(
      unknownRooms.map(async (room) => {
        try {
          const res = await fetch(`/api/dm/room-info?roomId=${room.roomId}`, {
            cache: "no-store",
          });

          if (!res.ok) return;

          const data = await res.json();
          const otherUser = data?.otherUser as
            | { name?: string | null; image?: string | null }
            | undefined;

          if (!otherUser?.name && !otherUser?.image) return;

          setRooms((prev) =>
            prev.map((item) =>
              item.roomId === room.roomId
                ? {
                    ...item,
                    otherName:
                      otherUser.name && otherUser.name !== "User"
                        ? otherUser.name
                        : item.otherName,
                    otherImage:
                      otherUser.image && otherUser.image !== "/avatar.png"
                        ? otherUser.image
                        : item.otherImage,
                  }
                : item
            )
          );
        } catch {
          return;
        }
      })
    );
  };

  const loadRooms = async () => {
    try {
      const res = await fetch("/api/dm/list", {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("LOAD DM LIST ERROR:", res.status, res.statusText);
        return;
      }

      const data = await res.json();
      const nextRooms: DMRoomListItem[] = Array.isArray(data?.rooms)
        ? data.rooms.map((room: Partial<DMRoomListItem>) => ({
            roomId: String(room.roomId || ""),
            otherName: String(room.otherName || "User"),
            otherImage: String(room.otherImage || "/avatar.png"),
            lastMessage: String(room.lastMessage || ""),
            createdAt: String(room.createdAt || ""),
            unread: Number(room.unread || 0),
          }))
        : [];

      setRooms(nextRooms);
      void hydrateUnknownRooms(nextRooms);
    } finally {
      setLoading(false);
    }
  };

  const applyRealtimeMessage = (row: MessageRow, eventType: string) => {
    if (!row.roomId) return;

    const me = meRef.current;
    const isMine =
      row.senderId === me?.id ||
      (me?.lineId ? row.senderId === me.lineId : false);

    if (eventType === "INSERT") {
      setRooms((prev) => {
        const targetIndex = prev.findIndex((room) => room.roomId === row.roomId);

        if (targetIndex < 0) {
          void loadRooms();
          return prev;
        }

        const next = [...prev];
        const target = next[targetIndex];

        next[targetIndex] = {
          ...target,
          lastMessage: buildPreview(row.content, row.imageUrl),
          createdAt: String(row.createdAt || target.createdAt || ""),
          unread: isMine ? target.unread : target.unread + 1,
          otherName:
            !isMine && row.senderName && row.senderName !== "User"
              ? row.senderName
              : target.otherName,
          otherImage:
            !isMine && row.senderImage && row.senderImage !== "/avatar.png"
              ? row.senderImage
              : target.otherImage,
        };

        next.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        return next;
      });
      return;
    }

    if (eventType === "UPDATE") {
      setRooms((prev) =>
        prev.map((room) =>
          room.roomId === row.roomId
            ? {
                ...room,
                lastMessage: buildPreview(row.content, row.imageUrl) || room.lastMessage,
                createdAt: String(row.createdAt || room.createdAt || ""),
                unread: row.seenAt ? 0 : room.unread,
              }
            : room
        )
      );
      return;
    }

    void loadRooms();
  };

  useEffect(() => {
    if (initialRooms.length > 0) {
      void hydrateUnknownRooms(initialRooms);
    }
  }, [initialRooms]);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    let active = true;

    const init = async () => {
      if (!meRef.current) {
        const sessionRes = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const sessionData = await sessionRes.json();
        meRef.current = (sessionData?.user || null) as SessionUser | null;
      }

      if (rooms.length === 0) {
        await loadRooms();
      } else {
        setLoading(false);
        globalThis.setTimeout(() => {
          void loadRooms();
        }, 0);
      }

      if (!active) return;

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase.channel(`dm-list-${Date.now()}`);

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dmMessage" },
        (payload) => {
          const row = (payload.new || payload.old || {}) as MessageRow;
          applyRealtimeMessage(row, payload.eventType);
        }
      );

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          void loadRooms();
        }
      );

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_room" },
        () => {
          void loadRooms();
        }
      );

      channelRef.current = channel;
      channel.subscribe();
    };

    void init();

    return () => {
      active = false;

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [initialRooms.length, rooms.length]);

  return (
    <div className="mx-auto max-w-[720px] px-3 py-4 text-white">
      <h1 className="mb-4 text-xl font-bold">แชท</h1>

      <div className="space-y-2">
        {loading && rooms.length === 0 && (
          <>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 h-4 w-40 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-28 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          </>
        )}

        {rooms.map((room) => (
          <Link
            key={room.roomId}
            href={`/dm/${room.roomId}?back=${encodeURIComponent("/dm")}`}
            onClick={() => {
              saveDmRoomSeed(room.roomId, {
                name: room.otherName,
                image: room.otherImage,
              });
            }}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-yellow-300/10 hover:bg-white/[0.04]"
          >
            <div className="relative">
              <img
                src={room.otherImage}
                alt={room.otherName}
                className="h-12 w-12 rounded-full border border-white/10 object-cover"
              />

              {room.unread > 0 && (
                <div className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                  {room.unread > 99 ? "99+" : room.unread}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="truncate font-bold">{room.otherName}</div>
                <div className="shrink-0 text-[11px] text-white/35">
                  {formatRoomTime(room.createdAt)}
                </div>
              </div>

              <div
                className={`truncate text-sm ${
                  room.unread > 0 ? "font-semibold text-white/90" : "text-white/50"
                }`}
              >
                {room.lastMessage}
              </div>
            </div>
          </Link>
        ))}

        {!loading && rooms.length === 0 && (
          <div className="mt-10 text-center text-white/40">ยังไม่มีแชท</div>
        )}
      </div>
    </div>
  );
}
