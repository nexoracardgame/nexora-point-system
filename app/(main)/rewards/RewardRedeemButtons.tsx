"use client";

import { AlertTriangle, Coins, Gem, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CouponViewModel } from "@/components/CouponDetailCard";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
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
  const [error, setError] = useState("");
  const [confirmCurrency, setConfirmCurrency] = useState<Currency | null>(null);

  useEffect(() => {
    router.prefetch("/redeem");
  }, [router]);

  const canRedeemWithNex =
    nexCost != null && stock > 0 && userNexPoint >= Number(nexCost);
  const canRedeemWithCoin =
    coinCost != null && stock > 0 && userCoin >= Number(coinCost);

  const confirmMeta = useMemo(() => {
    if (confirmCurrency === "NEX") {
      return {
        title: "ยืนยันการแลกด้วย NEX",
        amountLabel:
          nexCost != null ? `${Number(nexCost).toLocaleString("th-TH")} NEX` : "-",
        icon: <Gem className="h-5 w-5 text-amber-300" />,
        accent:
          "bg-[linear-gradient(135deg,#f7c948,#fff0a3)] text-black shadow-[0_18px_38px_rgba(247,201,72,0.18)]",
      };
    }

    if (confirmCurrency === "COIN") {
      return {
        title: "ยืนยันการแลกด้วย COIN",
        amountLabel:
          coinCost != null
            ? `${Number(coinCost).toLocaleString("th-TH")} COIN`
            : "-",
        icon: <Coins className="h-5 w-5 text-slate-800" />,
        accent:
          "bg-[linear-gradient(135deg,#ffffff,#d9dde5)] text-black shadow-[0_18px_38px_rgba(255,255,255,0.12)]",
      };
    }

    return null;
  }, [coinCost, confirmCurrency, nexCost]);

  const handleRedeem = async (currency: Currency) => {
    let keepDialogOpen = false;

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
        const cached = readClientViewCache<RedeemCouponsCache>("redeem-coupons", {
          maxAgeMs: 180000,
        });

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
        keepDialogOpen = true;
        router.prefetch(String(data.couponUrl));
        router.push(String(data.couponUrl));
        return;
      }
    } catch {
      setError("เกิดข้อผิดพลาดระหว่างแลกรางวัล");
    } finally {
      if (!keepDialogOpen) {
        setLoadingKey(null);
        setConfirmCurrency(null);
      }
    }
  };

  return (
    <>
      <div className="space-y-2.5">
        {nexCost != null ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setConfirmCurrency("NEX");
            }}
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
            onClick={() => {
              setError("");
              setConfirmCurrency("COIN");
            }}
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

      {confirmCurrency && confirmMeta ? (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-5">
          <div className="relative w-full rounded-t-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.98))] px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 shadow-[0_32px_120px_rgba(0,0,0,0.55)] sm:max-w-lg sm:rounded-[32px] sm:px-5 sm:pb-5">
            <button
              type="button"
              onClick={() => setConfirmCurrency(null)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/75 ring-1 ring-white/8 transition hover:bg-white/[0.1]"
              aria-label="Close confirm dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_20%,#fff,#f6e6a0_38%,#111827_100%)] text-black shadow-[0_16px_40px_rgba(255,255,255,0.14)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-white/38">
                  Confirm Reward
                </div>
                <div className="mt-1 text-xl font-black text-white sm:text-2xl">
                  {confirmMeta.title}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-300/12 text-amber-200 ring-1 ring-amber-300/15">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">
                    คุณกำลังจะแลกรางวัลนี้
                  </div>
                  <div className="mt-1 text-sm leading-6 text-white/60">
                    {rewardName}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-[22px] bg-black/35 px-3 py-3 ring-1 ring-white/6">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    ราคาที่ใช้
                  </div>
                  <div className="mt-2 text-base font-black text-white">
                    {confirmMeta.amountLabel}
                  </div>
                </div>
                <div className="rounded-[22px] bg-black/35 px-3 py-3 ring-1 ring-white/6">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    คงเหลือสต็อก
                  </div>
                  <div className="mt-2 text-base font-black text-white">
                    {stock.toLocaleString("th-TH")}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmCurrency(null)}
                className="min-h-[52px] rounded-full bg-white/[0.06] px-4 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleRedeem(confirmCurrency)}
                disabled={loadingKey === `${rewardId}-${confirmCurrency}`}
                className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition hover:scale-[1.01] ${confirmMeta.accent}`}
              >
                {confirmMeta.icon}
                {loadingKey === `${rewardId}-${confirmCurrency}`
                  ? "กำลังยืนยัน..."
                  : "ยืนยันการแลก"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
