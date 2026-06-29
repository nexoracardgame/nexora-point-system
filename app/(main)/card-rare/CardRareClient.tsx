"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Gem,
  Loader2,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";

type CardRareOption = {
  key: string;
  label: string;
  conditionLabel: string | null;
  nexValue: number;
};

type CardRareItem = {
  cardNo: string;
  cardName: string;
  tier: string;
  imageUrl: string;
  options: CardRareOption[];
  maxNexValue: number;
  priorityImage: boolean;
};

type Redemption = {
  id: string;
  code: string;
  cardNo: string;
  cardName: string;
  rewardLabel: string;
  optionKey: string;
  conditionLabel: string | null;
  nexValue: number;
  imageUrl: string;
  status: "pending" | "approved" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
  statusLabel: string;
  valueLabel: string;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatRemaining(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CardRareClient({
  rewards,
}: {
  rewards: CardRareItem[];
}) {
  const [query, setQuery] = useState("");
  const [confirmCard, setConfirmCard] = useState<CardRareItem | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState("standard");
  const [active, setActive] = useState<Redemption | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingCardNo, setLoadingCardNo] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const syncActive = useCallback(async () => {
    try {
      const res = await fetch(`/api/card-rare-redemptions?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const nextActive = (data?.active || null) as Redemption | null;
      setActive(nextActive);
      if (nextActive) setModalOpen(true);
    } catch {
      return;
    }
  }, []);

  const syncRedemption = useCallback(async (code: string) => {
    try {
      const res = await fetch(
        `/api/card-rare-redemptions/${encodeURIComponent(code)}?ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.redemption) setActive(data.redemption);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void syncActive();
  }, [syncActive]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!active || active.status !== "pending") return;
    const interval = window.setInterval(() => {
      void syncRedemption(active.code);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [active, syncRedemption]);

  useEffect(() => {
    const remainingImages = rewards
      .filter((reward) => !reward.priorityImage)
      .map((reward) => reward.imageUrl);

    const preload = () => {
      remainingImages.forEach((src) => {
        const image = new window.Image();
        image.decoding = "async";
        image.loading = "eager";
        image.src = src;
      });
    };

    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(preload, { timeout: 2200 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preload, 700);
    return () => window.clearTimeout(timeoutId);
  }, [rewards]);

  const filteredRewards = useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return rewards;

    return rewards.filter((reward) =>
      [
        reward.cardNo,
        `no ${reward.cardNo}`,
        reward.cardName,
        reward.tier,
        ...reward.options.map((option) => option.label),
      ]
        .map(normalize)
        .some((field) => field.includes(keyword))
    );
  }, [query, rewards]);

  const remainingMs = active
    ? new Date(active.expiresAt).getTime() - now
    : 0;
  const isPending = active?.status === "pending" && remainingMs > 0;
  const completed = active?.status === "approved";

  const createRedemption = async (reward: CardRareItem) => {
    try {
      setLoadingCardNo(reward.cardNo);
      setError("");

      const res = await fetch("/api/card-rare-redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNo: reward.cardNo,
          optionKey: reward.options.some(
            (option) => option.key === selectedOptionKey
          )
            ? selectedOptionKey
            : reward.options[0]?.key || "standard",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(String(data?.error || "สร้าง QR ไม่สำเร็จ"));
        return;
      }

      setActive(data?.active || null);
      setModalOpen(Boolean(data?.active));
      setConfirmCard(null);
      setSelectedOptionKey("standard");
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างสร้าง QR");
    } finally {
      setLoadingCardNo("");
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(168,85,247,0.22),transparent_28%),radial-gradient(circle_at_100%_70%,rgba(236,72,153,0.12),transparent_24%),linear-gradient(180deg,#0b0b10_0%,#050507_100%)]" />

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] p-4 shadow-[0_32px_120px_rgba(0,0,0,0.48)] sm:rounded-[42px] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/rewards"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/82 transition hover:border-violet-300/30 hover:text-violet-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Rewards
            </Link>
            <div className="rounded-full border border-violet-300/22 bg-violet-300/10 px-4 py-2 text-xs font-black text-violet-100">
              {formatNumber(rewards.length)} CARD RARE
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white/48 ring-1 ring-white/8">
              <Star className="h-3.5 w-3.5 text-violet-300" />
              Single Card Rewards
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] sm:text-6xl">
              CARD RARE
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-6 text-white/55 sm:text-base">
              เลือกใบแรร์ที่นำการ์ดจริงมาแลกที่หน้าร้าน แล้วให้พนักงานสแกน QR ภายใน 1 ชั่วโมง
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-3xl rounded-[30px] bg-black p-2 ring-1 ring-white/10">
            <div className="flex min-h-[66px] items-center gap-3 px-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black">
                <Search className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/38">
                  Search Card Rare
                </div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาเลขการ์ดหรือชื่อการ์ด"
                  className="mt-1 w-full bg-transparent text-lg font-black outline-none placeholder:text-white/38"
                />
              </div>
            </div>
          </div>
        </section>

        {active && !modalOpen ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="sticky top-3 z-40 mt-4 flex w-full items-center justify-between gap-3 rounded-[24px] border border-violet-300/24 bg-[#121016]/95 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
          >
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.22em] text-violet-100">
                Active Card Rare QR
              </span>
              <span className="mt-1 block text-sm font-bold text-white/70">
                #{active.cardNo} {active.cardName}
              </span>
            </span>
            <span className="rounded-full bg-violet-300 px-3 py-1 text-xs font-black text-black">
              {isPending ? formatRemaining(remainingMs) : active.statusLabel}
            </span>
          </button>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[24px] border border-red-400/18 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filteredRewards.map((reward) => (
            <article
              key={reward.cardNo}
              className="group overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.34)] transition duration-500 hover:-translate-y-1 hover:border-violet-300/30"
            >
              <div className="relative overflow-hidden rounded-[24px] bg-white/[0.04] ring-1 ring-white/8">
                <div className="absolute left-3 top-3 z-10 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/72">
                  No. {reward.cardNo}
                </div>
                <div className="absolute right-3 top-3 z-10 rounded-full bg-violet-300/14 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100 ring-1 ring-violet-300/18">
                  {reward.tier}
                </div>
                <div className="relative aspect-[0.72]">
                  <img
                    src={reward.imageUrl}
                    alt={reward.cardName}
                    loading={reward.priorityImage ? "eager" : "lazy"}
                    fetchPriority={reward.priorityImage ? "high" : "auto"}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-contain object-center p-4 transition duration-500 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.src = "/avatar.png";
                    }}
                  />
                </div>
              </div>

              <div className="px-1 pt-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/52 ring-1 ring-white/8">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  {reward.options.length > 1 ? `${reward.options.length} options` : "Rare Drop"}
                </div>
                <h2 className="mt-3 line-clamp-2 min-h-[3.25rem] text-xl font-black leading-tight">
                  {reward.cardName}
                </h2>

                <div className="mt-4 rounded-[22px] bg-white px-4 py-4 text-black">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/38">
                    <Gem className="h-3.5 w-3.5 text-violet-500" />
                    Reward Value
                  </div>
                  <div className="mt-2 text-xl font-black tracking-[-0.04em]">
                    {formatNumber(reward.maxNexValue)} NEX
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedOptionKey(reward.options[0]?.key || "standard");
                    setConfirmCard(reward);
                  }}
                  disabled={Boolean(loadingCardNo) || Boolean(active && isPending)}
                  className="mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#f5d0fe,#a855f7,#6d28d9)] px-4 py-3 text-sm font-black text-white shadow-[0_0_28px_rgba(168,85,247,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" />
                  แลกเปลี่ยนเป็นรางวัล
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {confirmCard ? (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center overflow-y-auto bg-black/72 p-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] pt-[calc(12px_+_env(safe-area-inset-top))] backdrop-blur-xl sm:items-center">
          <div className="max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-lg overflow-y-auto rounded-[30px] border border-white/12 bg-[#101016] p-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.62)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-violet-200">
                  Confirm Card Rare
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  ยืนยันการแลกการ์ด No. {confirmCard.cardNo}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmCard(null)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-[24px] bg-white p-4 text-black">
              <div className="text-xl font-black">{confirmCard.cardName}</div>
              <div className="mt-1 text-sm font-bold text-black/48">
                {confirmCard.tier} Rare Reward
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {confirmCard.options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedOptionKey(option.key)}
                  className={`flex w-full items-start gap-3 rounded-[24px] border p-4 text-left transition ${
                    selectedOptionKey === option.key
                      ? "border-violet-300/45 bg-violet-300/12 ring-1 ring-violet-300/18"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                      selectedOptionKey === option.key
                        ? "border-violet-300 bg-violet-300 text-black"
                        : "border-white/30"
                    }`}
                  >
                    {selectedOptionKey === option.key ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-white">
                      {option.label}
                    </span>
                    {option.conditionLabel ? (
                      <span className="mt-1 block text-xs font-bold text-violet-100/70">
                        {option.conditionLabel}
                      </span>
                    ) : null}
                    <span className="mt-2 inline-flex rounded-full bg-violet-300 px-3 py-1 text-xs font-black text-black">
                      {formatNumber(option.nexValue)} NEX
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void createRedemption(confirmCard)}
                disabled={Boolean(loadingCardNo)}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#f5d0fe,#a855f7,#6d28d9)] px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {loadingCardNo === confirmCard.cardNo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                แลกเปลี่ยนเป็นรางวัล
              </button>
              <button
                type="button"
                onClick={() => setConfirmCard(null)}
                className="min-h-[52px] rounded-[22px] border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {active && modalOpen ? (
        <div className="fixed inset-0 z-[5000] flex items-end justify-center overflow-y-auto bg-black/78 p-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] pt-[calc(12px_+_env(safe-area-inset-top))] backdrop-blur-xl sm:items-center">
          <div className="relative max-h-[calc(100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-xl overflow-y-auto rounded-[32px] border border-white/12 bg-[#101016] p-4 text-white shadow-[0_30px_120px_rgba(0,0,0,0.62)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-violet-200">
                  Card Rare Redemption
                </div>
                <h2 className="mt-2 break-words text-2xl font-black leading-tight sm:text-3xl">
                  No. {active.cardNo} {active.cardName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-violet-200/30 bg-black/70 text-white shadow-[0_0_30px_rgba(168,85,247,0.22)] ring-1 ring-white/10 backdrop-blur-xl transition active:scale-95"
                aria-label="Close QR"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div
              className={`mt-5 rounded-[28px] p-5 text-center ${
                completed
                  ? "bg-emerald-400 text-black"
                  : active.status === "cancelled" || active.status === "expired"
                    ? "bg-red-50 text-red-900"
                    : "bg-white text-black"
              }`}
            >
              {completed ? (
                <div className="grid place-items-center gap-3 py-8">
                  <CheckCircle2 className="h-16 w-16" />
                  <div className="text-3xl font-black">การแลกเสร็จสมบูรณ์</div>
                  <div className="text-sm font-bold opacity-70">
                    พนักงานอนุมัติรายการนี้แล้ว
                  </div>
                </div>
              ) : active.status === "cancelled" || active.status === "expired" ? (
                <div className="grid place-items-center gap-3 py-8">
                  <Clock3 className="h-16 w-16" />
                  <div className="text-3xl font-black">{active.statusLabel}</div>
                  <div className="text-sm font-bold opacity-70">
                    กรุณาสร้าง QR ใหม่เมื่อต้องการแลกอีกครั้ง
                  </div>
                </div>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    <QrCode className="h-3.5 w-3.5 text-violet-300" />
                    Staff Scan Only
                  </div>
                  <div className="mt-4 flex justify-center">
                    <div className="rounded-[24px] bg-white p-3 shadow-[0_16px_44px_rgba(0,0,0,0.14)] ring-1 ring-black/8">
                      <QRCodeCanvas value={active.code} size={210} />
                    </div>
                  </div>
                  <div className="mt-4 break-all rounded-[20px] bg-black px-4 py-3 text-sm font-black text-white">
                    {active.code}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-300 px-4 py-2 text-sm font-black text-black">
                    <Clock3 className="h-4 w-4" />
                    {formatRemaining(remainingMs)}
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  Reward
                </div>
                <div className="mt-2 text-sm font-black text-white/82">
                  {active.rewardLabel}
                </div>
                {active.conditionLabel ? (
                  <div className="mt-2 rounded-full bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100">
                    {active.conditionLabel}
                  </div>
                ) : null}
              </div>
              <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  Status
                </div>
                <div className="mt-2 text-lg font-black text-violet-100">
                  {active.statusLabel}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[22px] border border-white/12 bg-white/[0.06] px-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition active:scale-[0.99] sm:hidden"
            >
              <X className="h-4 w-4" />
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
