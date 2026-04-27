"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gift,
  QrCode,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import CouponDetailCard, { type CouponViewModel } from "./CouponDetailCard";

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function RedeemCouponsClient({
  initialCoupons,
  initialOpenCode,
}: {
  initialCoupons: CouponViewModel[];
  initialOpenCode?: string;
}) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [selectedCode, setSelectedCode] = useState(initialOpenCode || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCoupons(initialCoupons);
  }, [initialCoupons]);

  useEffect(() => {
    if (initialOpenCode) {
      setSelectedCode(initialOpenCode);
    }
  }, [initialOpenCode]);

  useEffect(() => {
    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncCoupons = async () => {
      if (disposed || document.visibilityState !== "visible") return;

      try {
        setLoading(true);
        const res = await fetch(`/api/coupon/list?ts=${Date.now()}`, {
          cache: "no-store",
        });

        if (!res.ok || disposed) return;

        const data = await res.json();
        if (!disposed && Array.isArray(data?.coupons)) {
          setCoupons(data.coupons);
        }
      } catch {
        return;
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    intervalId = setInterval(syncCoupons, 5000);

    const handleFocus = () => {
      void syncCoupons();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncCoupons();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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

  return (
    <>
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,29,0.98),rgba(12,14,24,0.94))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_82%_22%,rgba(251,191,36,0.12),transparent_26%)]" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 sm:text-xs">
              <Ticket className="h-3.5 w-3.5" />
              REDEEM WALLET
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
              คูปองรางวัลของคุณ พร้อมเปิด QR ใช้งานได้ทันที
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
              แตะคูปองที่ต้องการเพื่อเปิดรายละเอียดแบบเต็มหน้าจอ แล้วให้พนักงานยิงสแกนจากหน้า /staff ได้เลย
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
            <div className="rounded-[26px] border border-emerald-300/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(16,185,129,0.08))] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-emerald-200/70">
                <QrCode className="h-3.5 w-3.5" />
                พร้อมใช้งาน
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-300 sm:text-3xl">
                {summary.ready.toLocaleString("th-TH")}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/55">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ใช้งานแล้ว
              </div>
              <div className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {summary.used.toLocaleString("th-TH")}
              </div>
            </div>

            <div className="rounded-[26px] border border-violet-300/12 bg-[linear-gradient(180deg,rgba(168,85,247,0.16),rgba(168,85,247,0.07))] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-violet-200/70">
                <Sparkles className="h-3.5 w-3.5" />
                ทั้งหมด
              </div>
              <div className="mt-2 text-2xl font-black text-violet-200 sm:text-3xl">
                {summary.total.toLocaleString("th-TH")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white/88">
            <Gift className="h-4 w-4 text-amber-300" />
            แลกแล้วได้คูปองใหม่ทุกครั้ง
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            แต่ละการแลกจะสร้าง QR ใหม่ของใบนั้นโดยเฉพาะ และใช้ได้ครั้งเดียว
          </p>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white/88">
            <Clock3 className="h-4 w-4 text-cyan-300" />
            ซิงก์สถานะอัตโนมัติ
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            หน้านี้รีเฟรชสถานะคูปองให้อัตโนมัติเมื่อกลับมาโฟกัสและระหว่างใช้งาน
          </p>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white/88">
            <QrCode className="h-4 w-4 text-emerald-300" />
            ใช้กับ staff ได้ทันที
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            เปิดคูปองแล้วให้พนักงานเข้า /staff เพื่อยิงสแกนจากมือถือหรือเครื่องสแกนได้เลย
          </p>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/35">
              MY COUPONS
            </div>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">
              แตะเพื่อเปิดคูปองแบบเต็ม
            </h2>
          </div>

          <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-white/55">
            {loading ? "กำลังซิงก์..." : `ทั้งหมด ${summary.total.toLocaleString("th-TH")} รายการ`}
          </div>
        </div>

        {coupons.length === 0 ? (
          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center text-white/45">
            ยังไม่มีคูปองในระบบตอนนี้
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {coupons.map((coupon) => (
              <button
                key={coupon.id}
                type="button"
                onClick={() => setSelectedCode(coupon.code)}
                className="group text-left"
              >
                <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,20,31,0.98),rgba(12,14,22,0.96))] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-amber-300/20">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_30%)]" />

                  <div className="relative flex flex-col gap-4 sm:flex-row">
                    <div className="relative h-[132px] overflow-hidden rounded-[22px] border border-white/8 bg-black/20 sm:w-[156px]">
                      <Image
                        src={coupon.rewardImageUrl}
                        alt={coupon.rewardName}
                        fill
                        sizes="156px"
                        className="object-cover"
                      />
                    </div>

                    <div className="relative min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">
                            {coupon.used ? "USED" : "READY"}
                          </div>
                          <h3 className="mt-3 line-clamp-2 text-2xl font-black leading-tight">
                            {coupon.rewardName}
                          </h3>
                        </div>

                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35 transition group-hover:text-amber-300" />
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                            มูลค่า
                          </div>
                          <div className="mt-1 text-sm font-black text-amber-300">
                            {coupon.valueLabel}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                            หมดอายุ
                          </div>
                          <div className="mt-1 text-sm font-black text-cyan-200">
                            {coupon.expiryLabel}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/55">
                        <span>{formatDateTime(coupon.createdAt)}</span>
                        <span
                          className={`font-black ${
                            coupon.used ? "text-white/55" : "text-emerald-300"
                          }`}
                        >
                          {coupon.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedCoupon ? (
        <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-5">
          <div className="relative max-h-[100dvh] w-full overflow-auto rounded-t-[30px] border border-white/10 bg-[#080a11] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[30px] sm:p-5">
            <button
              type="button"
              onClick={() => setSelectedCode("")}
              className="sticky right-0 top-0 z-10 ml-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/[0.1]"
            >
              <X className="h-5 w-5" />
            </button>

            <CouponDetailCard coupon={selectedCoupon} compact />
          </div>
        </div>
      ) : null}
    </>
  );
}
