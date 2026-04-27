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

function formatDealPriceLabel(value?: number) {
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

  const markRoomReadLocally = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.roomId === roomId ? { ...room, unread: 0 } : room
      )
    );
    window.dispatchEvent(
      new CustomEvent("nexora:chat-read", {
        detail: { roomId },
      })
    );
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
    <div className="min-h-full overflow-hidden bg-[#f4f0f7] text-[#08080a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_78%_0%,rgba(255,217,102,0.22),transparent_22%),linear-gradient(180deg,#f8f5fb_0%,#e7e8f7_100%)]" />
      <div className="relative mx-auto max-w-7xl px-0 py-0 sm:px-6 sm:py-5 lg:px-8">
        <section className="relative overflow-hidden rounded-[26px] bg-[#f8f7fb] px-3 pb-5 pt-4 shadow-[0_28px_90px_rgba(60,50,80,0.16)] ring-1 ring-black/5 sm:rounded-[48px] sm:px-7 sm:pb-7 sm:pt-5 lg:px-10">
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-white/80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#d9def8] blur-3xl" />

          <header className="relative flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-black/35 sm:text-[13px] sm:tracking-[0.38em]">
                Nexora Comms
              </div>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.08em] text-black sm:text-6xl lg:text-7xl">
                แชท
              </h1>
            </div>
            <div className="rounded-full bg-white px-4 py-2.5 text-center text-sm font-black shadow-[0_16px_34px_rgba(20,20,30,0.1)] ring-1 ring-black/5 sm:px-5 sm:py-3 sm:text-base">
              {rooms.length} ห้อง
            </div>
          </header>

          <div className="relative mt-6 grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-black/40">Direct</div>
                  <div className="mt-1 text-3xl font-black tracking-[-0.05em]">แชทส่วนตัว</div>
                </div>
                <div className="rounded-full bg-[#eef0fb] px-3 py-2 text-xs font-black sm:px-4 sm:text-sm">
                  {directRooms.length} active
                </div>
              </div>

              <div className="space-y-3">
                {loading && rooms.length === 0 ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-[28px] bg-[#f4f3f8] p-3"
                    >
                      <div className="h-12 w-12 animate-pulse rounded-full bg-white" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 h-4 w-40 animate-pulse rounded bg-black/10" />
                        <div className="h-3 w-28 animate-pulse rounded bg-black/5" />
                      </div>
                    </div>
                  ))
                ) : directRooms.length === 0 ? (
                  <div className="rounded-[28px] bg-[#f4f3f8] px-5 py-8 text-sm font-bold text-black/45">
                    ยังไม่มีแชทส่วนตัว
                  </div>
                ) : (
                  directRooms.map((room) => (
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
                        markRoomReadLocally(room.roomId);
                        saveDmRoomSeed(room.roomId, {
                          name: room.otherName,
                          image: room.otherImage,
                          otherUserId: room.otherUserId,
                        });
                        void openDirectRoom(room);
                      }}
                      className="group flex items-center gap-3 rounded-[30px] bg-[#f4f3f8] p-3 shadow-[0_18px_40px_rgba(20,20,30,0.06)] transition hover:-translate-y-0.5 hover:bg-[#eeedf5]"
                    >
                      <div className="relative">
                        <img
                          src={room.otherImage}
                          alt={room.otherName}
                          className="h-[56px] w-[56px] rounded-full object-cover ring-4 ring-white"
                        />
                        {room.unread > 0 ? (
                          <div className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-[#ff4b55] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_10px_20px_rgba(255,75,85,0.28)]">
                            {room.unread > 99 ? "99+" : room.unread}
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="truncate text-base font-black text-black">{room.otherName}</div>
                          <div className="shrink-0 text-[11px] font-bold text-black/35">
                            {formatRoomTime(room.createdAt)}
                          </div>
                        </div>
                        <div
                          className={`mt-1 truncate text-sm ${
                            room.unread > 0 ? "font-semibold text-black/80" : "text-black/45"
                          }`}
                        >
                          {room.lastMessage || "เริ่มบทสนทนา"}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-black/40">Deal Rooms</div>
                  <div className="mt-1 text-3xl font-black tracking-[-0.05em]">ห้องดีล</div>
                </div>
                <div className="rounded-full bg-black px-3 py-2 text-xs font-black text-white sm:px-4 sm:text-sm">
                  {dealRooms.length} synced
                </div>
              </div>

              <div className="space-y-3">
                {dealRooms.length === 0 ? (
                  <div className="rounded-[28px] bg-[#f4f3f8] px-5 py-8 text-sm font-bold text-black/45">
                    ยังไม่มีห้องดีล
                  </div>
                ) : (
                  dealRooms.map((room) => (
                    <Link
                      key={room.roomId}
                      href={`/market/deals/chat/${room.dealId}`}
                      prefetch
                      onClick={() => markRoomReadLocally(room.roomId)}
                      className="group relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#111214,#1d1f28)] p-4 text-white shadow-[0_24px_54px_rgba(15,15,20,0.2)] transition hover:-translate-y-0.5"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.12),transparent_34%)] opacity-80" />
                      <div className="relative flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={room.otherImage}
                            alt={room.otherName}
                            className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/10"
                          />
                          {room.unread > 0 ? (
                            <div className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-[#ff4b55] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_10px_20px_rgba(255,75,85,0.28)]">
                              {room.unread > 99 ? "99+" : room.unread}
                            </div>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black text-white sm:text-base">
                                {room.dealCardName || "Deal chat"}
                              </div>
                              <div className="mt-1 break-words text-xs font-black text-yellow-200 sm:text-sm">
                                {formatDealPriceLabel(room.dealPrice)}
                              </div>
                              <div className="mt-1 truncate text-[11px] font-semibold text-white/55">
                                Seller: {room.sellerName || room.otherName}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] font-semibold text-white/40">
                              {formatRoomTime(room.createdAt)}
                            </div>
                          </div>

                          <div className="mt-3 line-clamp-2 text-xs text-white/65">
                            {room.lastMessage || `กำลังคุยกับ ${room.otherName}`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
