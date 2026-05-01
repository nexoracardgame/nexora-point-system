"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useOnlinePresence } from "@/components/OnlinePresenceProvider";
import SafeCardImage from "@/components/SafeCardImage";
import {
  clearChatHistoryCache,
  readChatHistoryCache,
  writeChatHistoryCache,
} from "@/lib/chat-history-cache";
import { dispatchClientChatRead, isClientChatRead } from "@/lib/chat-read-sync";
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

type DmMessageRealtimeRow = {
  id?: string | number | null;
  roomId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderImage?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
};

type LocalDmClearMap = Map<string, string>;

const DM_LIST_CACHE_KEY = "dm-list";
const DM_LIST_FAST_REFRESH_MS = 900;
const DM_LIST_BURST_DELAYS_MS = [120, 360, 760] as const;

function buildLocalClearStorageKey(userId?: string | null) {
  return `nexora:dm-cleared:${String(userId || "guest").trim() || "guest"}`;
}

function safeTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function latestIsoTimestamp(values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => safeTime(value))
    .filter((value) => value > 0)
    .sort((a, b) => b - a)[0];

  return latest ? new Date(latest).toISOString() : "";
}

function readLocalDmClearMap(userId?: string | null): LocalDmClearMap {
  if (typeof window === "undefined") {
    return new Map();
  }

  try {
    const raw = window.localStorage.getItem(buildLocalClearStorageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};

    return new Map(
      Object.entries(parsed || {})
        .map(([key, value]) => [
          String(key || "").trim(),
          String(value || "").trim(),
        ] as const)
        .filter(([key, value]) => Boolean(key && value))
    );
  } catch {
    return new Map();
  }
}

function writeLocalDmClearMap(userId: string | null | undefined, map: LocalDmClearMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      buildLocalClearStorageKey(userId),
      JSON.stringify(Object.fromEntries(map))
    );
  } catch {
    return;
  }
}

function rememberLocalDmClear(
  userId: string | null | undefined,
  keys: string[],
  clearedAt: string
) {
  const map = readLocalDmClearMap(userId);
  const safeClearedAt = String(clearedAt || new Date().toISOString()).trim();

  keys
    .map((key) => String(key || "").trim())
    .filter(Boolean)
    .forEach((key) => {
      const current = map.get(key);
      map.set(key, latestIsoTimestamp([current, safeClearedAt]) || safeClearedAt);
    });

  writeLocalDmClearMap(userId, map);
  return map;
}

function buildPreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "รูปภาพ";
  return "เริ่มแชท";
}

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

function getDirectRoomLocalClearKeys(
  room: DMRoomListItem,
  me?: SessionUser | null
) {
  if (room.kind === "deal") {
    return [];
  }

  const myId = String(me?.id || "").trim();
  const myLineId = String(me?.lineId || "").trim();
  const otherUserId = String(room.otherUserId || "").trim();

  return Array.from(
    new Set(
      [
        room.roomId,
        otherUserId,
        myId && otherUserId ? buildDirectRoomId(myId, otherUserId) : "",
        myLineId && otherUserId ? buildDirectRoomId(myLineId, otherUserId) : "",
      ]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function getLocalClearedAtForRoom(
  room: DMRoomListItem,
  me: SessionUser | null | undefined,
  clearMap: LocalDmClearMap
) {
  return latestIsoTimestamp(
    getDirectRoomLocalClearKeys(room, me).map((key) => clearMap.get(key) || null)
  );
}

function filterRoomsWithLocalClears(
  list: DMRoomListItem[],
  me?: SessionUser | null,
  clearMap = readLocalDmClearMap(me?.id)
) {
  return list.filter((room) => {
    if (room.kind === "deal") {
      return true;
    }

    const clearedAt = getLocalClearedAtForRoom(room, me, clearMap);
    if (!clearedAt) {
      return true;
    }

    return safeTime(room.lastMessageAt) > safeTime(clearedAt);
  });
}

function applyClientReadStateToRooms(
  list: DMRoomListItem[],
  me?: SessionUser | null
) {
  const myId = String(me?.id || "").trim();
  const myLineId = String(me?.lineId || "").trim();

  return list.map((room) => {
    const directTargetIds =
      room.kind === "deal"
        ? [room.roomId, room.dealId ? `deal:${room.dealId}` : ""]
        : [
            room.roomId,
            myId && room.otherUserId ? buildDirectRoomId(myId, room.otherUserId) : "",
            myLineId && room.otherUserId ? buildDirectRoomId(myLineId, room.otherUserId) : "",
          ];

    if (!isClientChatRead(directTargetIds, room.lastMessageAt || room.createdAt)) {
      return room;
    }

    return { ...room, unread: 0 };
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
      readClientViewCache<DmListCache>(DM_LIST_CACHE_KEY, {
        maxAgeMs: 180000,
      }),
    []
  );
  const router = useRouter();
  const { isOnline } = useOnlinePresence();
  const initialMeCandidate = initialMe || cachedList?.data?.me || null;
  const [currentMe, setCurrentMe] = useState<SessionUser | null>(initialMeCandidate);
  const [rooms, setRooms] = useState<DMRoomListItem[]>(
    applyClientReadStateToRooms(
      filterRoomsWithLocalClears(
        sortRoomsByActivity(
          (initialRooms.length > 0
            ? initialRooms
            : cachedList?.data?.rooms || []
          ).map(normalizeRoom)
        ),
        initialMeCandidate
      ),
      initialMeCandidate
    )
  );
  const [loading, setLoading] = useState(
    initialRooms.length === 0 && !(cachedList?.data?.rooms?.length)
  );
  const [openingRoomId, setOpeningRoomId] = useState<string | null>(null);
  const [clearingRoomId, setClearingRoomId] = useState<string | null>(null);

  const hasInit = useRef(false);
  const loadRoomsInFlightRef = useRef<Promise<void> | null>(null);
  const loadRoomsQueuedRef = useRef(false);
  const loadRoomsBurstTimersRef = useRef<number[]>([]);
  const roomsRef = useRef<DMRoomListItem[]>(rooms);
  const currentMeRef = useRef<SessionUser | null>(currentMe);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    currentMeRef.current = currentMe;
  }, [currentMe]);

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

    writeClientViewCache(DM_LIST_CACHE_KEY, {
      rooms: filterRoomsWithLocalClears(rooms, currentMe),
      me: currentMe,
    } satisfies DmListCache);
  }, [currentMe, rooms]);

  useEffect(() => {
    if (!currentMe) {
      return;
    }

    setRooms((prev) =>
      applyClientReadStateToRooms(
        filterRoomsWithLocalClears(prev, currentMe),
        currentMe
      )
    );
  }, [currentMe]);

  const loadRooms = async (meOverride?: SessionUser | null) => {
    if (loadRoomsInFlightRef.current) {
      loadRoomsQueuedRef.current = true;
      return loadRoomsInFlightRef.current;
    }

    const effectiveMe = meOverride === undefined ? currentMe : meOverride;
    const task = (async () => {
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
      const visibleRooms = applyClientReadStateToRooms(
        filterRoomsWithLocalClears(nextRooms, effectiveMe),
        effectiveMe
      );

      setRooms(visibleRooms);
      void hydrateUnknownRooms(visibleRooms);
    })();

    loadRoomsInFlightRef.current = task;

    try {
      await task;
    } finally {
      if (loadRoomsInFlightRef.current === task) {
        loadRoomsInFlightRef.current = null;
      }
      setLoading(false);

      if (loadRoomsQueuedRef.current) {
        loadRoomsQueuedRef.current = false;
        void loadRooms(currentMeRef.current);
      }
    }
  };

  const clearLoadRoomsBurstTimers = () => {
    for (const timeoutId of loadRoomsBurstTimersRef.current) {
      window.clearTimeout(timeoutId);
    }
    loadRoomsBurstTimersRef.current = [];
  };

  const queueLoadRooms = (meOverride?: SessionUser | null) => {
    const activeMe = meOverride === undefined ? currentMeRef.current : meOverride;

    void loadRooms(activeMe);
    clearLoadRoomsBurstTimers();
    loadRoomsBurstTimersRef.current = DM_LIST_BURST_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        void loadRooms(currentMeRef.current);
      }, delay)
    );
  };

  const markRoomReadLocally = (roomId: string, unreadCount = 1) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.roomId === roomId ? { ...room, unread: 0 } : room
      )
    );
    dispatchClientChatRead({ roomId, unreadCount });
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

    setClearingRoomId(safeRoomId);
    const clearedAt = new Date().toISOString();
    const localClearKeys = getDirectRoomLocalClearKeys(room, currentMe);
    const nextClearMap = rememberLocalDmClear(
      currentMe?.id,
      [safeRoomId, targetRoomId, ...localClearKeys],
      clearedAt
    );
    setRooms((prev) => {
      const nextRooms = filterRoomsWithLocalClears(
        prev.filter((item) => item.roomId !== safeRoomId),
        currentMe,
        nextClearMap
      );
      writeClientViewCache(DM_LIST_CACHE_KEY, {
        rooms: nextRooms,
        me: currentMe,
      } satisfies DmListCache);
      return nextRooms;
    });
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
        otherUserId: room.otherUserId,
      }),
    }).catch(() => null);

    if (res?.ok) {
      const data = await res.json().catch(() => null);
      const clearedRoomIds = Array.isArray(data?.clearedRoomIds)
        ? data.clearedRoomIds.map((item: unknown) => String(item || "").trim())
        : [];
      rememberLocalDmClear(
        currentMe?.id,
        [...clearedRoomIds, safeRoomId, targetRoomId, ...localClearKeys],
        String(data?.clearedAt || clearedAt)
      );
    } else {
      console.error("CLEAR DM ROOM ERROR:", res?.status || "network");
    }

    setClearingRoomId((current) => (current === safeRoomId ? null : current));
  };

  const applyRealtimeMessage = useCallback((message: DmMessageRealtimeRow) => {
    const roomId = String(message?.roomId || "").trim();
    const createdAt =
      String(message?.createdAt || "").trim() || new Date().toISOString();

    if (!roomId) {
      return;
    }

    const activeMe = currentMeRef.current;
    const getTargetRoomId = (room: DMRoomListItem) => {
      const myUserId = String(activeMe?.id || "").trim();
      const otherUserId = String(room.otherUserId || "").trim();

      if (!myUserId || !otherUserId) {
        return room.roomId;
      }

      return buildDirectRoomId(myUserId, otherUserId) || room.roomId;
    };
    const senderId = String(message?.senderId || "").trim();
    const isMine =
      senderId === String(activeMe?.id || "").trim() ||
      senderId === String(activeMe?.lineId || "").trim();
    const preview = buildPreview(message?.content, message?.imageUrl);
    const hadExistingRoom = roomsRef.current.some((room) => {
      const targetRoomId =
        room.kind === "deal" ? room.roomId : getTargetRoomId(room);
      return (
        room.roomId === roomId ||
        targetRoomId === roomId ||
        (room.kind === "deal" && room.dealId && roomId === `deal:${room.dealId}`)
      );
    });

    setRooms((prev) => {
      const nextRooms = prev.map((room) => {
        const targetRoomId =
          room.kind === "deal" ? room.roomId : getTargetRoomId(room);
        const matches =
          room.roomId === roomId ||
          targetRoomId === roomId ||
          (room.kind === "deal" &&
            room.dealId &&
            roomId === `deal:${room.dealId}`);

        if (!matches) {
          return room;
        }

        return {
          ...room,
          lastMessage: preview,
          lastMessageAt: createdAt,
          createdAt,
          unread: isMine ? room.unread : room.unread + 1,
        };
      });

      return filterRoomsWithLocalClears(
        sortRoomsByActivity(nextRooms),
        activeMe
      );
    });

    if (!hadExistingRoom) {
      void loadRooms(activeMe);
    }
  }, []);

  useEffect(() => {
    if (initialRooms.length > 0) {
      void hydrateUnknownRooms(initialRooms.map(normalizeRoom));
    }
  }, [initialRooms]);

  useEffect(() => {
    if (initialRooms.length > 0 || rooms.length > 0 || currentMe) {
      return;
    }

    const cached = readClientViewCache<DmListCache>(DM_LIST_CACHE_KEY, {
      maxAgeMs: 180000,
    });

    if (!cached?.data) {
      return;
    }

    if (cached.data.me) {
      setCurrentMe(cached.data.me);
    }

    if (Array.isArray(cached.data.rooms) && cached.data.rooms.length > 0) {
      const nextRooms = applyClientReadStateToRooms(
        filterRoomsWithLocalClears(
          sortRoomsByActivity(cached.data.rooms.map(normalizeRoom)),
          cached.data.me || currentMe
        ),
        cached.data.me || currentMe
      );
      setRooms(nextRooms);
      setLoading(false);
      void hydrateUnknownRooms(nextRooms);
    }
  }, [currentMe, initialRooms.length, rooms.length]);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    void (async () => {
      if (initialRooms.length === 0) {
        void loadRooms(currentMe);
      } else {
        setLoading(false);
        void loadRooms(currentMe);
      }

      if (!currentMe) {
        const sessionRes = await fetch("/api/auth/session", {
          cache: "no-store",
        }).catch(() => null);
        const sessionData = await sessionRes?.json().catch(() => null);
        const effectiveMe = (sessionData?.user || null) as SessionUser | null;
        if (effectiveMe) {
          setCurrentMe(effectiveMe);
        }
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
      (payload) => {
        const eventType = String(
          (payload as { eventType?: string | null }).eventType || ""
        ).toUpperCase();
        const nextMessage = (payload as { new?: DmMessageRealtimeRow })?.new;
        if (eventType === "INSERT" && nextMessage?.roomId) {
          applyRealtimeMessage(nextMessage);
          queueLoadRooms(currentMeRef.current);
          return;
        }

        queueLoadRooms(currentMeRef.current);
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_room" },
      () => {
        queueLoadRooms(currentMeRef.current);
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "DealRequest" },
      () => {
        queueLoadRooms(currentMeRef.current);
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmRoomClearState" },
      () => {
        queueLoadRooms(currentMeRef.current);
      }
    );

    channel?.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dmConversationClearState" },
      () => {
        queueLoadRooms(currentMeRef.current);
      }
    );

    channel?.subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRooms(currentMeRef.current);
      }
    }, DM_LIST_FAST_REFRESH_MS);

    const onFocus = () => {
      queueLoadRooms(currentMeRef.current);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        queueLoadRooms(currentMeRef.current);
      }
    };
    const onChatRead = (event: Event) => {
      const targetRoomId = String(
        (event as CustomEvent<{ roomId?: string | null }>).detail?.roomId || ""
      ).trim();

      if (targetRoomId) {
        setRooms((prev) =>
          applyClientReadStateToRooms(
            prev.map((room) =>
              room.roomId === targetRoomId ? { ...room, unread: 0 } : room
            ),
            currentMeRef.current
          )
        );
      }

      queueLoadRooms(currentMeRef.current);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("nexora:chat-read", onChatRead as EventListener);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      clearLoadRoomsBurstTimers();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("nexora:chat-read", onChatRead as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <div className="min-h-full overflow-x-hidden bg-[#f4f0f7] text-[#08080a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_78%_0%,rgba(255,217,102,0.22),transparent_22%),linear-gradient(180deg,#f8f5fb_0%,#e7e8f7_100%)]" />
      <div className="relative mx-auto max-w-7xl px-0 py-0 sm:px-6 sm:py-5 lg:px-8">
        <section className="relative overflow-hidden px-2.5 pb-[calc(env(safe-area-inset-bottom)+108px)] pt-2.5 sm:rounded-[48px] sm:bg-[#f8f7fb] sm:px-7 sm:pb-7 sm:pt-5 sm:shadow-[0_28px_90px_rgba(60,50,80,0.16)] sm:ring-1 sm:ring-black/5 lg:px-10">
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-white/80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#d9def8] blur-3xl" />

          <header className="relative flex flex-col items-start gap-2.5 px-0.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-black/35 sm:text-[13px] sm:tracking-[0.38em]">
                Nexora Comms
              </div>
              <h1 className="mt-1.5 text-[2.15rem] font-black tracking-[-0.08em] text-black sm:text-6xl lg:text-7xl">
                แชท
              </h1>
            </div>
            <div className="self-start rounded-full bg-white px-3.5 py-2 text-center text-xs font-black shadow-[0_16px_34px_rgba(20,20,30,0.1)] ring-1 ring-black/5 sm:self-auto sm:px-5 sm:py-3 sm:text-base">
              {rooms.length} ห้อง
            </div>
          </header>

          <div className="relative mt-4 grid gap-3 sm:mt-6 sm:gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="min-w-0 rounded-[24px] bg-white p-3 shadow-[0_18px_34px_rgba(20,20,30,0.08)] sm:rounded-[34px] sm:p-5 sm:shadow-[0_24px_54px_rgba(20,20,30,0.1)] lg:rounded-[42px]">
              <div className="mb-3 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-black/40">Direct</div>
                  <div className="mt-1 text-[1.72rem] font-black tracking-[-0.05em] sm:text-3xl">แชทส่วนตัว</div>
                </div>
                <div className="self-start rounded-full bg-[#eef0fb] px-3 py-1.5 text-[11px] font-black sm:self-auto sm:px-4 sm:py-2 sm:text-sm">
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
                  directRooms.map((room) => {
                    const roomOnline = isOnline(room.otherUserId);

                    return (
                    <div
                      key={room.roomId}
                      className="group flex min-w-0 items-center gap-2 rounded-[24px] bg-[#f4f3f8] p-2.5 shadow-[0_18px_40px_rgba(20,20,30,0.06)] transition hover:-translate-y-0.5 hover:bg-[#eeedf5] sm:rounded-[30px] sm:p-3"
                    >
                      <button
                        type="button"
                        onMouseEnter={() => warmDirectRoom(room)}
                        onTouchStart={() => warmDirectRoom(room)}
                        onFocus={() => warmDirectRoom(room)}
                        onClick={() => {
                          markRoomReadLocally(room.roomId, room.unread);
                          void openDirectRoom(room);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
                      >
                        <div className="relative">
                          <img
                            src={room.otherImage}
                            alt={room.otherName}
                            className="h-[52px] w-[52px] rounded-full object-cover ring-4 ring-white sm:h-[56px] sm:w-[56px]"
                          />
                          {room.unread > 0 ? (
                            <div className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-[#ff4b55] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_10px_20px_rgba(255,75,85,0.28)]">
                              {room.unread > 99 ? "99+" : room.unread}
                            </div>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  roomOnline
                                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.68)]"
                                    : "bg-zinc-300"
                                }`}
                              />
                              <div className="truncate text-[15px] font-black leading-5 text-black sm:text-base">
                                {room.otherName}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] font-bold leading-none text-black/35 sm:pt-0.5 sm:text-[11px]">
                              {room.lastMessageAt
                                ? formatThaiChatActivityTime(room.lastMessageAt)
                                : ""}
                            </div>
                          </div>
                          <div
                            className={`mt-0.5 truncate pr-1 text-[13px] leading-5 sm:mt-1 sm:text-sm ${
                              room.unread > 0 ? "font-semibold text-black/80" : "text-black/45"
                            }`}
                          >
                            {room.lastMessage || "เริ่มบทสนทนา"}
                          </div>
                          <div
                            className={`mt-1 text-[11px] font-black ${
                              roomOnline ? "text-emerald-600" : "text-black/35"
                            }`}
                          >
                            {roomOnline ? "ออนไลน์" : "ออฟไลน์"}
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-red-300/25 bg-red-500/10 text-red-500 shadow-[0_10px_24px_rgba(239,68,68,0.12)] transition hover:bg-red-500/16 hover:text-red-600 disabled:cursor-wait disabled:opacity-60 sm:h-11 sm:w-11"
                        aria-label={`ลบแชทกับ ${room.otherName}`}
                        title={`ลบแชทกับ ${room.otherName}`}
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="min-w-0 rounded-[24px] bg-white p-3 shadow-[0_18px_34px_rgba(20,20,30,0.08)] sm:rounded-[34px] sm:p-5 sm:shadow-[0_24px_54px_rgba(20,20,30,0.1)] lg:rounded-[42px]">
              <div className="mb-3 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-black/40">Deal Rooms</div>
                  <div className="mt-1 text-[1.72rem] font-black tracking-[-0.05em] sm:text-3xl">ห้องดีล</div>
                </div>
                <div className="self-start rounded-full bg-black px-3 py-1.5 text-[11px] font-black text-white sm:self-auto sm:px-4 sm:py-2 sm:text-sm">
                  {dealRooms.length} synced
                </div>
              </div>

              <div className="space-y-3 rounded-[28px] bg-[#f4f3f8] p-2.5 sm:p-3">
                {dealRooms.length === 0 ? (
                  <div className="rounded-[24px] bg-white px-5 py-8 text-sm font-bold text-black/45 shadow-[0_16px_34px_rgba(20,20,30,0.06)]">
                    ยังไม่มีห้องดีล
                  </div>
                ) : (
                  dealRooms.map((room) => {
                    const roomOnline = isOnline(room.otherUserId);

                    return (
                    <Link
                      key={room.roomId}
                      href={buildDealRoomHref(String(room.dealId || ""))}
                      prefetch
                      onMouseEnter={() => warmDealRoom(room.dealId)}
                      onTouchStart={() => warmDealRoom(room.dealId)}
                      onFocus={() => warmDealRoom(room.dealId)}
                      onClick={() => {
                        markRoomReadLocally(room.roomId, room.unread);
                        warmDealRoom(room.dealId);
                      }}
                      className="group relative block min-w-0 overflow-hidden rounded-[24px] border border-[#1f2230] bg-[linear-gradient(145deg,#0f1016_0%,#1a1d29_58%,#11131c_100%)] p-3 text-white shadow-[0_18px_40px_rgba(15,15,20,0.22)] ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:shadow-[0_28px_56px_rgba(15,15,20,0.26)] sm:rounded-[30px] sm:p-4.5"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_32%)] opacity-90" />
                      <div className="relative flex min-w-0 items-start gap-2.5 sm:gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={room.otherImage}
                            alt={room.otherName}
                            className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white/12 shadow-[0_12px_26px_rgba(0,0,0,0.25)] sm:h-14 sm:w-14"
                          />
                          {room.unread > 0 ? (
                            <div className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-[#ff4b55] px-1.5 py-0.5 text-center text-[10px] font-black text-white shadow-[0_10px_20px_rgba(255,75,85,0.28)]">
                              {room.unread > 99 ? "99+" : room.unread}
                            </div>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                              <div
                                className={`mt-1 flex items-center gap-1.5 text-[11px] font-black ${
                                  roomOnline ? "text-emerald-300" : "text-white/38"
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    roomOnline
                                      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.72)]"
                                      : "bg-zinc-500"
                                  }`}
                                />
                                {roomOnline ? "ออนไลน์" : "ออฟไลน์"}
                              </div>
                            </div>
                            <div className="shrink-0 text-[10px] font-semibold leading-none text-white/40">
                              {formatThaiChatActivityTime(
                                room.lastMessageAt || room.createdAt
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2.5 rounded-[20px] border border-white/8 bg-white/[0.05] p-2.5 sm:grid-cols-[1fr_auto] sm:gap-3">
                            <div className="min-w-0 rounded-[16px] px-1 py-1 text-xs font-medium leading-5 text-white/72">
                              {room.lastMessage || `กำลังคุยกับ ${room.otherName}`}
                            </div>
                            <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-white/10 bg-black/20 px-2.5 py-2 sm:justify-start">
                              <SafeCardImage
                                cardNo={room.dealCardNo || "001"}
                                imageUrl={room.dealCardImage}
                                alt={room.dealCardName || "Deal card"}
                                className="h-12 w-9 rounded-[10px] object-cover shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="max-w-full truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#ffe27a] sm:max-w-[110px]">
                                  {room.dealCardNo ? `CARD ${room.dealCardNo}` : "DEAL CARD"}
                                </div>
                                <div className="mt-0.5 max-w-full truncate text-[11px] font-semibold text-white/78 sm:max-w-[110px]">
                                  {room.dealCardName || "Unknown card"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
