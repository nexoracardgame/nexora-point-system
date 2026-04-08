"use client";

import { useState } from "react";
import { ShieldCheck, Gift, Gem, Coins } from "lucide-react";

type Reward = {
  id: string;
  name: string;
  stock: number;
  imageUrl?: string | null;
  nexCost?: number | null;
  coinCost?: number | null;
};

export default function RewardRedeemClient({
  user,
  rewards,
}: {
  user: { lineId: string; nexPoint: number; coin: number; name: string };
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1d1440_0%,#090b12_45%,#04060b_100%)] text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
        {/* HERO */}
        <div className="rounded-[28px] border border-cyan-400/10 bg-white/[0.03] p-4 shadow-[0_20px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:rounded-[42px] md:p-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="rounded-2xl bg-cyan-400/10 p-3 md:rounded-3xl md:p-4">
              <Gift className="h-6 w-6 text-cyan-300 md:h-8 md:w-8" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-5xl">
                NEXORA REWARD CENTER
              </h1>
              <p className="mt-1 text-[11px] text-white/50 md:mt-2 md:text-sm">
                Dual currency reward exchange system
              </p>
            </div>
          </div>

          {/* MOBILE = 2 compact balance cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:mt-8 md:gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-amber-400/10 p-4 shadow-xl md:rounded-3xl md:p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 md:text-xs">
                NEX
              </div>
              <div className="mt-2 text-2xl font-black text-amber-300 md:text-5xl">
                {user.nexPoint.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-400/10 p-4 shadow-xl md:rounded-3xl md:p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 md:text-xs">
                COIN
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-300 md:text-5xl">
                {user.coin.toLocaleString()}
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