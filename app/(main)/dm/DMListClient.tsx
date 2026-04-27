"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DMRoomListItem } from "@/lib/dm-list";
import { saveDmRoomSeed } from "@/lib/dm-room-seed";

type SessionUser = {
  id: string;
  lineId?: string | null;
  name?: string | null;
  image?: string | null;
};

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

function formatDealPrice(value?: number) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  return `฿${amount.toLocaleString("th-TH")}`;
}

function normalizeRoom(room: Partial<DMRoomListItem>): DMRoomListItem {
  return {
    kind: room.kind === "deal" ? "deal" : "direct",
    roomId: String(room.roomId || ""),
    otherUserId: room.otherUserId ? String(room.otherUserId) : undefined,
    dealId: room.dealId ? String(room.dealId) : undefined,
    otherName: String(room.otherName || "User"),
    otherImage: String(room.otherImage || "/avatar.png"),
    lastMessage: String(room.lastMessage || ""),
    createdAt: String(room.createdAt || ""),
    unread: Number(room.unread || 0),
    dealCardName: room.dealCardName ? String(room.dealCardName) : undefined,
    dealPrice: Number(room.dealPrice || 0),
    sellerName: room.sellerName ? String(room.sellerName) : undefined,
    sellerImage: room.sellerImage ? String(room.sellerImage) : undefined,
  };
}

export default function DMListClient({
  initialRooms,
  initialMe,
}: {
  initialRooms: DMRoomListItem[];
  initialMe: SessionUser | null;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState<DMRoomListItem[]>(
    initialRooms.map(normalizeRoom)
  );
  const [loading, setLoading] = useState(initialRooms.length === 0);
  const [openingRoomId, setOpeningRoomId] = useState<string | null>(null);

  const hasInit = useRef(false);
  const meRef = useRef<SessionUser | null>(initialMe);

  const directRooms = useMemo(
    () => rooms.filter((room) => room.kind !== "deal"),
    [rooms]
  );
  const dealRooms = useMemo(
    () => rooms.filter((room) => room.kind === "deal" && room.dealId),
    [rooms]
  );

  const hydrateUnknownRooms = async (baseRooms: DMRoomListItem[]) => {
    const unknownRooms = baseRooms.filter(
      (room) =>
        room.kind !== "deal" &&
        (room.otherName === "User" || room.otherImage === "/avatar.png")
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
        ? data.rooms.map(normalizeRoom)
        : [];

      setRooms(nextRooms);
      void hydrateUnknownRooms(nextRooms);
    } finally {
      setLoading(false);
    }
  };

  const openDirectRoom = async (room: DMRoomListItem) => {
    if (openingRoomId || !room.otherUserId) {
      router.push(`/dm/${encodeURIComponent(room.roomId)}?back=${encodeURIComponent("/dm")}`);
      return;
    }

    setOpeningRoomId(room.roomId);

    try {
      const res = await fetch("/api/dm/create-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user2: room.otherUserId,
          user2Name: room.otherName,
          user2Image: room.otherImage,
          legacyRoomId: room.roomId,
        }),
      });

      if (!res.ok) {
        throw new Error("open failed");
      }

      const data = await res.json();
      const nextRoomId = String(data?.roomId || room.roomId).trim();

      saveDmRoomSeed(nextRoomId, {
        name: room.otherName,
        image: room.otherImage,
        otherUserId: room.otherUserId,
      });

      router.push(`/dm/${encodeURIComponent(nextRoomId)}?back=${encodeURIComponent("/dm")}`);
    } catch {
      router.push(`/dm/${encodeURIComponent(room.roomId)}?back=${encodeURIComponent("/dm")}`);
    } finally {
      setOpeningRoomId(null);
    }
  };

  useEffect(() => {
    if (initialRooms.length > 0) {
      void hydrateUnknownRooms(initialRooms.map(normalizeRoom));
    }
  }, [initialRooms]);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    void (async () => {
      if (!meRef.current) {
        const sessionRes = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const sessionData = await sessionRes.json();
        meRef.current = (sessionData?.user || null) as SessionUser | null;
      }

      if (initialRooms.length === 0) {
        await loadRooms();
      } else {
        setLoading(false);
        void loadRooms();
      }
    })();
  }, [initialRooms.length]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRooms();
      }
    }, 2500);

    const onFocus = () => {
      void loadRooms();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadRooms();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[920px] px-3 py-4 text-white sm:py-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-yellow-200/45">
            NEXORA COMMS
          </div>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">แชท</h1>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-white/45">
          {rooms.length} rooms
        </div>
      </div>

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

        {directRooms.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-black text-white">DM ส่วนตัว</h2>
              <span className="text-[11px] font-bold text-white/35">
                {directRooms.length} active
              </span>
            </div>

            <div className="space-y-2">
              {directRooms.map((room) => (
                <Link
                  key={room.roomId}
                  href={`/dm/${encodeURIComponent(room.roomId)}?back=${encodeURIComponent("/dm")}`}
                  prefetch
                  onMouseEnter={() => {
                    saveDmRoomSeed(room.roomId, {
                      name: room.otherName,
                      image: room.otherImage,
                      otherUserId: room.otherUserId,
                    });
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    saveDmRoomSeed(room.roomId, {
                      name: room.otherName,
                      image: room.otherImage,
                      otherUserId: room.otherUserId,
                    });
                    void openDirectRoom(room);
                  }}
                  className="group flex items-center gap-3 rounded-[24px] border border-white/5 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition hover:border-yellow-300/20 hover:bg-white/[0.055]"
                >
                  <div className="relative">
                    <img
                      src={room.otherImage}
                      alt={room.otherName}
                      className="h-[52px] w-[52px] rounded-full border border-white/10 object-cover"
                    />

                    {room.unread > 0 && (
                      <div className="absolute -right-1 -top-1 min-w-[21px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                        {room.unread > 99 ? "99+" : room.unread}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="truncate font-black">{room.otherName}</div>
                      <div className="shrink-0 text-[11px] text-white/35">
                        {formatRoomTime(room.createdAt)}
                      </div>
                    </div>

                    <div
                      className={`truncate text-sm ${
                        room.unread > 0
                          ? "font-semibold text-white/90"
                          : "text-white/50"
                      }`}
                    >
                      {room.lastMessage}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {dealRooms.length > 0 && (
          <section className="pt-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-black text-cyan-100">ห้องดีล</h2>
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100/70">
                synced deals
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {dealRooms.map((room) => (
                <Link
                  key={room.roomId}
                  href={`/market/deals/chat/${room.dealId}`}
                  prefetch
                  className="group relative overflow-hidden rounded-[22px] border border-cyan-300/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.09),rgba(255,255,255,0.025))] p-3 transition hover:border-cyan-200/25 hover:shadow-[0_0_28px_rgba(34,211,238,0.10)]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.10),transparent_34%)] opacity-70" />
                  <div className="relative flex items-start gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={room.otherImage}
                        alt={room.otherName}
                        className="h-11 w-11 rounded-2xl border border-white/10 object-cover"
                      />
                      {room.unread > 0 && (
                        <div className="absolute -right-1 -top-1 min-w-[20px] rounded-full border border-red-300/40 bg-[radial-gradient(circle_at_top,#ff7b7b,#ef4444_60%,#b91c1c)] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]">
                          {room.unread > 99 ? "99+" : room.unread}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">
                            {room.dealCardName || "Deal chat"}{" "}
                            <span className="text-yellow-200/80">
                              ({formatDealPrice(room.dealPrice)})
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] font-semibold text-cyan-100/55">
                            Seller: {room.sellerName || room.otherName}
                          </div>
                        </div>
                        <div className="shrink-0 text-[10px] text-white/32">
                          {formatRoomTime(room.createdAt)}
                        </div>
                      </div>

                      <div className="mt-2 truncate text-xs text-white/50">
                        คุยกับ {room.otherName} · {room.lastMessage}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && rooms.length === 0 && (
          <div className="mt-10 rounded-[28px] border border-white/5 bg-white/[0.02] px-5 py-12 text-center text-white/40">
            ยังไม่มีแชท
          </div>
        )}
      </div>
    </div>
  );
}
