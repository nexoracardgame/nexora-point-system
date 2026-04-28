"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import {
  clearChatHistoryCache,
  readChatHistoryCache,
  writeChatHistoryCache,
} from "@/lib/chat-history-cache";
import { prefetchDealChatRoom, prefetchDirectChatRoom } from "@/lib/chat-room-prefetch";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
import type { DMRoomListItem } from "@/lib/dm-list";
import { saveDmRoomSeed } from "@/lib/dm-room-seed";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { formatThaiChatActivityTime } from "@/lib/thai-time";

type SessionUser = {
  id: string;
  lineId?: string | null;
  name?: string | null;
  image?: string | null;
};

type DmListCache = {
  rooms: DMRoomListItem[];
  me: SessionUser | null;
};

type DmRoomFastCacheMeta = {
  me?: {
    id: string;
    name: string;
    image: string;
  } | null;
  other?: {
    id: string;
    name: string;
    image: string;
  } | null;
  [key: string]: unknown;
};

function formatDealPriceLabel(value?: number) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  return `฿${amount.toLocaleString("th-TH")}`;
}

function buildDirectRoomId(userA?: string | null, userB?: string | null) {
  return [String(userA || "").trim(), String(userB || "").trim()]
    .filter(Boolean)
    .sort()
    .join("__");
}

function buildDirectRoomHref(roomId: string) {
  return `/dm/${encodeURIComponent(roomId)}?back=${encodeURIComponent("/dm")}`;
}

function buildDealRoomHref(dealId: string) {
  return `/market/deals/chat/${encodeURIComponent(dealId)}`;
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
    lastMessageAt: room.lastMessageAt ? String(room.lastMessageAt) : "",
    unread: Number(room.unread || 0),
    dealCardName: room.dealCardName ? String(room.dealCardName) : undefined,
    dealCardImage: room.dealCardImage ? String(room.dealCardImage) : undefined,
    dealCardNo: room.dealCardNo ? String(room.dealCardNo) : undefined,
    dealPrice: Number(room.dealPrice || 0),
    sellerName: room.sellerName ? String(room.sellerName) : undefined,
    sellerImage: room.sellerImage ? String(room.sellerImage) : undefined,
  };
}

function latestTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function sortRoomsByActivity(list: DMRoomListItem[]) {
  return [...list].sort((a, b) => {
    const aLastMessageTime = latestTime(a.lastMessageAt);
    const bLastMessageTime = latestTime(b.lastMessageAt);

    if (aLastMessageTime !== bLastMessageTime) {
      return bLastMessageTime - aLastMessageTime;
    }

    return latestTime(b.createdAt) - latestTime(a.createdAt);
  });
}

export default function DMListClient({
  initialRooms,
  initialMe,
}: {
  initialRooms: DMRoomListItem[];
  initialMe: SessionUser | null;
}) {
  const cachedList = useMemo(
    () =>
      readClientViewCache<DmListCache>("dm-list", {
        maxAgeMs: 180000,
      }),
    []
  );
  const router = useRouter();
  const [currentMe, setCurrentMe] = useState<SessionUser | null>(
    initialMe || cachedList?.data?.me || null
  );
  const [rooms, setRooms] = useState<DMRoomListItem[]>(
    sortRoomsByActivity(
      (initialRooms.length > 0
        ? initialRooms
        : cachedList?.data?.rooms || []
      ).map(normalizeRoom)
    )
  );
  const [loading, setLoading] = useState(
    initialRooms.length === 0 && !(cachedList?.data?.rooms?.length)
  );
  const [openingRoomId, setOpeningRoomId] = useState<string | null>(null);
  const [clearingRoomId, setClearingRoomId] = useState<string | null>(null);

  const hasInit = useRef(false);

  const getTargetDirectRoomId = useCallback((room: DMRoomListItem) => {
    const myUserId = String(currentMe?.id || "").trim();
    const otherUserId = String(room.otherUserId || "").trim();

    if (!myUserId || !otherUserId) {
      return room.roomId;
    }

    return buildDirectRoomId(myUserId, otherUserId) || room.roomId;
  }, [currentMe?.id]);

  const primeDirectRoomCache = useCallback((roomId: string, room: DMRoomListItem) => {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;

    const existing = readChatHistoryCache<unknown, DmRoomFastCacheMeta>(
      "dm-room",
      safeRoomId
    );
    writeChatHistoryCache("dm-room", safeRoomId, {
      messages: Array.isArray(existing?.messages) ? existing.messages : [],
      meta: {
        ...(existing?.meta || {}),
        me: currentMe
          ? {
              id: String(currentMe.id || "").trim(),
              name: String(currentMe.name || "").trim() || "You",
              image: String(currentMe.image || "").trim() || "/avatar.png",
            }
          : existing?.meta?.me || null,
        other: {
          id: String(room.otherUserId || "").trim(),
          name: String(room.otherName || "").trim() || "User",
          image: String(room.otherImage || "").trim() || "/avatar.png",
        },
      },
      cachedAt: Date.now(),
    });
  }, [currentMe]);

  const seedDirectRoom = useCallback((roomId: string, room: DMRoomListItem) => {
    saveDmRoomSeed(roomId, {
      name: room.otherName,
      image: room.otherImage,
      otherUserId: room.otherUserId,
    });
    primeDirectRoomCache(roomId, room);
  }, [primeDirectRoomCache]);

  const warmDealRoom = useCallback((dealId?: string) => {
    const safeDealId = String(dealId || "").trim();
    if (!safeDealId) return;

    router.prefetch(buildDealRoomHref(safeDealId));
    void prefetchDealChatRoom(safeDealId).catch(() => null);
  }, [router]);

  const directRooms = useMemo(
    () => rooms.filter((room) => room.kind !== "deal"),
    [rooms]
  );
  const dealRooms = useMemo(
    () => rooms.filter((room) => room.kind === "deal" && room.dealId),
    [rooms]
  );

  useEffect(() => {
    directRooms.forEach((room) => {
      seedDirectRoom(room.roomId, room);
      const targetRoomId = getTargetDirectRoomId(room);
      if (targetRoomId && targetRoomId !== room.roomId) {
        seedDirectRoom(targetRoomId, room);
      }
    });
  }, [directRooms, getTargetDirectRoomId, seedDirectRoom]);

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

  useEffect(() => {
    if (rooms.length === 0 && !currentMe) {
      return;
    }

    writeClientViewCache("dm-list", {
      rooms,
      me: currentMe,
    } satisfies DmListCache);
  }, [currentMe, rooms]);

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
        ? sortRoomsByActivity(data.rooms.map(normalizeRoom))
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

  const warmDirectRoom = useCallback((room: DMRoomListItem) => {
    const targetRoomId = getTargetDirectRoomId(room);
    seedDirectRoom(room.roomId, room);
    seedDirectRoom(targetRoomId, room);
    router.prefetch(buildDirectRoomHref(targetRoomId));

    if (targetRoomId === room.roomId) {
      void prefetchDirectChatRoom(targetRoomId).catch(() => null);
    }
  }, [getTargetDirectRoomId, router, seedDirectRoom]);

  const openDirectRoom = (room: DMRoomListItem) => {
    const targetRoomId = getTargetDirectRoomId(room);
    const targetHref = buildDirectRoomHref(targetRoomId);

    if (openingRoomId) {
      router.push(targetHref);
      return;
    }

    seedDirectRoom(room.roomId, room);
    seedDirectRoom(targetRoomId, room);
    setOpeningRoomId(targetRoomId);
    router.push(targetHref);

    void (async () => {
      try {
        if (room.otherUserId) {
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

          if (res.ok) {
            const data = await res.json().catch(() => null);
            const nextRoomId = String(data?.roomId || targetRoomId).trim() || targetRoomId;
            seedDirectRoom(nextRoomId, room);
            void prefetchDirectChatRoom(nextRoomId).catch(() => null);
            return;
          }
        }

        if (targetRoomId === room.roomId) {
          void prefetchDirectChatRoom(targetRoomId).catch(() => null);
        }
      } catch {
        if (targetRoomId === room.roomId) {
          void prefetchDirectChatRoom(targetRoomId).catch(() => null);
        }
      } finally {
        setOpeningRoomId((current) => (current === targetRoomId ? null : current));
      }
    })();
  };

  const clearDirectRoom = async (room: DMRoomListItem) => {
    const safeRoomId = String(room.roomId || "").trim();
    const targetRoomId = getTargetDirectRoomId(room);

    if (!safeRoomId || clearingRoomId) {
      return;
    }

    const previousRooms = rooms;
    setClearingRoomId(safeRoomId);
    setRooms((prev) => prev.filter((item) => item.roomId !== safeRoomId));
    clearChatHistoryCache("dm-room", safeRoomId);
    if (targetRoomId && targetRoomId !== safeRoomId) {
      clearChatHistoryCache("dm-room", targetRoomId);
    }

    const res = await fetch("/api/dm/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: safeRoomId,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setRooms(previousRooms);
      alert("ลบแชทไม่สำเร็จ กรุณาลองใหม่");
    }

    setClearingRoomId((current) => (current === safeRoomId ? null : current));
  };

  useEffect(() => {
    if (initialRooms.length > 0) {
      void hydrateUnknownRooms(initialRooms.map(normalizeRoom));
    }
  }, [initialRooms]);

  useEffect(() => {
    if (initialRooms.length > 0 || rooms.length > 0 || currentMe) {
      return;
    }

    const cached = readClientViewCache<DmListCache>("dm-list", {
      maxAgeMs: 180000,
    });

    if (!cached?.data) {
      return;
    }

    if (cached.data.me) {
      setCurrentMe(cached.data.me);
    }

    if (Array.isArray(cached.data.rooms) && cached.data.rooms.length > 0) {
      const nextRooms = sortRoomsByActivity(cached.data.rooms.map(normalizeRoom));
      setRooms(nextRooms);
      setLoading(false);
      void hydrateUnknownRooms(nextRooms);
    }
  }, [currentMe, initialRooms.length, rooms.length]);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    void (async () => {
      if (!currentMe) {
        const sessionRes = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const sessionData = await sessionRes.json();
        setCurrentMe((sessionData?.user || null) as SessionUser | null);
      }

      if (initialRooms.length === 0) {
        await loadRooms();
      } else {
        setLoading(false);
        void loadRooms();
      }
    })();
  }, [currentMe, initialRooms.length]);

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
    }, 4000);

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
    <div className="min-h-full bg-[#f4f0f7] text-[#08080a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_78%_0%,rgba(255,217,102,0.22),transparent_22%),linear-gradient(180deg,#f8f5fb_0%,#e7e8f7_100%)]" />
      <div className="relative mx-auto max-w-7xl px-0 py-0 sm:px-6 sm:py-5 lg:px-8">
        <section className="relative overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+102px)] pt-3 sm:rounded-[48px] sm:bg-[#f8f7fb] sm:px-7 sm:pb-7 sm:pt-5 sm:shadow-[0_28px_90px_rgba(60,50,80,0.16)] sm:ring-1 sm:ring-black/5 lg:px-10">
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-white/80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#d9def8] blur-3xl" />

          <header className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-black/35 sm:text-[13px] sm:tracking-[0.38em]">
                Nexora Comms
              </div>
              <h1 className="mt-2 text-[2.35rem] font-black tracking-[-0.08em] text-black sm:text-6xl lg:text-7xl">
                แชท
              </h1>
            </div>
            <div className="self-end rounded-full bg-white px-4 py-2.5 text-center text-sm font-black shadow-[0_16px_34px_rgba(20,20,30,0.1)] ring-1 ring-black/5 sm:self-auto sm:px-5 sm:py-3 sm:text-base">
              {rooms.length} ห้อง
            </div>
          </header>

          <div className="relative mt-4 grid gap-3 sm:mt-6 sm:gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="rounded-[28px] bg-white p-3.5 shadow-[0_18px_34px_rgba(20,20,30,0.08)] sm:rounded-[34px] sm:p-5 sm:shadow-[0_24px_54px_rgba(20,20,30,0.1)] lg:rounded-[42px]">
              <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-black/40">Direct</div>
                  <div className="mt-1 text-[1.9rem] font-black tracking-[-0.05em] sm:text-3xl">แชทส่วนตัว</div>
                </div>
                <div className="self-end rounded-full bg-[#eef0fb] px-3 py-2 text-xs font-black sm:self-auto sm:px-4 sm:text-sm">
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
                    <div
                      key={room.roomId}
                      className="group flex items-center gap-2 rounded-[30px] bg-[#f4f3f8] p-3 shadow-[0_18px_40px_rgba(20,20,30,0.06)] transition hover:-translate-y-0.5 hover:bg-[#eeedf5]"
                    >
                      <button
                        type="button"
                        onMouseEnter={() => warmDirectRoom(room)}
                        onTouchStart={() => warmDirectRoom(room)}
                        onFocus={() => warmDirectRoom(room)}
                        onClick={() => {
                          markRoomReadLocally(room.roomId);
                          void openDirectRoom(room);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                            <div className="truncate text-base font-black text-black">
                              {room.otherName}
                            </div>
                            <div className="shrink-0 text-[11px] font-bold text-black/35">
                              {room.lastMessageAt
                                ? formatThaiChatActivityTime(room.lastMessageAt)
                                : ""}
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
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void clearDirectRoom(room);
                        }}
                        disabled={clearingRoomId === room.roomId}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-300/25 bg-red-500/10 text-red-500 shadow-[0_10px_24px_rgba(239,68,68,0.12)] transition hover:bg-red-500/16 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
                        aria-label={`ลบแชทกับ ${room.otherName}`}
                        title={`ลบแชทกับ ${room.otherName}`}
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-3.5 shadow-[0_18px_34px_rgba(20,20,30,0.08)] sm:rounded-[34px] sm:p-5 sm:shadow-[0_24px_54px_rgba(20,20,30,0.1)] lg:rounded-[42px]">
              <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-black/40">Deal Rooms</div>
                  <div className="mt-1 text-[1.9rem] font-black tracking-[-0.05em] sm:text-3xl">ห้องดีล</div>
                </div>
                <div className="self-end rounded-full bg-black px-3 py-2 text-xs font-black text-white sm:self-auto sm:px-4 sm:text-sm">
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
                      href={buildDealRoomHref(String(room.dealId || ""))}
                      prefetch
                      onMouseEnter={() => warmDealRoom(room.dealId)}
                      onTouchStart={() => warmDealRoom(room.dealId)}
                      onFocus={() => warmDealRoom(room.dealId)}
                      onClick={() => {
                        markRoomReadLocally(room.roomId);
                        warmDealRoom(room.dealId);
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
                              {formatThaiChatActivityTime(
                                room.lastMessageAt || room.createdAt
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 rounded-[20px] border border-white/8 bg-white/[0.05] p-2.5">
                            <div className="min-w-0 rounded-[16px] px-1 py-1 text-xs font-medium text-white/72">
                              {room.lastMessage || `กำลังคุยกับ ${room.otherName}`}
                            </div>
                            <div className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-black/20 px-2.5 py-2">
                              <SafeCardImage
                                cardNo={room.dealCardNo || "001"}
                                imageUrl={room.dealCardImage}
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
