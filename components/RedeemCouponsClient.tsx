"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Gift,
  Plus,
  QrCode,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
import { formatThaiDateTime } from "@/lib/thai-time";
import CouponDetailCard, { type CouponViewModel } from "./CouponDetailCard";

type RedeemCouponsCache = {
  coupons: CouponViewModel[];
  openCode: string;
};

function mergeCoupons(
  coupons: CouponViewModel[],
  fallbackCoupons: CouponViewModel[]
) {
  const map = new Map<string, CouponViewModel>();

  for (const coupon of [...coupons, ...fallbackCoupons]) {
    const key = String(coupon.code || coupon.id);
    if (!key || map.has(key)) continue;
    map.set(key, coupon);
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return formatThaiDateTime(value);
}

export default function RedeemCouponsClient({
  initialCoupons,
  initialOpenCode,
}: {
  initialCoupons: CouponViewModel[];
  initialOpenCode?: string;
}) {
  const cachedRedeemState = useMemo(
    () =>
      readClientViewCache<RedeemCouponsCache>("redeem-coupons", {
        maxAgeMs: 180000,
      }),
    []
  );
  const [coupons, setCoupons] = useState(() =>
    mergeCoupons(initialCoupons, cachedRedeemState?.data?.coupons || [])
  );
  const [selectedCode, setSelectedCode] = useState(
    initialOpenCode || cachedRedeemState?.data?.openCode || ""
  );

  useEffect(() => {
    setCoupons((prev) => mergeCoupons(initialCoupons, prev));
  }, [initialCoupons]);

  useEffect(() => {
    if (initialOpenCode) {
      setSelectedCode(initialOpenCode);
    }
  }, [initialOpenCode]);

  useEffect(() => {
    writeClientViewCache("redeem-coupons", {
      coupons,
      openCode: selectedCode,
    } satisfies RedeemCouponsCache);
  }, [coupons, selectedCode]);

  const syncCoupons = useCallback(async () => {
    try {
      const res = await fetch(`/api/coupon/list?ts=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      if (Array.isArray(data?.coupons)) {
        setCoupons(data.coupons);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    void syncCoupons();

    const onFocus = () => void syncCoupons();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncCoupons();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "nexora:rewards-updated") {
        void syncCoupons();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("nexora:rewards-updated", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncCoupons();
      }
    }, 6000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nexora:rewards-updated", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncCoupons]);

  const selectedCoupon =
    coupons.find((coupon) => coupon.code === selectedCode) || null;

  const summary = useMemo(() => {
    const ready = coupons.filter((coupon) => !coupon.used).length;
    const used = coupons.filter((coupon) => coupon.used).length;
    return {
      total: coupons.length,
      ready,
      used,
    };
  }, [coupons]);

  const readyCoupons = useMemo(
    () => coupons.filter((coupon) => !coupon.used),
    [coupons]
  );

  const usedCoupons = useMemo(
    () => coupons.filter((coupon) => coupon.used),
    [coupons]
  );

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(246,244,251,0.98),rgba(232,234,248,0.96))] px-4 pb-6 pt-5 text-[#09090b] shadow-[0_28px_90px_rgba(80,78,120,0.16)] ring-1 ring-white/60 sm:rounded-[46px] sm:px-7 sm:pb-8 sm:pt-6 xl:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.96),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(255,215,128,0.18),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.35),transparent_75%)]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white shadow-[0_16px_40px_rgba(15,15,20,0.18)]">
              <Ticket className="h-3.5 w-3.5 text-[#ffe486]" />
              Redeem
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.08em] sm:text-6xl lg:text-7xl">
              คูปองของคุณ
            </h1>
            <div className="mt-3 text-sm font-bold text-black/42 sm:text-base">
              แตะคูปองเพื่อเปิด QR และดูรายละเอียดเต็ม
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-[30px] bg-black px-5 py-5 text-white shadow-[0_20px_50px_rgba(15,15,20,0.22)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10">
                    <QrCode className="h-5 w-5 text-[#ffe486]" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                      Ready
                    </div>
                    <div className="mt-1 text-3xl font-black tracking-[-0.06em] sm:text-4xl">
                      {summary.ready.toLocaleString("th-TH")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#f6e6a0_18%,#d1d5ff_42%,#151821_100%)] text-black shadow-[0_18px_46px_rgba(0,0,0,0.18)] ring-4 ring-white/70">
                <Plus className="h-8 w-8" />
              </div>

              <div className="rounded-[30px] bg-black px-5 py-5 text-white shadow-[0_20px_50px_rgba(15,15,20,0.22)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                      Used
                    </div>
                    <div className="mt-1 text-3xl font-black tracking-[-0.06em] sm:text-4xl">
                      {summary.used.toLocaleString("th-TH")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3 text-xs font-black text-black/42 sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f6b93b]" />
                ทั้งหมด {summary.total.toLocaleString("th-TH")} คูปอง
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-black/15 sm:block" />
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-black/55" />
                โหลดครั้งเดียวเรียบร้อย
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-6">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-white/32">
                Ready Coupons
              </div>
              <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                พร้อมใช้งาน
              </h2>
            </div>
            <div className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-black text-white/72 ring-1 ring-white/10">
              {readyCoupons.length.toLocaleString("th-TH")}
            </div>
          </div>

          {readyCoupons.length === 0 ? (
            <div className="rounded-[30px] bg-white/[0.04] px-6 py-10 text-center text-sm font-bold text-white/45 ring-1 ring-white/10">
              ยังไม่มีคูปองที่พร้อมใช้งาน
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {readyCoupons.map((coupon) => (
                <button
                  key={coupon.id}
                  type="button"
                  onClick={() => setSelectedCode(coupon.code)}
                  className="group text-left"
                >
                  <article className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#ffffff_0%,#f3f5fb_100%)] p-4 text-[#09090b] shadow-[0_26px_70px_rgba(20,20,30,0.16)] ring-1 ring-white/70 transition duration-300 hover:-translate-y-1">
                    <div className="pointer-events-none absolute inset-x-8 top-0 h-12 rounded-b-[26px] bg-black/5 blur-2xl" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                        <Gift className="h-3.5 w-3.5 text-[#ffe486]" />
                        Ready
                      </div>
                      <div className="rounded-full bg-[#edf0f8] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                        {coupon.valueLabel}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="relative h-20 w-20 overflow-hidden rounded-[22px] bg-[#eef1f7] ring-1 ring-black/5">
                        <Image
                          src={coupon.rewardImageUrl}
                          alt={coupon.rewardName}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">
                          {coupon.rewardName}
                        </h3>
                        <div className="mt-2 text-xs font-bold text-black/42 sm:text-sm">
                          {formatDateTime(coupon.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[24px] bg-[#eff2fa] px-4 py-4 ring-1 ring-black/5">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">
                        Coupon Code
                      </div>
                      <div className="mt-2 break-all text-sm font-black text-black/88">
                        {coupon.code}
                      </div>
                    </div>
                  </article>
                </button>
              ))}
            </div>
          )}
        </div>

        {usedCoupons.length > 0 ? (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-white/32">
                  Used Coupons
                </div>
                <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                  ใช้งานแล้ว
                </h2>
              </div>
              <div className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-black text-white/72 ring-1 ring-white/10">
                {usedCoupons.length.toLocaleString("th-TH")}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {usedCoupons.map((coupon) => (
                <button
                  key={coupon.id}
                  type="button"
                  onClick={() => setSelectedCode(coupon.code)}
                  className="group text-left"
                >
                  <article className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(180deg,#fafbff_0%,#ebeef6_100%)] p-4 text-[#09090b] shadow-[0_18px_56px_rgba(20,20,30,0.12)] ring-1 ring-white/70 transition duration-300 hover:-translate-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-black/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Used
                      </div>
                      <div className="rounded-full bg-[#edf0f8] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                        {coupon.valueLabel}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="relative h-20 w-20 overflow-hidden rounded-[22px] bg-[#eef1f7] ring-1 ring-black/5 grayscale-[0.08]">
                        <Image
                          src={coupon.rewardImageUrl}
                          alt={coupon.rewardName}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">
                          {coupon.rewardName}
                        </h3>
                        <div className="mt-2 text-xs font-bold text-black/42 sm:text-sm">
                          {coupon.statusLabel}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[24px] bg-[#eff2fa] px-4 py-4 ring-1 ring-black/5">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">
                        ใช้งานเมื่อ
                      </div>
                      <div className="mt-2 text-sm font-black text-black/88">
                        {formatDateTime(coupon.usedAt)}
                      </div>
                    </div>
                  </article>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {selectedCoupon ? (
        <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/55 p-0 backdrop-blur-md sm:items-center sm:p-5">
          <div className="relative max-h-[100dvh] w-full overflow-auto rounded-t-[34px] bg-[linear-gradient(180deg,#ffffff_0%,#f0f3fb_100%)] px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 text-[#09090b] shadow-[0_30px_120px_rgba(0,0,0,0.28)] ring-1 ring-white/80 sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[34px] sm:p-5">
            <button
              type="button"
              onClick={() => setSelectedCode("")}
              className="sticky right-0 top-0 z-10 ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-black text-white shadow-[0_16px_36px_rgba(20,20,30,0.16)] transition hover:scale-[1.03]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mt-2">
              <CouponDetailCard coupon={selectedCoupon} compact />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
