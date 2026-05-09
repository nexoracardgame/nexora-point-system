"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Gavel,
  Handshake,
  Loader2,
  ScrollText,
  Send,
  ShieldAlert,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import { nexoraAlert, nexoraConfirm } from "@/lib/nexora-dialog";

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
  confirmedWinnerId: string;
  confirmedAt: string | null;
  topBid: number;
  bidCount: number;
};

type AuctionBid = {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  bidderImage: string;
  amount: number;
  message: string;
  createdAt: string;
};

type AuctionPayload = {
  room: AuctionRoom;
  bids: AuctionBid[];
  nextMinimumBid: number;
};

type AuctionFinalRank = AuctionBid & {
  bidTotal: number;
};

function formatBaht(value: number) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function formatAuctionRoomNumber(value?: number | string | null) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0
    ? String(Math.floor(numeric)).padStart(3, "0")
    : "---";
}

function buildAuctionTermsStorageKey(roomId: string, viewerKey?: string | null) {
  const safeRoomId = String(roomId || "unknown").trim() || "unknown";
  const safeViewerKey = String(viewerKey || "guest").trim() || "guest";
  return `nexora:auction-terms:${safeRoomId}:${safeViewerKey}`;
}

function buildAuctionTermsRoomStorageKey(roomId: string) {
  const safeRoomId = String(roomId || "unknown").trim() || "unknown";
  return `nexora:auction-terms:${safeRoomId}:accepted`;
}

function AuctionModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRoomPhase(room?: AuctionRoom | null) {
  if (!room) return "loading";

  const now = Date.now();
  const startsAt = new Date(room.startsAt).getTime();
  const endsAt = new Date(room.endsAt).getTime();

  if (now < startsAt) return "scheduled";
  if (now > endsAt || room.status !== "active") return "ended";
  return "live";
}

function getTimeLeftLabel(room?: AuctionRoom | null) {
  if (!room) return "";

  const phase = getRoomPhase(room);
  const target = phase === "scheduled" ? room.startsAt : room.endsAt;
  const diffMs = new Date(target).getTime() - Date.now();

  if (diffMs <= 0) return phase === "ended" ? "ปิดประมูลแล้ว" : "กำลังเปิด";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  return `${Math.max(1, minutes)} นาที`;
}

function isAdminRoleClient(role?: string | null) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "gm" || normalized === "superadmin";
}

function getProfileHref(userId?: string | null) {
  const safeUserId = String(userId || "").trim();
  return safeUserId ? `/profile/${encodeURIComponent(safeUserId)}` : "/profile/me";
}

function getBidTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getAuctionRankWindowHours(index: number) {
  if (index === 0) return 24;
  if (index === 1) return 12;
  if (index === 2) return 6;
  return 3;
}

function formatHourWindow(hours: number) {
  return `${hours} ชม.`;
}

function getActiveAuctionRankIndex(room: AuctionRoom, ranking: AuctionFinalRank[]) {
  if (!room || ranking.length === 0 || room.confirmedWinnerId) return -1;

  const endedAt = new Date(room.endsAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(endedAt) || now <= endedAt) return -1;

  let elapsedMs = now - endedAt;
  for (let index = 0; index < ranking.length; index += 1) {
    const windowMs = getAuctionRankWindowHours(index) * 60 * 60 * 1000;
    if (elapsedMs < windowMs) return index;
    elapsedMs -= windowMs;
  }

  return -1;
}

function getAuctionRankRemainingMs(room: AuctionRoom, index: number) {
  const endedAt = new Date(room.endsAt).getTime();
  if (!Number.isFinite(endedAt) || index < 0) return 0;

  let startsAfterMs = 0;
  for (let rankIndex = 0; rankIndex < index; rankIndex += 1) {
    startsAfterMs += getAuctionRankWindowHours(rankIndex) * 60 * 60 * 1000;
  }

  const endsAt = endedAt + startsAfterMs + getAuctionRankWindowHours(index) * 60 * 60 * 1000;
  return Math.max(0, endsAt - Date.now());
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} ชม. ${minutes} นาที`;
  if (hours > 0) return `${hours} ชม.`;
  return `${minutes} นาที`;
}

type AuctionRoomsChangedDetail = {
  action?: "created" | "deleted" | "updated";
  roomId?: string | null;
};

const AUCTION_DELETED_STORAGE_KEY = "nexora:auction-deleted-rooms";
const AUCTION_DELETED_TTL_MS = 10 * 60 * 1000;

function markAuctionRoomDeleted(roomId?: string | null) {
  const safeRoomId = String(roomId || "").trim();
  if (!safeRoomId || typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(AUCTION_DELETED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const activeEntries = Object.entries(
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
    )
      .map(([id, timestamp]) => [String(id), Number(timestamp)] as const)
      .filter(([id, timestamp]) => id && Number.isFinite(timestamp))
      .filter(([, timestamp]) => now - timestamp < AUCTION_DELETED_TTL_MS);
    const nextMap = {
      ...Object.fromEntries(activeEntries),
      [safeRoomId]: now,
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

function AuctionFireworks({ active }: { active: boolean }) {
  if (!active) return null;

  const bursts = [
    { left: "8%", top: "18%", delay: "0s" },
    { left: "24%", top: "44%", delay: "0.5s" },
    { left: "48%", top: "14%", delay: "0.9s" },
    { left: "72%", top: "32%", delay: "0.25s" },
    { left: "88%", top: "16%", delay: "0.7s" },
    { left: "64%", top: "62%", delay: "1.15s" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(251,191,36,0.18),transparent_18%),radial-gradient(circle_at_72%_22%,rgba(255,237,180,0.14),transparent_16%),radial-gradient(circle_at_54%_68%,rgba(180,83,9,0.16),transparent_20%)]" />
      {bursts.map((burst, burstIndex) => (
        <div
          key={`${burst.left}-${burst.top}`}
          className="nexora-auction-burst"
          style={{
            left: burst.left,
            top: burst.top,
            animationDelay: burst.delay,
          }}
        >
          {Array.from({ length: 12 }).map((_, sparkIndex) => (
            <span
              key={sparkIndex}
              style={
                {
                  "--spark-angle": `${sparkIndex * 30 + burstIndex * 8}deg`,
                  animationDelay: burst.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
      <style>{`
        .nexora-auction-burst {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #fde68a;
          box-shadow: 0 0 28px rgba(251, 191, 36, 0.72);
          animation: nexoraAuctionBurst 2.8s ease-out infinite;
        }
        .nexora-auction-burst span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 4px;
          height: 15px;
          border-radius: 999px;
          background: linear-gradient(180deg, #fff7cc, #f59e0b 62%, transparent);
          transform-origin: center top;
          animation: nexoraAuctionSpark 2.8s ease-out infinite;
        }
        @keyframes nexoraAuctionBurst {
          0%, 16% {
            opacity: 0;
            transform: scale(0.2);
          }
          24% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.25);
          }
        }
        @keyframes nexoraAuctionSpark {
          0%, 20% {
            opacity: 0;
            transform: rotate(var(--spark-angle)) translateY(0) scaleY(0.2);
          }
          28% {
            opacity: 1;
          }
          82%, 100% {
            opacity: 0;
            transform: rotate(var(--spark-angle)) translateY(-92px) scaleY(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .nexora-auction-burst,
          .nexora-auction-burst span {
            animation: none;
            opacity: 0.45;
          }
        }
      `}</style>
    </div>
  );
}

function RuleOverlay({ onAccept }: { onAccept: () => void }) {
  return (
    <AuctionModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="กฎก่อนประมูล"
        className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/86 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl sm:px-4 sm:py-6"
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
              กฎเหล็กก่อนประมูล
            </h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-7 sm:py-6">
        <div className="grid gap-2.5 text-xs font-bold leading-5 text-white/78 sm:gap-3 sm:text-sm sm:leading-6">
          <div className="break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            ราคาบิทต้องสูงกว่าราคาปัจจุบันอย่างน้อยตามบิทขั้นต่ำของห้องนี้เสมอ
          </div>
          <div className="break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            ผู้ชนะต้องกดยืนยันภายใน 24 ชั่วโมงหลังปิดประมูล ถ้าไม่รับสิทธิ์จะถูกแบนจากสนามประมูลถาวร
          </div>
          <div className="break-words rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
            หากอันดับหนึ่งไม่รับ สิทธิ์จะเลื่อนไปอันดับสองและอันดับถัดไปตามลำดับ
          </div>
        </div>

        <div className="mt-3 break-words rounded-2xl border border-amber-200/18 bg-amber-300/10 p-3 text-xs font-black leading-5 text-amber-50 sm:p-4 sm:text-sm sm:leading-6">
          สิทธิ์หลังปิดประมูลจะไล่ตามอันดับ: TOP 1 มีเวลา 24 ชม., TOP 2 มีเวลา 12 ชม., TOP 3 มีเวลา 6 ชม., TOP 4 ขึ้นไปมีเวลา 3 ชม. เจ้าของห้องจะเปิดแชทซื้อขายกับผู้ได้สิทธิ์ และห้องจะถูกลบอัตโนมัติหลังปิดประมูลครบ 7 วัน
        </div>
        </div>

        <button
          type="button"
          onClick={onAccept}
          className="m-4 mt-0 min-h-[50px] shrink-0 whitespace-normal rounded-2xl bg-[linear-gradient(135deg,#fff0a8,#f6c453_48%,#a36b12)] px-4 text-center text-sm font-black leading-5 text-black shadow-[0_0_36px_rgba(246,196,83,0.28)] sm:m-7 sm:mt-0 sm:min-h-[54px]"
        >
          เข้าใจแล้ว เริ่มดูห้องประมูล
        </button>
      </div>
      </div>
    </AuctionModalPortal>
  );
}

const AUCTION_TERMS = [
  "ห้องประมูลที่สร้างแล้วจะแก้ไขเลขการ์ด ราคาเปิด บิทขั้นต่ำ วันเวลาเริ่ม และวันเวลาปิดไม่ได้ เพื่อให้ทุกคนเห็นเงื่อนไขเดียวกันตั้งแต่ต้น",
  "ราคาบิทต้องไม่ต่ำกว่าราคาปัจจุบันบวกบิทขั้นต่ำของห้อง เช่น ราคาเปิด 100 บาท บิทขั้นต่ำ 50 บาท คนแรกต้องใส่อย่างน้อย 150 บาท ถ้าคนล่าสุดบิท 1,000 บาท คนถัดไปต้องใส่อย่างน้อย 1,050 บาท",
  "ระบบจะนับบิทล่าสุดของแต่ละผู้ใช้เป็นราคาสุดท้ายของคนนั้น แล้วเรียงอันดับ TOP จากราคาสูงสุดลงมาต่ำสุด หากราคาเท่ากันจะยึดเวลาบิทที่เกิดก่อนเป็นลำดับที่สูงกว่า",
  "เมื่อหมดเวลาประมูล ห้องจะสรุปอันดับ TOP ให้เห็นทั้งหมด และสิทธิ์ซื้อขายจะเริ่มที่ TOP 1 ก่อน",
  "ช่วงเวลาตอบรับสิทธิ์หลังปิดประมูลคือ TOP 1 มีเวลา 24 ชม., TOP 2 มีเวลา 12 ชม., TOP 3 มีเวลา 6 ชม., TOP 4 ขึ้นไปมีเวลา 3 ชม. ต่ออันดับ",
  "ในช่วงที่อันดับใดได้สิทธิ์ เจ้าของห้องจะเห็นปุ่มห้องแชทซื้อขายและปุ่มยืนยันผู้ชนะเฉพาะอันดับนั้น เพื่อคุยตกลงรับการ์ดจริง",
  "ถ้าเจ้าของห้องไม่กดยืนยันผู้ชนะภายในเวลาของอันดับนั้น แชทดีลของอันดับนั้นจะถูกปิด และสิทธิ์จะเลื่อนไปอันดับถัดไปอัตโนมัติ",
  "ถ้าเจ้าของห้องกดยืนยันผู้ชนะแล้ว ระบบจะถือว่าผู้ชนะคนนั้นติดต่อซื้อขายกับเจ้าของห้องเรียบร้อย แชทดีลนั้นจะอยู่ต่อจนกว่าห้องถูกลบหรือครบ 7 วันหลังเวลาปิดประมูล",
  "หลังปิดประมูล ห้องจะถูกลบอัตโนมัติเมื่อครบ 7 วันนับจากเวลาสิ้นสุด เพื่อให้มีเวลาตรวจสอบอันดับและคุยซื้อขายให้จบ",
  "GM/แอดมินสามารถลบห้องได้ทุกเวลา ส่วนเจ้าของห้องจะเห็นปุ่มลบห้องหลังยืนยันผู้ชนะแล้ว",
  "การบิทเล่น ปั่นราคา ใช้ข้อความก่อกวน หรือชนะแล้วจงใจหาย อาจถูกตรวจสอบและระงับสิทธิ์การร่วมประมูลตามความเหมาะสม",
  "การนัดรับ โอนเงิน ส่งมอบการ์ด และรายละเอียดภายนอกแชทดีล เป็นข้อตกลงระหว่างเจ้าของห้องและผู้ชนะ ควรตรวจสอบตัวตน หลักฐาน และสภาพการ์ดให้ชัดเจนก่อนจบดีล",
];

function AuctionTermsOverlay({
  mode,
  onAccept,
  onCancel,
  onClose,
}: {
  mode: "required" | "info";
  onAccept: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const isRequired = mode === "required";

  return (
    <AuctionModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="เงื่อนไขการประมูล"
        className="fixed inset-0 z-[5010] flex items-center justify-center bg-black/88 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-2xl sm:px-4 sm:py-5"
      >
      <div className="relative flex max-h-[calc(100svh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-amber-200/35 bg-[radial-gradient(circle_at_top,#3b2a0d_0%,#120f08_46%,#030303_100%)] text-white shadow-[0_34px_150px_rgba(0,0,0,0.78),0_0_50px_rgba(251,191,36,0.16)] sm:max-h-[96vh] sm:rounded-[28px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(255,231,151,0.18),transparent_28%),radial-gradient(circle_at_8%_10%,rgba(251,191,36,0.12),transparent_24%)]" />

        {isRequired ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเงื่อนไขการประมูล"
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/72 transition hover:bg-white/[0.1] hover:text-white sm:right-4 sm:top-4 sm:h-11 sm:w-11"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="relative z-10 border-b border-amber-200/14 px-3 py-2.5 sm:px-5 sm:py-4">
          <div className="flex items-start gap-2 pr-9 sm:gap-3 sm:pr-10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200/34 bg-amber-300/14 text-amber-100 shadow-[0_0_26px_rgba(251,191,36,0.18)] sm:h-12 sm:w-12">
              <ScrollText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/68 sm:text-[11px] sm:tracking-[0.28em]">
                Auction Terms
              </div>
              <h2 className="mt-1 break-words text-lg font-black leading-tight text-amber-50 sm:mt-1.5 sm:text-2xl">
                เงื่อนไขการประมูล NEXORA
              </h2>
              <p className="mt-1 break-words text-[11px] font-bold leading-5 text-white/58 sm:mt-1.5 sm:text-sm">
                อ่านให้ครบก่อนเข้าร่วม เพื่อให้เข้าใจกติกาบิท สิทธิ์ผู้ชนะ แชทดีล และเวลาของแต่ละอันดับอย่างชัดเจน
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid gap-1.5 lg:grid-cols-2 lg:gap-2.5">
            {AUCTION_TERMS.map((term, index) => (
              <div
                key={term}
                className="grid grid-cols-[28px_1fr] gap-2 rounded-[15px] border border-white/10 bg-white/[0.045] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:grid-cols-[34px_1fr] sm:gap-2.5 sm:rounded-[18px] sm:p-3"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-200/30 bg-amber-300/12 text-[10px] font-black text-amber-100 sm:h-8 sm:w-8 sm:text-xs">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="break-words text-[10px] font-bold leading-[1.48] text-white/78 sm:text-[13px] sm:leading-5">
                  {term}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 break-words rounded-[16px] border border-amber-200/22 bg-amber-300/10 p-2 text-[10px] font-black leading-[1.55] text-amber-50 sm:mt-3 sm:rounded-[20px] sm:p-3 sm:text-[13px] sm:leading-5">
            สรุปสั้นๆ: บิทให้ถึงขั้นต่ำ รอระบบจัดอันดับหลังปิดประมูล เจ้าของห้องติดต่อผู้มีสิทธิ์ตามลำดับเวลา และเมื่อยืนยันผู้ชนะแล้วแชทดีลจะอยู่ต่อให้คุยซื้อขายจนจบภายในกรอบ 7 วัน
          </div>
        </div>

        <div className="relative z-10 grid shrink-0 gap-2 border-t border-amber-200/14 bg-black/30 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:grid-cols-[1fr_0.8fr] sm:gap-3 sm:px-5 sm:py-3">
          <button
            type="button"
            onClick={onAccept}
            className="min-h-[46px] whitespace-normal rounded-2xl bg-[linear-gradient(135deg,#fff0a8,#f6c453_48%,#a36b12)] px-3 text-center text-xs font-black leading-5 text-black shadow-[0_0_36px_rgba(246,196,83,0.28)] transition active:scale-[0.99] sm:min-h-[48px] sm:px-4 sm:text-sm"
          >
            {isRequired ? "ยอมรับเงื่อนไขทุกประการ" : "รับทราบเงื่อนไขแล้ว"}
          </button>
          {isRequired ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[46px] whitespace-normal rounded-2xl border border-white/14 bg-white/[0.08] px-3 text-center text-xs font-black leading-5 text-white/82 transition hover:bg-white/[0.12] active:scale-[0.99] sm:min-h-[48px] sm:px-4 sm:text-sm"
            >
              ยกเลิกการเข้าร่วมประมูล
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] whitespace-normal rounded-2xl border border-white/14 bg-white/[0.08] px-3 text-center text-xs font-black leading-5 text-white/82 transition hover:bg-white/[0.12] active:scale-[0.99] sm:min-h-[48px] sm:px-4 sm:text-sm"
            >
              ปิดหน้าต่าง
            </button>
          )}
        </div>
      </div>
      </div>
    </AuctionModalPortal>
  );
}

export default function AuctionRoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [payload, setPayload] = useState<AuctionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [confirmingWinnerId, setConfirmingWinnerId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(true);
  const [acceptedAuctionTerms, setAcceptedAuctionTerms] = useState(true);
  const [showAuctionTerms, setShowAuctionTerms] = useState(false);
  const [auctionTermsMode, setAuctionTermsMode] = useState<"required" | "info">("required");
  const bidBoardEndRef = useRef<HTMLDivElement>(null);
  const mobileBidBoardRef = useRef<HTMLDivElement>(null);
  const adminCanDelete = isAdminRoleClient(session?.user?.role);
  const sessionUser = session?.user as
    | { id?: string | null; lineId?: string | null; email?: string | null }
    | undefined;
  const auctionTermsViewerKey = useMemo(() => {
    return (
      [sessionUser?.id, sessionUser?.lineId, sessionUser?.email]
        .map((value) => String(value || "").trim())
        .find(Boolean) || "guest"
    );
  }, [sessionUser?.email, sessionUser?.id, sessionUser?.lineId]);
  const auctionTermsStorageKey = useMemo(
    () => buildAuctionTermsStorageKey(roomId, auctionTermsViewerKey),
    [auctionTermsViewerKey, roomId]
  );
  const auctionTermsRoomStorageKey = useMemo(
    () => buildAuctionTermsRoomStorageKey(roomId),
    [roomId]
  );

  const room = payload?.room || null;
  const bids = payload?.bids || [];
  const phase = getRoomPhase(room);
  const currentUserIds = useMemo(
    () =>
      new Set(
        [sessionUser?.id, sessionUser?.lineId]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      ),
    [sessionUser?.id, sessionUser?.lineId]
  );
  const isRoomOwner = Boolean(room?.sellerId && currentUserIds.has(room.sellerId));
  const roomCanDelete = Boolean(
    adminCanDelete || (isRoomOwner && room?.confirmedWinnerId && room?.confirmedAt)
  );
  const topBid = useMemo(
    () =>
      bids.reduce<AuctionBid | null>(
        (best, bid) => (!best || bid.amount > best.amount ? bid : best),
        null
      ),
    [bids]
  );
  const finalRanking = useMemo(() => {
    const latestByBidder = new Map<string, AuctionFinalRank>();

    bids.forEach((bid) => {
      const bidderKey = bid.bidderId || bid.bidderName || bid.id;
      const existing = latestByBidder.get(bidderKey);
      const bidTotal = (existing?.bidTotal || 0) + 1;

      if (!existing || getBidTime(bid.createdAt) >= getBidTime(existing.createdAt)) {
        latestByBidder.set(bidderKey, {
          ...bid,
          bidTotal,
        });
        return;
      }

      latestByBidder.set(bidderKey, {
        ...existing,
        bidTotal,
      });
    });

    return Array.from(latestByBidder.values()).sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return getBidTime(a.createdAt) - getBidTime(b.createdAt);
    });
  }, [bids]);
  const activeRankIndex = room ? getActiveAuctionRankIndex(room, finalRanking) : -1;
  const activeRank =
    activeRankIndex >= 0 ? finalRanking[activeRankIndex] || null : null;
  const confirmedWinner = room?.confirmedWinnerId
    ? finalRanking.find((bid) => bid.bidderId === room.confirmedWinnerId) || null
    : null;
  const nextMinimumBid = Number(payload?.nextMinimumBid || 0);
  const canBid = phase === "live";

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/auction/${encodeURIComponent(roomId)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "โหลดห้องประมูลไม่สำเร็จ");
      }

      setPayload({
        room: data.room,
        bids: Array.isArray(data.bids) ? data.bids : [],
        nextMinimumBid: Number(data.nextMinimumBid || 0),
      });
    } catch (error) {
      console.error("LOAD AUCTION ROOM ERROR", error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    try {
      setAcceptedRules(
        window.localStorage.getItem(`nexora:auction-rules:${roomId}`) === "1"
      );
    } catch {
      setAcceptedRules(false);
    }
  }, [roomId]);

  useEffect(() => {
    try {
      setAcceptedAuctionTerms(
        window.localStorage.getItem(auctionTermsStorageKey) === "1" ||
          window.localStorage.getItem(auctionTermsRoomStorageKey) === "1"
      );
    } catch {
      setAcceptedAuctionTerms(false);
    }
  }, [auctionTermsRoomStorageKey, auctionTermsStorageKey]);

  useEffect(() => {
    if (!room || !acceptedRules || acceptedAuctionTerms) return;

    setAuctionTermsMode("required");
    setShowAuctionTerms(true);
  }, [acceptedAuctionTerms, acceptedRules, room?.id]);

  const auctionGateOpen = !acceptedRules || (acceptedRules && showAuctionTerms);

  useEffect(() => {
    if (!auctionGateOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [auctionGateOpen]);

  useEffect(() => {
    void fetchRoom();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchRoom();
      }
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [fetchRoom]);

  useEffect(() => {
    if (nextMinimumBid > 0) {
      setAmount((prev) => {
        const current = Number(String(prev || "").replace(/[^\d.-]/g, ""));
        return !prev || !Number.isFinite(current) || current < nextMinimumBid
          ? String(nextMinimumBid)
          : prev;
      });
    }
  }, [nextMinimumBid]);

  const acceptRules = () => {
    try {
      window.localStorage.setItem(`nexora:auction-rules:${roomId}`, "1");
    } catch {}
    setAcceptedRules(true);
  };

  const acceptAuctionTerms = () => {
    try {
      window.localStorage.setItem(auctionTermsStorageKey, "1");
      window.localStorage.setItem(auctionTermsRoomStorageKey, "1");
    } catch {}
    setAcceptedAuctionTerms(true);
    setShowAuctionTerms(false);
  };

  const cancelAuctionTerms = () => {
    setShowAuctionTerms(false);
    router.push("/market/auction");
  };

  const openAuctionTerms = () => {
    setAuctionTermsMode("info");
    setShowAuctionTerms(true);
  };

  const scrollMobileBidBoardToBottom = useCallback(() => {
    window.setTimeout(() => {
      if (!window.matchMedia("(max-width: 639px)").matches) return;

      const mobileBoard = mobileBidBoardRef.current;
      if (mobileBoard) {
        mobileBoard.scrollTo({
          top: mobileBoard.scrollHeight,
          behavior: "smooth",
        });
        return;
      }

      bidBoardEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }, 90);
  }, []);

  useEffect(() => {
    if (bids.length > 0) {
      scrollMobileBidBoardToBottom();
    }
  }, [bids.length, scrollMobileBidBoardToBottom]);

  const submitBid = async () => {
    if (submitting || !room) return;

    const numericAmount = Number(String(amount || "").replace(/[^\d.-]/g, ""));

    if (!Number.isFinite(numericAmount) || numericAmount < nextMinimumBid) {
      await nexoraAlert({
        title: "ราคาบิทต่ำเกินไป",
        message: `ห้องนี้ต้องบิทขั้นต่ำ ${formatBaht(nextMinimumBid)}`,
        tone: "warning",
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/market/auction/${encodeURIComponent(room.id)}/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: numericAmount,
          message,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.minimumBid
            ? `${data.error} ขั้นต่ำคือ ${formatBaht(Number(data.minimumBid))}`
            : data.error || "ส่งบิทไม่สำเร็จ"
        );
      }

      setMessage("");
      setAmount(String(data.nextMinimumBid || numericAmount + room.minBidStep));
      await fetchRoom();
      scrollMobileBidBoardToBottom();
    } catch (error) {
      await nexoraAlert({
        title: "ส่งบิทไม่สำเร็จ",
        message: String(error instanceof Error ? error.message : error),
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openAuctionDealChat = useCallback(
    (bid: AuctionFinalRank) => {
      if (!room) return;

      const dealId = `auction:${room.id}:${bid.bidderId || bid.id}`;
      const roomId = `deal:${dealId}`;
      window.dispatchEvent(
        new CustomEvent("nexora:open-floating-chat", {
          detail: {
            kind: "deal",
            auctionDeal: true,
            roomId,
            dealId,
            userId: bid.bidderId,
            userName: bid.bidderName,
            userImage: bid.bidderImage,
            dealCardName: room.cardName,
            dealCardImage: room.imageUrl,
            dealCardNo: room.cardNo,
            dealPrice: bid.amount,
            dealMode: "sell",
          },
        })
      );
    },
    [room]
  );

  const confirmAuctionWinner = async (bid: AuctionFinalRank) => {
    if (!room || confirmingWinnerId) return;

    const confirmed = await nexoraConfirm({
      title: "ยืนยันผู้ชนะ",
      message: `ยืนยันว่า ${bid.bidderName} ติดต่อซื้อขายการ์ดกับเจ้าของห้องเรียบร้อยแล้วใช่ไหม? หลังจากยืนยัน ห้องจะเข้าสถานะปิดประมูลสมบูรณ์`,
      confirmText: "ยืนยันผู้ชนะ",
      cancelText: "ยกเลิก",
      tone: "success",
    });

    if (!confirmed) return;

    try {
      setConfirmingWinnerId(bid.bidderId || bid.id);
      const res = await fetch(
        `/api/market/auction/${encodeURIComponent(room.id)}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            winnerId: bid.bidderId,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "ยืนยันผู้ชนะไม่สำเร็จ");
      }

      await fetchRoom();
      notifyAuctionRoomsChanged({ action: "updated", roomId: room.id });
      await nexoraAlert({
        title: "ยืนยันผู้ชนะแล้ว",
        message:
          "ห้องนี้ถูกปิดการประมูลสมบูรณ์ และเจ้าของห้องสามารถลบห้องได้เมื่อพร้อม",
        tone: "success",
      });
    } catch (error) {
      await nexoraAlert({
        title: "ยืนยันผู้ชนะไม่สำเร็จ",
        message: String(error instanceof Error ? error.message : error),
        tone: "danger",
      });
    } finally {
      setConfirmingWinnerId("");
    }
  };

  const deleteCurrentRoom = async () => {
    if (!room || !roomCanDelete || deletingRoom) return;

    const confirmed = await nexoraConfirm({
      title: "ลบห้องประมูล",
      message: `ยืนยันการลบห้องประมูล ${room.cardName} ใช่ไหม? ข้อมูลบิททั้งหมดในห้องนี้จะถูกลบออกจากระบบด้วย`,
      tone: "danger",
      confirmText: "ยืนยันการลบ",
      cancelText: "ยกเลิก",
    });

    if (!confirmed) return;

    try {
      setDeletingRoom(true);
      const res = await fetch(`/api/market/auction/${encodeURIComponent(room.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "ลบห้องประมูลไม่สำเร็จ");
      }

      await nexoraAlert({
        title: "ลบห้องประมูลแล้ว",
        message: "ห้องประมูลนี้ถูกลบออกจากระบบเรียบร้อย",
        tone: "success",
      });
      markAuctionRoomDeleted(room.id);
      notifyAuctionRoomsChanged({ action: "deleted", roomId: room.id });
      router.push("/market/auction");
    } catch (error) {
      await nexoraAlert({
        title: "ลบห้องประมูลไม่สำเร็จ",
        message: String(error instanceof Error ? error.message : error),
        tone: "danger",
      });
    } finally {
      setDeletingRoom(false);
    }
  };

  if (loading && !room) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] bg-black text-amber-200">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-black p-8 text-center text-white">
        ไม่พบห้องประมูลนี้
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,#241806_0%,#080706_48%,#020202_100%)] text-white">
      <AuctionFireworks active={phase === "ended"} />
      <div className="relative z-10 mx-auto max-w-7xl space-y-5 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 md:pb-4 xl:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/market/auction"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-amber-200/16 bg-black/38 px-4 text-sm font-black text-amber-100"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับสนามประมูล
          </Link>
          <div className="inline-flex min-h-[46px] items-center rounded-2xl border border-amber-200/30 bg-[linear-gradient(135deg,#fff1a8,#f6c453_52%,#9c650c)] px-4 text-sm font-black text-black shadow-[0_0_26px_rgba(251,191,36,0.24)]">
            ห้อง {formatAuctionRoomNumber(room.roomNumber)}
          </div>
          <button
            type="button"
            onClick={openAuctionTerms}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-amber-200/24 bg-black/44 px-4 text-sm font-black text-amber-100 shadow-[0_0_26px_rgba(251,191,36,0.12)] transition hover:border-amber-200/42 hover:bg-amber-300/10"
          >
            <ScrollText className="h-4 w-4" />
            เงื่อนไขการประมูล
          </button>
          <div className="flex items-center gap-2">
            {roomCanDelete ? (
              <button
                type="button"
                onClick={() => void deleteCurrentRoom()}
                disabled={deletingRoom}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-red-200/22 bg-red-500/14 px-3 text-sm font-black text-red-100 shadow-[0_14px_38px_rgba(127,29,29,0.24)] transition hover:bg-red-500/24 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
              >
                {deletingRoom ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">ลบห้อง</span>
              </button>
            ) : null}
            <div className="rounded-full border border-amber-200/16 bg-amber-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
              {phase === "live" ? "LIVE AUCTION" : phase === "scheduled" ? "COMING SOON" : "ENDED"}
            </div>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-amber-200/18 bg-[linear-gradient(135deg,rgba(255,224,138,0.13),rgba(255,255,255,0.045)_34%,rgba(0,0,0,0.42))] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.52)] sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_32%,rgba(251,191,36,0.32),transparent_28%),radial-gradient(circle_at_75%_10%,rgba(255,255,255,0.10),transparent_20%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div className="relative">
              <div className="absolute inset-6 rounded-full bg-amber-300/18 blur-3xl" />
              <SafeCardImage
                cardNo={room.cardNo}
                imageUrl={room.imageUrl}
                alt={room.cardName}
                loading="eager"
                fetchPriority="high"
                className="relative z-10 mx-auto aspect-[3/4] w-full max-w-[320px] rounded-[28px] object-contain shadow-[0_0_90px_rgba(251,191,36,0.28)] sm:max-w-[380px]"
              />
            </div>

            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/24 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">
                <Gavel className="h-4 w-4" />
                Auction Room
              </div>
              <h1 className="mt-4 break-words text-3xl font-black leading-tight text-amber-50 sm:text-5xl">
                {room.cardName}
              </h1>
              <div className="mt-2 text-sm font-bold text-white/46">
                No.{room.cardNo} • {room.rarity}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/34">
                    ราคาเปิด
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">
                    {formatBaht(room.openingPrice)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-amber-200/18 bg-amber-300/10 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/58">
                    ราคาสูงสุด
                  </div>
                  <div className="mt-2 text-2xl font-black text-amber-200">
                    {formatBaht(room.topBid || room.openingPrice)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/34">
                    บิทถัดไป
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">
                    {formatBaht(nextMinimumBid)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm font-bold text-white/58 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/28 p-4">
                  เปิด {formatDateTime(room.startsAt)}
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/28 p-4">
                  ปิด {formatDateTime(room.endsAt)}
                </div>
              </div>

              <Link
                href={getProfileHref(room.sellerId)}
                className="mt-5 flex items-center gap-3 rounded-[24px] border border-white/10 bg-black/28 p-4 transition hover:border-amber-200/28 hover:bg-amber-300/[0.06] focus:outline-none focus:ring-2 focus:ring-amber-300/24"
              >
                <img
                  src={room.sellerImage || "/default-avatar.png"}
                  alt={room.sellerName}
                  className="h-12 w-12 rounded-2xl object-cover ring-1 ring-amber-200/18"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/34">
                    เจ้าของห้อง
                  </div>
                  <div className="truncate text-sm font-black text-white">
                    {room.sellerName}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {phase === "ended" && confirmedWinner ? (
          <section className="rounded-[30px] border border-emerald-200/24 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(251,191,36,0.10),rgba(0,0,0,0.42))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/30 bg-emerald-400/16 text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,0.22)]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-100/70">
                    Auction Settled
                  </div>
                  <div className="mt-1 text-lg font-black leading-7 text-white sm:text-2xl">
                    ผู้ชนะได้ทำการติดต่อซื้อขายการ์ดกับเจ้าของห้องเป็นที่เรียบร้อยแล้ว
                  </div>
                  <div className="mt-1 truncate text-sm font-bold text-amber-100/72">
                    ผู้ชนะ: {confirmedWinner.bidderName} • {formatBaht(confirmedWinner.amount)}
                  </div>
                </div>
              </div>
              {roomCanDelete ? (
                <button
                  type="button"
                  onClick={() => void deleteCurrentRoom()}
                  disabled={deletingRoom}
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-red-200/26 bg-red-500/18 px-4 text-sm font-black text-red-50 shadow-[0_14px_42px_rgba(127,29,29,0.30)] transition hover:bg-red-500/28 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingRoom ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  ลบห้องประมูล
                </button>
              ) : null}
            </div>
          </section>
        ) : phase === "ended" && activeRank ? (
          <section className="rounded-[30px] border border-amber-200/24 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(255,255,255,0.055),rgba(0,0,0,0.42))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/34 bg-amber-300/16 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.24)]">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100/70">
                    Negotiation Window
                  </div>
                  <div className="mt-1 text-lg font-black leading-7 text-white sm:text-2xl">
                    อยู่ระหว่างดำเนินการซื้อขายภายใน{" "}
                    {formatRemaining(getAuctionRankRemainingMs(room, activeRankIndex))}
                  </div>
                  <div className="mt-1 truncate text-sm font-bold text-amber-100/72">
                    สิทธิ์ตอนนี้: TOP {activeRankIndex + 1} • {activeRank.bidderName} •{" "}
                    {formatBaht(activeRank.amount)}
                  </div>
                </div>
              </div>
              {isRoomOwner ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[340px]">
                  <button
                    type="button"
                    onClick={() => openAuctionDealChat(activeRank)}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/24 bg-white px-4 text-sm font-black text-black shadow-[0_14px_36px_rgba(255,255,255,0.12)] transition hover:bg-amber-50"
                  >
                    <Handshake className="h-4 w-4 text-amber-700" />
                    ห้องแชทซื้อขาย
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmAuctionWinner(activeRank)}
                    disabled={Boolean(confirmingWinnerId)}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#fff1a8,#f6c453_52%,#a36b12)] px-4 text-sm font-black text-black shadow-[0_0_34px_rgba(251,191,36,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmingWinnerId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    ยืนยันผู้ชนะ
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {phase === "ended" && finalRanking.length > 0 ? (
          <section className="overflow-hidden rounded-[32px] border border-amber-200/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(0,0,0,0.42))] p-4 shadow-[0_28px_110px_rgba(0,0,0,0.48)] sm:p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/60">
                  Final Ranking
                </div>
                <h2 className="mt-1 text-2xl font-black text-amber-50 sm:text-3xl">
                  สรุปอันดับผู้ประมูลหลังปิดห้อง
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-white/54">
                  อันดับนี้คำนวณจากราคาบิทล่าสุดของผู้ประมูลแต่ละไอดี แล้วเรียงจากราคาสูงสุดลงต่ำสุด กดที่รายชื่อเพื่อไปหน้าโปรไฟล์ได้ทันที
                </p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/24 bg-amber-300/12 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-amber-100">
                <Trophy className="h-4 w-4" />
                {finalRanking.length} bidders
              </div>
            </div>

            {room.confirmedWinnerId && confirmedWinner ? (
              <div className="mt-5 rounded-[24px] border border-emerald-200/24 bg-emerald-400/10 p-4 text-sm font-black leading-6 text-emerald-50">
                ผู้ชนะได้ทำการติดต่อซื้อขายการ์ดกับเจ้าของห้องเป็นที่เรียบร้อยแล้ว •{" "}
                {confirmedWinner.bidderName} • {formatBaht(confirmedWinner.amount)}
              </div>
            ) : activeRank ? (
              <div className="mt-5 rounded-[24px] border border-amber-200/28 bg-amber-300/12 p-4 text-sm font-black leading-6 text-amber-50 shadow-[0_0_34px_rgba(251,191,36,0.12)]">
                อยู่ระหว่างดำเนินการซื้อขายภายใน{" "}
                {formatRemaining(getAuctionRankRemainingMs(room, activeRankIndex))} •
                สิทธิ์ตอนนี้ TOP {activeRankIndex + 1} {activeRank.bidderName} •{" "}
                {formatBaht(activeRank.amount)}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {finalRanking.map((bid, index) => (
                <Link
                  key={`${bid.bidderId || bid.bidderName}-${bid.id}`}
                  href={getProfileHref(bid.bidderId)}
                  className="group flex items-center gap-3 rounded-[24px] border border-white/10 bg-black/32 p-3 transition hover:border-amber-200/36 hover:bg-amber-300/[0.08] focus:outline-none focus:ring-2 focus:ring-amber-300/24 sm:p-4"
                >
                  <div
                    className={`flex h-12 w-16 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${
                      index === 0
                        ? "border-amber-200/40 bg-[linear-gradient(135deg,#fff1a8,#d89a14)] text-black shadow-[0_0_30px_rgba(251,191,36,0.28)]"
                        : "border-white/10 bg-white/[0.045] text-amber-100"
                    }`}
                  >
                    TOP {index + 1}
                  </div>
                  <img
                    src={bid.bidderImage || "/default-avatar.png"}
                    alt={bid.bidderName}
                    className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-white/10 transition group-hover:ring-amber-200/40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white group-hover:text-amber-100">
                      {bid.bidderName}
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-white/38">
                      บิทล่าสุด {formatTime(bid.createdAt)} • รวม {bid.bidTotal} ครั้ง
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-amber-200/18 bg-amber-300/10 px-3 py-2 text-base font-black text-amber-100 sm:text-xl">
                    {formatBaht(bid.amount)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-[30px] border border-white/10 bg-black/32 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.32)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-200/54">
                  Bid Board
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">
                  กระดานบิทของห้อง
                </h2>
              </div>
              <Trophy className="h-7 w-7 text-amber-300" />
            </div>

            {topBid ? (
              <div className="mt-5 rounded-[26px] border border-amber-200/22 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(0,0,0,0.25))] p-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-6 w-6 text-amber-200" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-100/58">
                      Leading Bid
                    </div>
                    <div className="mt-1 text-3xl font-black text-amber-100">
                      {formatBaht(topBid.amount)}
                    </div>
                    <Link
                      href={getProfileHref(topBid.bidderId)}
                      className="mt-1 block truncate text-sm font-bold text-white/54 transition hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/24"
                    >
                      {topBid.bidderName} • {formatTime(topBid.createdAt)}
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              ref={mobileBidBoardRef}
              className="mt-5 flex max-h-[58vh] flex-col gap-3 overflow-y-auto overscroll-contain pr-1 scroll-smooth sm:max-h-none sm:flex-col-reverse sm:overflow-visible sm:pr-0"
            >
              {bids.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-[26px] border border-dashed border-white/12 bg-white/[0.025] px-4 text-center text-sm font-bold leading-6 text-white/42">
                  ยังไม่มีใครบิท เป็นคนแรกที่เปิดกระดานนี้ได้เลย
                </div>
              ) : (
                bids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-4"
                  >
                    <div className="flex gap-3">
                      <Link
                        href={getProfileHref(bid.bidderId)}
                        className="h-11 w-11 shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-300/24"
                      >
                        <img
                          src={bid.bidderImage || "/default-avatar.png"}
                          alt={bid.bidderName}
                          className="h-full w-full rounded-2xl object-cover ring-1 ring-white/10 transition hover:ring-amber-200/40"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={getProfileHref(bid.bidderId)}
                              className="block truncate text-sm font-black text-white transition hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/24"
                            >
                              {bid.bidderName}
                            </Link>
                            <div className="text-[11px] font-bold text-white/34">
                              ลำดับที่ {index + 1} • {formatTime(bid.createdAt)}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-2xl border border-amber-200/18 bg-amber-300/10 px-3 py-2 text-xl font-black text-amber-100">
                            {formatBaht(bid.amount)}
                          </div>
                        </div>
                        {bid.message ? (
                          <div className="mt-3 rounded-2xl bg-black/26 p-3 text-sm font-semibold leading-6 text-white/68">
                            {bid.message}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bidBoardEndRef} aria-hidden="true" className="h-1" />
            </div>
          </div>

          <aside className="rounded-[30px] border border-amber-200/14 bg-black/38 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.34)] sm:p-5 xl:sticky xl:top-5 xl:self-start">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fff0a8,#d59a21)] text-black">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-200/54">
                  Place Bid
                </div>
                <h2 className="text-xl font-black text-white">ส่งราคาบิท</h2>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-white/72">
                <Clock className="h-4 w-4 text-amber-300" />
                {phase === "scheduled"
                  ? `เริ่มใน ${getTimeLeftLabel(room)}`
                  : phase === "live"
                    ? `เหลือ ${getTimeLeftLabel(room)}`
                    : "ปิดประมูลแล้ว"}
              </div>
              <div className="mt-2 text-xs font-bold leading-5 text-white/42">
                ขั้นต่ำครั้งถัดไปคือ {formatBaht(nextMinimumBid)}
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-white/72">
                  ราคาบิท
                </span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder={String(nextMinimumBid)}
                  disabled={!canBid || submitting}
                  className="min-h-[56px] w-full rounded-[20px] border border-white/10 bg-white/[0.04] px-4 text-2xl font-black text-amber-100 outline-none placeholder:text-white/25 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12 disabled:opacity-45"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-white/72">
                  ข้อความสนุก ๆ
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="จะพิมพ์หรือไม่พิมพ์ก็ได้"
                  maxLength={180}
                  disabled={!canBid || submitting}
                  className="min-h-[112px] w-full resize-none rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/25 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/12 disabled:opacity-45"
                />
              </label>

              <button
                type="button"
                onClick={submitBid}
                disabled={!canBid || submitting}
                className="min-h-[56px] rounded-[22px] bg-[linear-gradient(135deg,#fff5bd,#f7c84d_50%,#9c650c)] px-5 text-base font-black text-black shadow-[0_0_42px_rgba(247,200,77,0.28)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังส่งบิท
                  </span>
                ) : phase === "live" ? (
                  "ยืนยันส่งข้อมูล"
                ) : phase === "scheduled" ? (
                  "ยังไม่ถึงเวลาเปิด"
                ) : (
                  "ห้องปิดแล้ว"
                )}
              </button>
            </div>
          </aside>
        </section>
      </div>

      {!acceptedRules ? <RuleOverlay onAccept={acceptRules} /> : null}
      {acceptedRules && showAuctionTerms ? (
        <AuctionTermsOverlay
          mode={auctionTermsMode}
          onAccept={acceptAuctionTerms}
          onCancel={cancelAuctionTerms}
          onClose={() => setShowAuctionTerms(false)}
        />
      ) : null}
    </div>
  );
}
