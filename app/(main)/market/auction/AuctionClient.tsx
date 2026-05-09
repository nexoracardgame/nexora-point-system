"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  Crown,
  Gavel,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import MarketFeatureNav from "@/components/MarketFeatureNav";
import { nexoraAlert, nexoraConfirm } from "@/lib/nexora-dialog";

type CardData = {
  cardNo: string;
  cardName: string;
  rarity: string;
  imageUrl: string;
};

type AuctionRoom = {
  id: string;
  roomNumber: number;
  cardNo: string;
  cardName: string;
  imageUrl: string;
  rarity: string;
  openingPrice: number;
  minBidStep: number;
  startsAt: string;
  endsAt: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  status: string;
  createdAt: string;
  confirmedWinnerId?: string;
  confirmedAt?: string | null;
  topBid: number;
  bidCount: number;
};

function normalizeCardNo(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : "";
}

function formatBaht(value: number) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function formatAuctionRoomNumber(value?: number | string | null) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0
    ? String(Math.floor(numeric)).padStart(3, "0")
    : "---";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toLocalDateTimeValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getRoomPhase(room: AuctionRoom) {
  const now = Date.now();
  const startsAt = new Date(room.startsAt).getTime();
  const endsAt = new Date(room.endsAt).getTime();

  if (now < startsAt) return "scheduled";
  if (now > endsAt || room.status !== "active") return "ended";
  return "live";
}

function getNextMinimum(room: AuctionRoom) {
  return (room.topBid || room.openingPrice) + room.minBidStep;
}

function isAdminRoleClient(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "gm" || normalized === "superadmin";
}

type AuctionRoomsChangedDetail = {
  action?: "created" | "deleted" | "updated";
  roomId?: string | null;
};

const AUCTION_DELETED_STORAGE_KEY = "nexora:auction-deleted-rooms";
const AUCTION_DELETED_TTL_MS = 10 * 60 * 1000;

function readDeletedAuctionRoomMap() {
  if (typeof window === "undefined") return {} as Record<string, number>;

  try {
    const raw = window.localStorage.getItem(AUCTION_DELETED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const now = Date.now();
    const activeEntries = Object.entries(parsed as Record<string, unknown>)
      .map(([id, timestamp]) => [String(id), Number(timestamp)] as const)
      .filter(([id, timestamp]) => id && Number.isFinite(timestamp))
      .filter(([, timestamp]) => now - timestamp < AUCTION_DELETED_TTL_MS);

    const nextMap = Object.fromEntries(activeEntries);
    if (activeEntries.length !== Object.keys(parsed).length) {
      window.localStorage.setItem(AUCTION_DELETED_STORAGE_KEY, JSON.stringify(nextMap));
    }

    return nextMap;
  } catch {
    return {};
  }
}

function readDeletedAuctionRoomIds() {
  return new Set(Object.keys(readDeletedAuctionRoomMap()));
}

function markAuctionRoomDeleted(roomId?: string | null) {
  const safeRoomId = String(roomId || "").trim();
  if (!safeRoomId || typeof window === "undefined") return;

  try {
    const nextMap = {
      ...readDeletedAuctionRoomMap(),
      [safeRoomId]: Date.now(),
    };
    window.localStorage.setItem(AUCTION_DELETED_STORAGE_KEY, JSON.stringify(nextMap));
  } catch {}
}

function notifyAuctionRoomsChanged(detail?: AuctionRoomsChangedDetail) {
  try {
    window.localStorage.setItem(
      "nexora:auction-rooms-changed",
      JSON.stringify({
        at: Date.now(),
        ...(detail || {}),
      })
    );
  } catch {}

  window.dispatchEvent(new CustomEvent("nexora:auction-rooms-changed", { detail }));
}

const AUCTION_SEEN_STORAGE_PREFIX = "nexora:auction-seen-rooms";
const MAX_SEEN_AUCTION_ROOM_IDS = 2000;
const AUCTION_ROOMS_CACHE_KEY = "nexora:auction-rooms-cache:v1";
const AUCTION_ROOMS_CACHE_MAX_AGE_MS = 45 * 1000;

function buildAuctionSeenStorageKey(viewerKey?: string | null) {
  const safeViewerKey = String(viewerKey || "guest").trim() || "guest";
  return `${AUCTION_SEEN_STORAGE_PREFIX}:${safeViewerKey}`;
}

function readSeenAuctionRoomIdArray(storageKey: string) {
  if (typeof window === "undefined" || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function hasSeenAuctionRoomSnapshot(storageKey: string) {
  if (typeof window === "undefined" || !storageKey) return false;

  try {
    return window.localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

function rememberSeenAuctionRoomIds(storageKey: string, ids: string[]) {
  if (typeof window === "undefined" || !storageKey) return;

  const nextIds = Array.from(
    new Set([
      ...ids.map(String).filter(Boolean),
      ...readSeenAuctionRoomIdArray(storageKey),
    ])
  ).slice(0, MAX_SEEN_AUCTION_ROOM_IDS);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(nextIds));
  } catch {}
}

function AuctionModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

function readAuctionRoomsCache() {
  if (typeof window === "undefined") return [] as AuctionRoom[];

  try {
    const raw =
      window.sessionStorage.getItem(AUCTION_ROOMS_CACHE_KEY) ||
      window.localStorage.getItem(AUCTION_ROOMS_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { at?: number; rooms?: unknown };
    const cachedAt = Number(parsed?.at || 0);
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > AUCTION_ROOMS_CACHE_MAX_AGE_MS) {
      return [];
    }

    return Array.isArray(parsed.rooms) ? (parsed.rooms as AuctionRoom[]) : [];
  } catch {
    return [];
  }
}

function writeAuctionRoomsCache(rooms: AuctionRoom[]) {
  if (typeof window === "undefined") return;

  try {
    const payload = JSON.stringify({
      at: Date.now(),
      rooms: rooms.slice(0, 24),
    });
    window.sessionStorage.setItem(AUCTION_ROOMS_CACHE_KEY, payload);
    window.localStorage.setItem(AUCTION_ROOMS_CACHE_KEY, payload);
  } catch {}
}

function RuleModal({
  room,
  onClose,
  onEnter,
}: {
  room: AuctionRoom;
  onClose: () => void;
  onEnter: () => void;
}) {
  return (
    <AuctionModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="กฎก่อนเข้าห้องประมูล"
        className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/88 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-2xl sm:px-4 sm:py-6"
      >
      <div className="flex max-h-[calc(100svh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-amber-300/24 bg-[radial-gradient(circle_at_top,#2a2110_0%,#100e0a_48%,#050505_100%)] text-white shadow-[0_35px_130px_rgba(0,0,0,0.72)] sm:max-h-[92vh] sm:rounded-[30px]">
        <div className="flex shrink-0 items-start gap-3 border-b border-amber-200/10 p-4 pb-3 sm:gap-4 sm:border-b-0 sm:p-7 sm:pb-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-300/14 text-amber-200 sm:h-14 sm:w-14">
            <ShieldAlert className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/70 sm:text-[11px] sm:tracking-[0.28em]">
              Auction Rule
            </div>
            <h2 className="mt-1.5 break-words text-xl font-black leading-tight text-amber-100 sm:mt-2 sm:text-3xl">
              กฎเหล็กก่อนเข้าห้องประมูล
            </h2>
            <p className="mt-1.5 break-words text-xs font-bold leading-5 text-white/62 sm:mt-2 sm:text-sm sm:leading-6">
              ห้อง {room.cardName} จะใช้กติกานี้เพื่อกันการปั่นราคาและรักษาสิทธิ์ของผู้เล่นทุกคน
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-7 sm:py-5">
        <div className="grid gap-2.5 text-xs font-bold leading-5 text-white/78 sm:gap-3 sm:text-sm sm:leading-6">
          <div className="break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            ถ้าหมดเวลาประมูลแล้วผู้ชนะอันดับ 1 ติดต่อไม่ได้หรือไม่กดยืนยันภายใน 24 ชั่วโมง สิทธิ์จะเลื่อนไปอันดับรองลงมาตามลำดับ
          </div>
          <div className="break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            ผู้ที่ชนะแล้วไม่รับสิทธิ์จะถูกระงับสิทธิ์ประมูลถาวร และมีสัญลักษณ์เตือนบนโปรไฟล์
          </div>
          <div className="break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            เมื่อชนะและกดยืนยัน ระบบจะใช้ห้องแชทพิเศษเพื่อให้ผู้ซื้อกับเจ้าของการ์ดนัดรับกันเอง
          </div>
        </div>

        <div className="mt-3 break-words rounded-2xl border border-amber-200/18 bg-amber-300/10 p-3 text-xs font-black leading-5 text-amber-50 sm:p-4 sm:text-sm sm:leading-6">
          หลังปิดประมูล สิทธิ์ซื้อขายจะไล่ตามอันดับแบบอัตโนมัติ: อันดับ 1 มีเวลา 24 ชม.,
          อันดับ 2 มีเวลา 12 ชม., อันดับ 3 มีเวลา 6 ชม., อันดับ 4 ขึ้นไปมีเวลา 3 ชม.
          เมื่อเจ้าของห้องยืนยันผู้ชนะแล้ว ห้องจะยังดูย้อนหลังได้ และระบบจะลบห้องอัตโนมัติหลังครบ 7 วัน
        </div>
        </div>

        <div className="grid shrink-0 gap-2 border-t border-amber-200/14 bg-black/30 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:grid-cols-2 sm:gap-3 sm:px-7 sm:pb-7">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] whitespace-normal rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-center text-xs font-black leading-5 text-white/72 sm:min-h-[52px] sm:text-sm"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="min-h-[48px] whitespace-normal rounded-2xl bg-[linear-gradient(135deg,#fff0a8,#f6c453_48%,#a36b12)] px-4 text-center text-xs font-black leading-5 text-black shadow-[0_0_36px_rgba(246,196,83,0.28)] sm:min-h-[52px] sm:text-sm"
          >
            เข้าไปประมูล
          </button>
        </div>
      </div>
      </div>
    </AuctionModalPortal>
  );
}

export default function AuctionClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const [rooms, setRooms] = useState<AuctionRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [freshRoomIds, setFreshRoomIds] = useState<string[]>([]);
  const [cardNo, setCardNo] = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const [card, setCard] = useState<CardData | null>(null);
  const [openingPrice, setOpeningPrice] = useState("");
  const [minBidStep, setMinBidStep] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalDateTimeValue(new Date()));
  const [endsAt, setEndsAt] = useState(() =>
    toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [ruleRoom, setRuleRoom] = useState<AuctionRoom | null>(null);
  const lastCardLookupRef = useRef("");
  const seenRoomIdsRef = useRef<Set<string>>(new Set());
  const roomsRef = useRef<AuctionRoom[]>([]);
  const latestFetchSeqRef = useRef(0);
  const adminCanDelete = isAdminRoleClient(session?.user?.role);
  const sessionUser = session?.user as
    | { id?: string | null; lineId?: string | null }
    | undefined;
  const viewerSeenStorageKey = useMemo(
    () => buildAuctionSeenStorageKey(sessionUser?.id || sessionUser?.lineId),
    [sessionUser?.id, sessionUser?.lineId]
  );

  const fetchRooms = useCallback(async () => {
    const fetchSeq = latestFetchSeqRef.current + 1;
    latestFetchSeqRef.current = fetchSeq;

    try {
      const res = await fetch(`/api/market/auction?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (fetchSeq !== latestFetchSeqRef.current) {
        return;
      }

      const deletedRoomIds = readDeletedAuctionRoomIds();
      const nextRooms = (Array.isArray(data.rooms) ? (data.rooms as AuctionRoom[]) : [])
        .filter((room) => !deletedRoomIds.has(room.id));
      setRooms(nextRooms);
      writeAuctionRoomsCache(nextRooms);

      const currentIds = nextRooms.map((room) => room.id).filter(Boolean);
      const hasBaseline =
        hasSeenAuctionRoomSnapshot(viewerSeenStorageKey) ||
        seenRoomIdsRef.current.size > 0 ||
        roomsRef.current.length > 0;
      const storedSeenIds = new Set(readSeenAuctionRoomIdArray(viewerSeenStorageKey));
      const knownIds = new Set([
        ...Array.from(storedSeenIds),
        ...Array.from(seenRoomIdsRef.current),
      ]);
      const newIds = hasBaseline
        ? currentIds.filter((id) => !knownIds.has(id))
        : [];
      currentIds.forEach((id) => knownIds.add(id));
      seenRoomIdsRef.current = knownIds;

      if (currentIds.length > 0) {
        window.setTimeout(() => {
          rememberSeenAuctionRoomIds(viewerSeenStorageKey, currentIds);
        }, 0);
      }

      setFreshRoomIds((prev) => {
        const visibleFreshIds = prev.filter((id) => currentIds.includes(id));
        if (newIds.length === 0) {
          return visibleFreshIds.length === prev.length ? prev : visibleFreshIds;
        }

        const merged = new Set(visibleFreshIds);
        newIds.forEach((id) => merged.add(id));
        return Array.from(merged);
      });
    } catch (error) {
      console.error("LOAD AUCTION ROOMS ERROR", error);
    } finally {
      if (fetchSeq === latestFetchSeqRef.current) {
        setRoomsLoading(false);
      }
    }
  }, [viewerSeenStorageKey]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    if (!ruleRoom) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [ruleRoom]);

  useEffect(() => {
    seenRoomIdsRef.current = new Set(readSeenAuctionRoomIdArray(viewerSeenStorageKey));
    roomsRef.current = [];
    setFreshRoomIds([]);
  }, [viewerSeenStorageKey]);

  useEffect(() => {
    const cachedRooms = readAuctionRoomsCache().filter(
      (room) => !readDeletedAuctionRoomIds().has(room.id)
    );
    if (cachedRooms.length > 0) {
      setRooms(cachedRooms);
      roomsRef.current = cachedRooms;
      setRoomsLoading(false);
    }

    void fetchRooms();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchRooms();
      }
    }, 1500);

    const removeDeletedRoomFromState = (roomId?: string | null) => {
      const safeRoomId = String(roomId || "").trim();
      if (!safeRoomId) return;

      setRooms((currentRooms) =>
        currentRooms.filter((room) => room.id !== safeRoomId)
      );
      setFreshRoomIds((currentIds) =>
        currentIds.filter((id) => id !== safeRoomId)
      );
    };

    const refresh = () => {
      if (document.visibilityState === "visible") {
        void fetchRooms();
      }
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === "nexora:auction-rooms-changed") {
        try {
          const detail = JSON.parse(event.newValue || "{}") as AuctionRoomsChangedDetail;
          if (detail.action === "deleted" && detail.roomId) {
            markAuctionRoomDeleted(detail.roomId);
            removeDeletedRoomFromState(detail.roomId);
          }
        } catch {}
        refresh();
      }
    };
    const refreshFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<AuctionRoomsChangedDetail>).detail;
      if (detail?.action === "deleted" && detail.roomId) {
        markAuctionRoomDeleted(detail.roomId);
        removeDeletedRoomFromState(detail.roomId);
      }
      refresh();
    };
    const refreshOnVisibility = () => refresh();

    window.addEventListener("focus", refresh);
    window.addEventListener("nexora:auction-rooms-changed", refreshFromEvent);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("nexora:auction-rooms-changed", refreshFromEvent);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [fetchRooms]);

  useEffect(() => {
    const normalized = normalizeCardNo(cardNo);

    if (!normalized) {
      setCard(null);
      lastCardLookupRef.current = "";
      return;
    }

    const timer = window.setTimeout(async () => {
      if (lastCardLookupRef.current === normalized) {
        return;
      }

      lastCardLookupRef.current = normalized;
      setCardLoading(true);

      try {
        const res = await fetch(`/api/card?cardNo=${encodeURIComponent(normalized)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        setCard({
          cardNo: normalized,
          cardName: data.card_name || data.cardName || `NEXORA Card #${normalized}`,
          rarity: data.rarity || data.value || "Legendary",
          imageUrl: data.image_url || data.imageUrl || `/cards/${normalized}.jpg`,
        });
      } catch {
        setCard({
          cardNo: normalized,
          cardName: `NEXORA Card #${normalized}`,
          rarity: "Legendary",
          imageUrl: `/cards/${normalized}.jpg`,
        });
      } finally {
        setCardLoading(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [cardNo]);

  const normalizedRoomSearch = roomSearch.replace(/\D/g, "").slice(0, 3);
  const featuredRooms = useMemo(() => {
    if (!normalizedRoomSearch) return rooms.slice(0, 6);

    return rooms.filter((room) =>
      formatAuctionRoomNumber(room.roomNumber).includes(
        normalizedRoomSearch.padStart(normalizedRoomSearch.length, "0")
      )
    );
  }, [normalizedRoomSearch, rooms]);

  const createAuction = async () => {
    if (creating) return;

    if (!card) {
      await nexoraAlert({
        title: "ยังไม่ได้เลือกการ์ด",
        message: "กรอกเลขการ์ดก่อน ระบบจะดึงการ์ดขึ้นมาให้ทันที",
        tone: "warning",
      });
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/market/auction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardNo: card.cardNo,
          cardName: card.cardName,
          imageUrl: card.imageUrl,
          rarity: card.rarity,
          openingPrice,
          minBidStep,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "สร้างห้องประมูลไม่สำเร็จ");
      }

      await nexoraAlert({
        title: "สร้างห้องประมูลสำเร็จ",
        message: "ห้องถูกเปิดในสนามประมูลแล้ว และไม่สามารถแก้ไขข้อมูลห้องนี้ได้",
        tone: "success",
      });

      notifyAuctionRoomsChanged({ action: "created", roomId: data.room?.id });
      router.push(`/market/auction/${data.room.id}`);
    } catch (error) {
      await nexoraAlert({
        title: "สร้างห้องไม่สำเร็จ",
        message: String(error instanceof Error ? error.message : error),
        tone: "danger",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteAuction = async (room: AuctionRoom) => {
    if (!adminCanDelete || deletingRoomId) return;

    const confirmed = await nexoraConfirm({
      title: "ลบห้องประมูล",
      message: `ยืนยันการลบห้องประมูล ${room.cardName} ใช่ไหม? ข้อมูลบิททั้งหมดในห้องนี้จะถูกลบออกจากระบบด้วย`,
      tone: "danger",
      confirmText: "ยืนยันการลบ",
      cancelText: "ยกเลิก",
    });

    if (!confirmed) return;

    try {
      setDeletingRoomId(room.id);
      const res = await fetch(`/api/market/auction/${encodeURIComponent(room.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "ลบห้องประมูลไม่สำเร็จ");
      }

      markAuctionRoomDeleted(room.id);
      setRooms((currentRooms) =>
        currentRooms.filter((currentRoom) => currentRoom.id !== room.id)
      );
      setFreshRoomIds((currentIds) => currentIds.filter((id) => id !== room.id));
      notifyAuctionRoomsChanged({ action: "deleted", roomId: room.id });

      await nexoraAlert({
        title: "ลบห้องประมูลแล้ว",
        message: "ห้องประมูลนี้ถูกลบออกจากระบบเรียบร้อย",
        tone: "success",
      });
    } catch (error) {
      await nexoraAlert({
        title: "ลบห้องประมูลไม่สำเร็จ",
        message: String(error instanceof Error ? error.message : error),
        tone: "danger",
      });
    } finally {
      setDeletingRoomId("");
    }
  };

  return (
    <div className="min-h-full overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,#231706_0%,#080706_46%,#020202_100%)] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(250,204,21,0.16),transparent_28%),radial-gradient(circle_at_85%_8%,rgba(255,255,255,0.07),transparent_22%)]" />

      <div className="mx-auto max-w-7xl space-y-5 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 md:pb-4 xl:px-6">
        <section className="relative overflow-hidden rounded-[34px] border border-amber-200/18 bg-[linear-gradient(135deg,rgba(255,224,138,0.14),rgba(255,255,255,0.045)_34%,rgba(0,0,0,0.42))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.52)] sm:p-7 lg:p-9">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(251,191,36,0.22),transparent_24%),linear-gradient(90deg,rgba(255,255,255,0.045),transparent_48%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/24 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">
                <Gavel className="h-4 w-4" />
                NEXORA AUCTION ARENA
              </div>
              <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight text-amber-100 sm:text-5xl lg:text-7xl">
                สนามประมูลการ์ด
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/62 sm:text-base">
                เปิดห้องประมูลการ์ดใบเดียว ตั้งราคาเปิด บิทขั้นต่ำ วันเวลาเปิดปิด และให้ทุกคนแข่งบิทกันแบบเห็นกระดานเดียวกันทั้งห้อง
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[24px] border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/36">
                  <Trophy className="h-4 w-4 text-amber-300" />
                  Rooms
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  {rooms.length.toLocaleString("th-TH")}
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/36">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Live
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-300">
                  {rooms.filter((room) => getRoomPhase(room) === "live").length}
                </div>
              </div>
            </div>
          </div>
        </section>

        <MarketFeatureNav />

        <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[30px] border border-amber-200/14 bg-black/34 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.38)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-200/54">
                  Create Room
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">
                  สร้างห้องประมูล
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fff0a8,#d59a21)] text-black">
                <Plus className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-white/72">
                  เลขการ์ด
                </span>
                <input
                  value={cardNo}
                  onChange={(event) => setCardNo(event.target.value)}
                  inputMode="numeric"
                  placeholder="เช่น 75, 216, 293"
                  className="min-h-[54px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-base font-black text-white outline-none placeholder:text-white/28 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12"
                />
              </label>

              <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
                {card ? (
                  <div className="grid gap-4 sm:grid-cols-[130px_1fr] sm:items-center">
                    <SafeCardImage
                      cardNo={card.cardNo}
                      imageUrl={card.imageUrl}
                      alt={card.cardName}
                      loading="eager"
                      className="mx-auto aspect-[3/4] w-full max-w-[160px] rounded-[18px] object-contain shadow-[0_0_40px_rgba(251,191,36,0.2)]"
                    />
                    <div className="min-w-0 text-center sm:text-left">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/54">
                        Card Found
                      </div>
                      <div className="mt-2 break-words text-xl font-black text-white">
                        {card.cardName}
                      </div>
                      <div className="mt-1 text-sm font-bold text-white/48">
                        No.{card.cardNo} • {card.rarity}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[160px] items-center justify-center text-center text-sm font-bold leading-6 text-white/38">
                    {cardLoading ? (
                      <span className="inline-flex items-center gap-2 text-amber-200">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังดึงการ์ด...
                      </span>
                    ) : (
                      "กรอกเลขการ์ดแล้วตัวอย่างจะเด้งขึ้นมาทันที"
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-white/72">
                    เปิดราคาประมูล
                  </span>
                  <input
                    value={openingPrice}
                    onChange={(event) => setOpeningPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="เช่น 100"
                    className="min-h-[54px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-base font-black text-white outline-none placeholder:text-white/28 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-white/72">
                    บิทขั้นต่ำประมูล
                  </span>
                  <input
                    value={minBidStep}
                    onChange={(event) => setMinBidStep(event.target.value)}
                    inputMode="decimal"
                    placeholder="เช่น 50"
                    className="min-h-[54px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-base font-black text-white outline-none placeholder:text-white/28 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-black text-white/72">
                    <CalendarDays className="h-4 w-4 text-amber-300" />
                    เวลาเปิดประมูล
                  </span>
                  <input
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    type="datetime-local"
                    className="min-h-[54px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white outline-none [color-scheme:dark] focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-black text-white/72">
                    <Clock className="h-4 w-4 text-amber-300" />
                    เวลาปิดประมูล
                  </span>
                  <input
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    type="datetime-local"
                    className="min-h-[54px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white outline-none [color-scheme:dark] focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={createAuction}
                disabled={creating}
                className="min-h-[58px] rounded-[22px] bg-[linear-gradient(135deg,#fff5bd,#f7c84d_50%,#9c650c)] px-5 text-base font-black text-black shadow-[0_0_42px_rgba(247,200,77,0.28)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {creating ? "กำลังสร้างห้อง..." : "สร้างห้องประมูล"}
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-amber-200/14 bg-black/30 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.34)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-200/54">
                  Latest Rooms
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">
                  ห้องประมูลล่าสุด
                </h2>
              </div>
              <Crown className="h-7 w-7 text-amber-300" />
            </div>

            <label className="mt-4 flex min-h-[52px] items-center gap-3 rounded-[22px] border border-amber-200/16 bg-black/34 px-4 text-sm font-black text-white shadow-[inset_0_0_22px_rgba(251,191,36,0.035)] focus-within:border-amber-300/42 focus-within:ring-2 focus-within:ring-amber-300/12">
              <Search className="h-4 w-4 shrink-0 text-amber-300" />
              <input
                value={roomSearch}
                onChange={(event) =>
                  setRoomSearch(event.target.value.replace(/\D/g, "").slice(0, 3))
                }
                inputMode="numeric"
                placeholder="ค้นหาห้องประมูล เช่น 001"
                className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/30"
              />
              {normalizedRoomSearch ? (
                <span className="rounded-full border border-amber-200/22 bg-amber-300/12 px-3 py-1 text-[10px] font-black text-amber-100">
                  ห้อง {normalizedRoomSearch.padStart(3, "0")}
                </span>
              ) : null}
            </label>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {roomsLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`auction-room-skeleton-${index}`}
                    className="min-h-[348px] overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_18px_70px_rgba(0,0,0,0.24)]"
                  >
                    <div className="relative h-[220px] bg-black/35">
                      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_45%)]" />
                      <div className="absolute left-3 top-3 h-7 w-24 rounded-full bg-amber-200/12" />
                      <div className="absolute left-1/2 top-1/2 h-36 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/8" />
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="h-5 w-3/4 rounded-full bg-white/10" />
                      <div className="h-3 w-1/2 rounded-full bg-white/6" />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="h-16 rounded-2xl bg-black/26" />
                        <div className="h-16 rounded-2xl bg-black/26" />
                      </div>
                      <div className="h-3 w-2/3 rounded-full bg-white/6" />
                    </div>
                  </div>
                ))
              ) : featuredRooms.length === 0 ? (
                <div className="col-span-full flex min-h-[260px] items-center justify-center rounded-[26px] border border-dashed border-white/12 bg-white/[0.025] px-4 text-center text-sm font-bold leading-6 text-white/42">
                  ยังไม่มีห้องประมูล เปิดห้องแรกแล้วสนามจะสว่างขึ้นทันที
                </div>
              ) : (
                featuredRooms.map((room) => {
                  const phase = getRoomPhase(room);
                  const nextMinimum = getNextMinimum(room);
                  const roomNumberLabel = formatAuctionRoomNumber(room.roomNumber);
                  const isFreshRoom = freshRoomIds.includes(room.id);

                  return (
                    <article
                      key={room.id}
                      className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] shadow-[0_18px_70px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-amber-200/28"
                    >
                      {adminCanDelete ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void deleteAuction(room);
                          }}
                          disabled={deletingRoomId === room.id}
                          aria-label={`ลบห้องประมูล ${room.cardName}`}
                          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200/28 bg-red-500/18 text-red-100 shadow-[0_12px_34px_rgba(127,29,29,0.36)] backdrop-blur transition hover:bg-red-500/28 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingRoomId === room.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setRuleRoom(room)}
                        className="block w-full text-left"
                      >
                      <div className="relative h-[220px] overflow-hidden bg-black/35">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.28),transparent_46%)] opacity-80" />
                        <SafeCardImage
                          cardNo={room.cardNo}
                          imageUrl={room.imageUrl}
                          alt={room.cardName}
                          className="relative z-10 mx-auto h-full w-full object-contain p-4 transition duration-500 group-hover:scale-[1.04]"
                        />
                        <div className="absolute left-3 top-3 z-30 flex flex-wrap items-center gap-2">
                          <div className="rounded-full border border-amber-200/28 bg-black/58 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                            {phase === "live" ? "LIVE" : phase === "scheduled" ? "SOON" : "ENDED"}
                          </div>
                          <div className="rounded-full border border-amber-200/32 bg-[linear-gradient(135deg,#fff1a8,#f6c453_52%,#9c650c)] px-3 py-1 text-[10px] font-black text-black shadow-[0_0_22px_rgba(251,191,36,0.28)]">
                            ห้อง {roomNumberLabel}
                          </div>
                          <div className="hidden">
                            ห้อง {roomNumberLabel}
                          </div>
                        </div>
                        {isFreshRoom ? (
                          <div className="absolute right-3 top-14 z-30 rounded-full border border-amber-300/30 bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-[0_0_22px_rgba(251,191,36,0.35)]">
                            NEW
                          </div>
                        ) : null}
                      </div>

                      <div className="p-4">
                        <div className="line-clamp-2 text-lg font-black text-white">
                          {room.cardName}
                        </div>
                        <div className="mt-1 text-xs font-bold text-white/42">
                          No.{room.cardNo} • {room.rarity}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-black/28 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/32">
                              Top Bid
                            </div>
                            <div className="mt-1 text-lg font-black text-amber-200">
                              {formatBaht(room.topBid || room.openingPrice)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-black/28 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/32">
                              Next
                            </div>
                            <div className="mt-1 text-lg font-black text-white">
                              {formatBaht(nextMinimum)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs font-bold leading-5 text-white/42">
                          ปิด {formatDateTime(room.endsAt)} • {room.bidCount} บิท
                        </div>
                      </div>
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {ruleRoom ? (
        <RuleModal
          room={ruleRoom}
          onClose={() => setRuleRoom(null)}
          onEnter={() => {
            const target = ruleRoom.id;
            try {
              window.localStorage.setItem(`nexora:auction-rules:${target}`, "1");
            } catch {}
            setRuleRoom(null);
            router.push(`/market/auction/${target}`);
          }}
        />
      ) : null}
    </div>
  );
}
