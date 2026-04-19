"use client";

import { useState } from "react";

type Currency = "NEX" | "COIN";

export default function RewardRedeemButtons({
  rewardId,
  rewardName,
  lineId,
  stock,
  userNexPoint,
  userCoin,
  nexCost,
  coinCost,
}: {
  rewardId: string;
  rewardName: string;
  lineId: string;
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
          lineId,
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
    <div className="space-y-3">
      {nexCost != null ? (
        <button
          type="button"
          onClick={() => void handleRedeem("NEX")}
          disabled={!canRedeemWithNex || loadingKey === `${rewardId}-NEX`}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition ${
            canRedeemWithNex
              ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-black hover:scale-[1.01]"
              : "bg-white/[0.05] text-white/30"
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
          className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition ${
            canRedeemWithCoin
              ? "bg-gradient-to-r from-cyan-400 to-emerald-300 text-black hover:scale-[1.01]"
              : "bg-white/[0.05] text-white/30"
          }`}
        >
          {loadingKey === `${rewardId}-COIN`
            ? `กำลังแลก ${rewardName}...`
            : "แลกด้วย COIN"}
        </button>
      ) : null}

      {error ? <div className="text-xs text-red-300">{error}</div> : null}
    </div>
  );
}
