"use client";

import { useState } from "react";

type Currency = "NEX" | "COIN";

export default function RewardRedeemButtons({
  rewardId,
  rewardName,
  stock,
  userNexPoint,
  userCoin,
  nexCost,
  coinCost,
}: {
  rewardId: string;
  rewardName: string;
  stock: number;
  userNexPoint: number;
  userCoin: number;
  nexCost?: number | null;
  coinCost?: number | null;
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canRedeemWithNex =
    nexCost != null && stock > 0 && userNexPoint >= Number(nexCost);
  const canRedeemWithCoin =
    coinCost != null && stock > 0 && userCoin >= Number(coinCost);

  const handleRedeem = async (currency: Currency) => {
    try {
      const key = `${rewardId}-${currency}`;
      setLoadingKey(key);
      setError("");

      const res = await fetch("/api/reward/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rewardId,
          currency,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(String(data?.error || "แลกรางวัลไม่สำเร็จ"));
        return;
      }

      if (data?.couponUrl) {
        window.location.href = String(data.couponUrl);
      }
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างแลกรางวัล");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {nexCost != null ? (
        <button
          type="button"
          onClick={() => void handleRedeem("NEX")}
          disabled={!canRedeemWithNex || loadingKey === `${rewardId}-NEX`}
          className={`w-full rounded-full px-4 py-4 text-sm font-black transition ${
            canRedeemWithNex
              ? "bg-[linear-gradient(135deg,#f7c948,#fff0a3)] text-black shadow-[0_18px_38px_rgba(247,201,72,0.18)] hover:scale-[1.01]"
              : "bg-white/[0.06] text-white/32 ring-1 ring-white/8"
          }`}
        >
          {loadingKey === `${rewardId}-NEX`
            ? `กำลังแลก ${rewardName}...`
            : "แลกด้วย NEX"}
        </button>
      ) : null}

      {coinCost != null ? (
        <button
          type="button"
          onClick={() => void handleRedeem("COIN")}
          disabled={!canRedeemWithCoin || loadingKey === `${rewardId}-COIN`}
          className={`w-full rounded-full px-4 py-4 text-sm font-black transition ${
            canRedeemWithCoin
              ? "bg-[linear-gradient(135deg,#ffffff,#d9dde5)] text-black shadow-[0_18px_38px_rgba(255,255,255,0.12)] hover:scale-[1.01]"
              : "bg-white/[0.06] text-white/32 ring-1 ring-white/8"
          }`}
        >
          {loadingKey === `${rewardId}-COIN`
            ? `กำลังแลก ${rewardName}...`
            : "แลกด้วย COIN"}
        </button>
      ) : null}

      {error ? (
        <div className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 ring-1 ring-red-300/15">
          {error}
        </div>
      ) : null}
    </div>
  );
}
