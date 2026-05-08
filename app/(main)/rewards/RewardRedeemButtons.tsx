"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CouponViewModel } from "@/components/CouponDetailCard";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
import { nexoraConfirm } from "@/lib/nexora-dialog";
import { trackUiFetch } from "@/lib/ui-activity";

type Currency = "NEX" | "COIN";
type RedeemCouponsCache = {
  coupons: CouponViewModel[];
  openCode: string;
};

function mergeCoupons(
  coupons: CouponViewModel[],
  nextCoupon: CouponViewModel
) {
  return [
    nextCoupon,
    ...coupons.filter(
      (coupon) => coupon.id !== nextCoupon.id && coupon.code !== nextCoupon.code
    ),
  ];
}

function formatAmount(value?: number | null) {
  return Number(value || 0).toLocaleString("th-TH");
}

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
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [confirmingCurrency, setConfirmingCurrency] = useState<Currency | null>(
    null
  );
  const [error, setError] = useState("");

  useEffect(() => {
    router.prefetch("/redeem");
  }, [router]);

  const busy = Boolean(loadingKey || confirmingCurrency);
  const canRedeemWithNex =
    nexCost != null && stock > 0 && userNexPoint >= Number(nexCost);
  const canRedeemWithCoin =
    coinCost != null && stock > 0 && userCoin >= Number(coinCost);

  const handleRedeem = async (currency: Currency) => {
    let navigatingToCoupon = false;

    try {
      const key = `${rewardId}-${currency}`;
      setLoadingKey(key);
      setError("");

      const res = await trackUiFetch("/api/reward/redeem", {
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

      if (data?.coupon) {
        const cached = readClientViewCache<RedeemCouponsCache>(
          "redeem-coupons",
          {
            maxAgeMs: 180000,
          }
        );

        writeClientViewCache("redeem-coupons", {
          coupons: mergeCoupons(
            cached?.data?.coupons || [],
            data.coupon as CouponViewModel
          ),
          openCode: String(
            (data.coupon as CouponViewModel | undefined)?.code || ""
          ),
        } satisfies RedeemCouponsCache);
      }

      if (data?.balances) {
        window.dispatchEvent(
          new CustomEvent("nexora:balance-updated", {
            detail: data.balances,
          })
        );
      }

      if (data?.couponUrl) {
        navigatingToCoupon = true;
        router.prefetch(String(data.couponUrl));
        router.push(String(data.couponUrl));
      }
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างแลกรางวัล");
    } finally {
      if (!navigatingToCoupon) {
        setLoadingKey(null);
      }
    }
  };

  const requestRedeem = async (currency: Currency) => {
    if (busy) return;

    const cost = currency === "NEX" ? nexCost : coinCost;
    const balance = currency === "NEX" ? userNexPoint : userCoin;
    const canRedeem = currency === "NEX" ? canRedeemWithNex : canRedeemWithCoin;

    if (!canRedeem) {
      setError(
        stock <= 0
          ? "รางวัลนี้หมดสต็อกแล้ว"
          : `${currency} ไม่พอสำหรับแลกรางวัลนี้`
      );
      return;
    }

    setError("");
    setConfirmingCurrency(currency);

    try {
      const confirmed = await nexoraConfirm({
        title: `ยืนยันการแลกด้วย ${currency}`,
        message: `ต้องการแลก "${rewardName}" ด้วย ${formatAmount(
          cost
        )} ${currency} ใช่ไหม? ยอดปัจจุบันของคุณคือ ${formatAmount(
          balance
        )} ${currency} หลังยืนยันระบบจะหักแต้มและสร้างคูปองทันที`,
        tone: "warning",
        confirmText: "ยืนยันการแลก",
        cancelText: "ยกเลิก",
      });

      if (confirmed) {
        await handleRedeem(currency);
      }
    } finally {
      setConfirmingCurrency(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {nexCost != null ? (
        <button
          type="button"
          onClick={() => void requestRedeem("NEX")}
          disabled={!canRedeemWithNex || busy}
          className={`w-full rounded-full px-4 py-4 text-sm font-black transition ${
            canRedeemWithNex && !busy
              ? "bg-[linear-gradient(135deg,#f7c948,#fff0a3)] text-black shadow-[0_18px_38px_rgba(247,201,72,0.18)] hover:scale-[1.01]"
              : "bg-white/[0.06] text-white/32 ring-1 ring-white/8"
          }`}
        >
          {loadingKey === `${rewardId}-NEX`
            ? `กำลังแลก ${rewardName}...`
            : confirmingCurrency === "NEX"
              ? "กำลังยืนยัน..."
              : "แลกด้วย NEX"}
        </button>
      ) : null}

      {coinCost != null ? (
        <button
          type="button"
          onClick={() => void requestRedeem("COIN")}
          disabled={!canRedeemWithCoin || busy}
          className={`w-full rounded-full px-4 py-4 text-sm font-black transition ${
            canRedeemWithCoin && !busy
              ? "bg-[linear-gradient(135deg,#ffffff,#d9dde5)] text-black shadow-[0_18px_38px_rgba(255,255,255,0.12)] hover:scale-[1.01]"
              : "bg-white/[0.06] text-white/32 ring-1 ring-white/8"
          }`}
        >
          {loadingKey === `${rewardId}-COIN`
            ? `กำลังแลก ${rewardName}...`
            : confirmingCurrency === "COIN"
              ? "กำลังยืนยัน..."
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
