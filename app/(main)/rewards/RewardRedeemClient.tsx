"use client";

import { useState } from "react";
import { Noto_Sans_Thai, Sora } from "next/font/google";
import { ShieldCheck, Gift, Gem, Coins } from "lucide-react";

const thaiSans = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-reward-thai",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-reward-display",
  weight: ["400", "600", "700", "800"],
});

type Reward = {
  id: string;
  name: string;
  stock: number;
  imageUrl?: string | null;
  nexCost?: number | null;
  coinCost?: number | null;
};

const REWARD_IMAGE_FALLBACK = "/avatar.png";

export default function RewardRedeemClient({
  user,
  rewards,
}: {
  user: {
  lineId: string;
  nexPoint: number;
  coin: number;
  name: string;
  image?: string;
};
  rewards: Reward[];
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleRedeem = async (
    rewardId: string,
    currency: "NEX" | "COIN"
  ) => {
    try {
      const key = `${rewardId}-${currency}`;
      setLoadingKey(key);

      const res = await fetch("/api/reward/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineId: user.lineId,
          rewardId,
          currency,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "แลกไม่สำเร็จ");
        return;
      }

      window.location.href = data.couponUrl;
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div
      className={`${thaiSans.variable} ${sora.variable} min-h-screen bg-[radial-gradient(circle_at_top,#1d1440_0%,#090b12_45%,#04060b_100%)] text-white`}
    >
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
        {/* HERO */}
        <div className="overflow-hidden rounded-[28px] border border-cyan-400/10 bg-white/[0.03] p-4 shadow-[0_20px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:rounded-[42px] md:p-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-2xl bg-cyan-400/10 p-3 md:rounded-3xl md:p-4">
              <Gift className="h-6 w-6 text-cyan-300 md:h-8 md:w-8" />
            </div>

            <div>
              <h1 className="font-[family:var(--font-reward-display)] text-2xl font-black tracking-tight md:text-5xl">
                NEXORA REWARD CENTER
              </h1>
              <p className="mt-1 font-[family:var(--font-reward-thai)] text-[11px] text-white/50 md:mt-2 md:text-sm">
                Dual currency reward exchange system
              </p>
            </div>
          </div>

          {/* MOBILE = 2 compact balance cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:mt-8 md:gap-4 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-[28px] border border-black/8 bg-[linear-gradient(145deg,#ffffff_0%,#f8f1de_48%,#eef3ff_100%)] p-4 text-[#111111] shadow-[0_24px_60px_rgba(12,12,18,0.18)] ring-1 ring-white/70 md:rounded-[32px] md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.18),transparent_38%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="font-[family:var(--font-reward-display)] text-[10px] uppercase tracking-[0.34em] text-black/46 md:text-xs">
                    NEX
                  </div>
                  <div className="mt-2 font-[family:var(--font-reward-display)] text-2xl font-extrabold tracking-[-0.05em] text-black md:text-5xl">
                    {user.nexPoint.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-300/35 bg-white/70 p-2.5 text-amber-500 shadow-[0_14px_28px_rgba(250,204,21,0.16)] md:p-3">
                  <Gem className="h-4 w-4 md:h-5 md:w-5" />
                </div>
              </div>
              <div className="relative mt-2 font-[family:var(--font-reward-display)] text-[11px] font-bold uppercase tracking-[0.24em] text-black/58 md:text-xs">
                READY BALANCE
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-black/8 bg-[linear-gradient(145deg,#ffffff_0%,#f3f7ff_44%,#ecfbf4_100%)] p-4 text-[#111111] shadow-[0_24px_60px_rgba(12,12,18,0.18)] ring-1 ring-white/70 md:rounded-[32px] md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.94),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_40%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="font-[family:var(--font-reward-display)] text-[10px] uppercase tracking-[0.34em] text-black/46 md:text-xs">
                    COIN
                  </div>
                  <div className="mt-2 font-[family:var(--font-reward-display)] text-2xl font-extrabold tracking-[-0.05em] text-black md:text-5xl">
                    {user.coin.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-300/35 bg-white/70 p-2.5 text-cyan-500 shadow-[0_14px_28px_rgba(34,211,238,0.16)] md:p-3">
                  <Coins className="h-4 w-4 md:h-5 md:w-5" />
                </div>
              </div>
              <div className="relative mt-2 font-[family:var(--font-reward-display)] text-[11px] font-bold uppercase tracking-[0.24em] text-black/58 md:text-xs">
                READY BALANCE
              </div>
            </div>
          </div>
        </div>

        {/* REWARD GRID */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:mt-10 md:gap-6 xl:grid-cols-3">
          {rewards.map((reward) => {
            const canNex =
              reward.nexCost != null &&
              user.nexPoint >= reward.nexCost &&
              reward.stock > 0;

            const canCoin =
              reward.coinCost != null &&
              user.coin >= reward.coinCost &&
              reward.stock > 0;

            return (
              <div
                key={reward.id}
                className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-3 shadow-[0_10px_60px_rgba(0,0,0,0.35)] transition duration-500 hover:border-cyan-400/30 md:rounded-[32px] md:p-5 md:hover:-translate-y-2"
              >
                {/* IMAGE */}
                <div className="relative mb-4 flex h-40 items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-white/[0.03] to-cyan-400/[0.04] md:mb-5 md:h-56 md:rounded-[28px]">
                  <img
                    src={
                      reward.imageUrl ||
                      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"
                    }
                    alt={reward.name}
                    className="h-full w-full object-contain p-2 transition duration-700 group-hover:scale-110 md:p-3"
                    onError={(event) => {
                      event.currentTarget.src = REWARD_IMAGE_FALLBACK;
                    }}
                  />
                </div>

                {/* HEADER */}
                <div className="mb-3 flex items-start justify-between gap-3 md:mb-4 md:gap-4">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-lg font-black leading-tight md:text-3xl">
                      {reward.name}
                    </h2>
                    <div className="mt-1 text-[10px] text-white/40 md:mt-2 md:text-xs">
                      Multi Currency Reward
                    </div>
                  </div>

                  <div className="shrink-0 rounded-xl bg-cyan-400/10 px-3 py-2 text-[10px] font-black text-cyan-300 md:rounded-2xl md:px-4 md:text-xs">
                    {reward.stock}
                  </div>
                </div>

                {/* PRICE */}
                <div className="space-y-2 md:space-y-3">
                  {reward.nexCost != null && (
                    <div className="rounded-2xl bg-amber-400/10 p-3 md:rounded-3xl md:p-4">
                      <div className="mb-1 flex items-center gap-2 text-[10px] text-white/40 md:text-xs">
                        <Gem className="h-3.5 w-3.5" />
                        NEX COST
                      </div>
                      <div className="text-2xl font-black text-amber-300 md:text-4xl">
                        {reward.nexCost.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {reward.coinCost != null && (
                    <div className="rounded-2xl bg-emerald-400/10 p-3 md:rounded-3xl md:p-4">
                      <div className="mb-1 flex items-center gap-2 text-[10px] text-white/40 md:text-xs">
                        <Coins className="h-3.5 w-3.5" />
                        COIN COST
                      </div>
                      <div className="text-2xl font-black text-emerald-300 md:text-3xl">
                        {reward.coinCost.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* BUTTONS */}
                <div className="mt-4 space-y-2 md:mt-5 md:space-y-3">
                  {reward.nexCost != null && (
                    <button
                      onClick={() => handleRedeem(reward.id, "NEX")}
                      disabled={
                        !canNex || loadingKey === `${reward.id}-NEX`
                      }
                      className={`w-full rounded-2xl px-4 py-3 text-xs font-black transition md:px-5 md:py-4 md:text-sm ${
                        canNex
                          ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-black"
                          : "bg-white/[0.05] text-white/30"
                      }`}
                    >
                      {loadingKey === `${reward.id}-NEX`
                        ? "กำลังแลก NEX..."
                        : "REDEEM WITH NEX"}
                    </button>
                  )}

                  {reward.coinCost != null && (
                    <button
                      onClick={() => handleRedeem(reward.id, "COIN")}
                      disabled={
                        !canCoin || loadingKey === `${reward.id}-COIN`
                      }
                      className={`w-full rounded-2xl px-4 py-3 text-xs font-black transition md:px-5 md:py-4 md:text-sm ${
                        canCoin
                          ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-black"
                          : "bg-white/[0.05] text-white/30"
                      }`}
                    >
                      {loadingKey === `${reward.id}-COIN`
                        ? "กำลังแลก COIN..."
                        : "REDEEM WITH COIN"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="mt-6 rounded-[22px] bg-emerald-400/10 p-4 text-xs text-emerald-300 shadow-xl md:mt-8 md:rounded-[28px] md:p-5 md:text-sm">
          <ShieldCheck className="mr-2 inline h-4 w-4" />
          Reward → Coupon QR → Dual currency synchronized
        </div>
      </div>
    </div>
  );
}
