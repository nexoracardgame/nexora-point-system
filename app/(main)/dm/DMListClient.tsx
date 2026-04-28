"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { prefetchDealChatRoom, prefetchDirectChatRoom } from "@/lib/chat-room-prefetch";
import type { DMRoomListItem } from "@/lib/dm-list";
import { saveDmRoomSeed } from "@/lib/dm-room-seed";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { formatThaiRoomTime } from "@/lib/thai-time";

type SessionUser = {
  id: string;
  lineId?: string | null;
  name?: string | null;
  image?: string | null;
};

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
    dealCardImage: room.dealCardImage ? String(room.dealCardImage) : undefined,
    dealCardNo: room.dealCardNo ? String(room.dealCardNo) : undefined,
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

      await prefetchDirectChatRoom(nextRoomId).catch(() => null);

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
    const supabase = getBrowserSupabaseClient();
    const channel = supabase
      ? supabase.channel(`dm-list-${Date.now()}`)
      : null;

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmMessage" },
      () => {
        void loadRooms();
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_room" },
      () => {
        void loadRooms();
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "DealRequest" },
      () => {
        void loadRooms();
      }
    );

    channel?.subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRooms();
      }
    }, 15000);

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
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
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
                        void prefetchDirectChatRoom(room.roomId);
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
                            {formatThaiRoomTime(room.createdAt)}
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

              <div className="space-y-3 rounded-[28px] bg-[#f4f3f8] p-2.5 sm:p-3">
                {dealRooms.length === 0 ? (
                  <div className="rounded-[24px] bg-white px-5 py-8 text-sm font-bold text-black/45 shadow-[0_16px_34px_rgba(20,20,30,0.06)]">
                    ยังไม่มีห้องดีล
                  </div>
                ) : (
                  dealRooms.map((room) => (
                    <Link
                      key={room.roomId}
                      href={`/market/deals/chat/${room.dealId}`}
                      prefetch
                      onMouseEnter={() => {
                        if (room.dealId) {
                          void prefetchDealChatRoom(room.dealId);
                        }
                      }}
                      onClick={() => {
                        markRoomReadLocally(room.roomId);
                        if (room.dealId) {
                          void prefetchDealChatRoom(room.dealId);
                        }
                      }}
                      className="group relative block overflow-hidden rounded-[30px] border border-[#1f2230] bg-[linear-gradient(145deg,#0f1016_0%,#1a1d29_58%,#11131c_100%)] p-4 text-white shadow-[0_18px_40px_rgba(15,15,20,0.22)] ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:shadow-[0_28px_56px_rgba(15,15,20,0.26)] sm:p-4.5"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_32%)] opacity-90" />
                      <div className="relative flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={room.otherImage}
                            alt={room.otherName}
                            className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/12 shadow-[0_12px_26px_rgba(0,0,0,0.25)] sm:h-14 sm:w-14"
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
                              <div className="line-clamp-1 text-sm font-black text-white sm:text-base">
                                {room.dealCardName || "Deal chat"}
                              </div>
                              <div className="mt-1 text-sm font-black text-[#ffe27a] sm:text-base">
                                {formatDealPriceLabel(room.dealPrice)}
                              </div>
                              <div className="mt-1 line-clamp-1 text-[11px] font-semibold text-white/62 sm:text-xs">
                                ผู้ขาย: {room.sellerName || room.otherName}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] font-semibold text-white/40">
                              {formatThaiRoomTime(room.createdAt)}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 rounded-[20px] border border-white/8 bg-white/[0.05] p-2.5">
                            <div className="min-w-0 rounded-[16px] px-1 py-1 text-xs font-medium text-white/72">
                              {room.lastMessage || `กำลังคุยกับ ${room.otherName}`}
                            </div>
                            <div className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-black/20 px-2.5 py-2">
                              <img
                                src={room.dealCardImage || "/cards/001.jpg"}
                                alt={room.dealCardName || "Deal card"}
                                className="h-12 w-9 rounded-[10px] object-cover shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                              />
                              <div className="min-w-0">
                                <div className="max-w-[110px] truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ffe27a]">
                                  {room.dealCardNo ? `CARD ${room.dealCardNo}` : "DEAL CARD"}
                                </div>
                                <div className="mt-0.5 max-w-[110px] truncate text-[11px] font-semibold text-white/78">
                                  {room.dealCardName || "Unknown card"}
                                </div>
                              </div>
                            </div>
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
