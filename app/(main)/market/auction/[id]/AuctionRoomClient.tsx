"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Crown,
  Gavel,
  Loader2,
  Send,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import { nexoraAlert } from "@/lib/nexora-dialog";

type AuctionRoom = {
  id: string;
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

function formatBaht(value: number) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
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

function RuleOverlay({ onAccept }: { onAccept: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="กฎก่อนประมูล"
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/78 px-4 py-6 backdrop-blur-xl"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-amber-300/24 bg-[radial-gradient(circle_at_top,#2a2110_0%,#100e0a_48%,#050505_100%)] p-5 text-white shadow-[0_35px_130px_rgba(0,0,0,0.72)] sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-300/14 text-amber-200">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-200/70">
              Auction Rule
            </div>
            <h2 className="mt-2 text-2xl font-black leading-tight text-amber-100 sm:text-3xl">
              กฎเหล็กก่อนประมูล
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 text-sm font-bold leading-6 text-white/78">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            ราคาบิทต้องสูงกว่าราคาปัจจุบันอย่างน้อยตามบิทขั้นต่ำของห้องนี้เสมอ
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            ผู้ชนะต้องกดยืนยันภายใน 24 ชั่วโมงหลังปิดประมูล ถ้าไม่รับสิทธิ์จะถูกแบนจากสนามประมูลถาวร
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            หากอันดับหนึ่งไม่รับ สิทธิ์จะเลื่อนไปอันดับสองและอันดับถัดไปตามลำดับ
          </div>
        </div>

        <button
          type="button"
          onClick={onAccept}
          className="mt-6 min-h-[54px] w-full rounded-2xl bg-[linear-gradient(135deg,#fff0a8,#f6c453_48%,#a36b12)] px-4 text-sm font-black text-black shadow-[0_0_36px_rgba(246,196,83,0.28)]"
        >
          เข้าใจแล้ว เริ่มดูห้องประมูล
        </button>
      </div>
    </div>
  );
}

export default function AuctionRoomClient({ roomId }: { roomId: string }) {
  const [payload, setPayload] = useState<AuctionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(true);

  const room = payload?.room || null;
  const bids = payload?.bids || [];
  const phase = getRoomPhase(room);
  const topBid = useMemo(
    () =>
      bids.reduce<AuctionBid | null>(
        (best, bid) => (!best || bid.amount > best.amount ? bid : best),
        null
      ),
    [bids]
  );
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
    <div className="min-h-full overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,#241806_0%,#080706_48%,#020202_100%)] text-white">
      <div className="mx-auto max-w-7xl space-y-5 px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 md:pb-4 xl:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/market/auction"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-amber-200/16 bg-black/38 px-4 text-sm font-black text-amber-100"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับสนามประมูล
          </Link>
          <div className="rounded-full border border-amber-200/16 bg-amber-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
            {phase === "live" ? "LIVE AUCTION" : phase === "scheduled" ? "COMING SOON" : "ENDED"}
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

              <div className="mt-5 flex items-center gap-3 rounded-[24px] border border-white/10 bg-black/28 p-4">
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
              </div>
            </div>
          </div>
        </section>

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
                    <div className="mt-1 truncate text-sm font-bold text-white/54">
                      {topBid.bidderName} • {formatTime(topBid.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
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
                      <img
                        src={bid.bidderImage || "/default-avatar.png"}
                        alt={bid.bidderName}
                        className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">
                              {bid.bidderName}
                            </div>
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
    </div>
  );
}
