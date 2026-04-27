"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Gift,
  QrCode,
  Search,
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

function normalizeRewardName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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
  const [query, setQuery] = useState("");

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

  const filteredCoupons = useMemo(() => {
    const keyword = normalizeRewardName(query);

    if (!keyword) {
      return coupons;
    }

    const exact = coupons.filter(
      (coupon) => normalizeRewardName(coupon.rewardName) === keyword
    );

    if (exact.length > 0) {
      return exact;
    }

    return coupons.filter((coupon) =>
      normalizeRewardName(coupon.rewardName).includes(keyword)
    );
  }, [coupons, query]);

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] px-3 pb-6 pt-5 shadow-[0_32px_120px_rgba(0,0,0,0.48)] sm:rounded-[48px] sm:px-7 sm:pb-8 xl:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_34%)]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/38">
                Redeem Wallet
              </div>
              <div className="mt-1 truncate text-base font-black sm:text-xl">
                คูปองรางวัลของคุณ
              </div>
            </div>

            <div className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-200 sm:px-4 sm:text-sm">
              {summary.ready.toLocaleString("th-TH")} พร้อมใช้
            </div>
          </div>

          <div className="mt-8 text-center sm:mt-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white/48 ring-1 ring-white/8">
              <Ticket className="h-3.5 w-3.5 text-amber-300" />
              Redeem
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.07em] sm:text-6xl lg:text-7xl">
              คูปองของคุณ
            </h1>
          </div>

          <div className="relative mt-7">
            <div className="rounded-t-[40px] bg-white px-4 py-5 text-black shadow-[0_28px_70px_rgba(255,255,255,0.06)] sm:rounded-t-[56px] sm:px-7 sm:py-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-black/38">Ready</div>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#f5bd22] shadow-[0_16px_32px_rgba(245,189,34,0.28)] sm:h-20 sm:w-20">
                      <QrCode className="h-8 w-8 text-white sm:h-10 sm:w-10" />
                    </div>
                    <div>
                      <div className="text-2xl font-black sm:text-4xl">QR</div>
                      <div className="mt-1 text-xs font-bold text-black/36">
                        พร้อมใช้งาน
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-black text-white sm:px-4">
                    <QrCode className="h-3.5 w-3.5 text-amber-300" />
                    {summary.ready.toLocaleString("th-TH")}
                  </div>
                  <div className="mt-5 text-3xl font-black tracking-[-0.06em] sm:text-5xl">
                    {summary.ready.toLocaleString("th-TH")}
                  </div>
                  <div className="mt-1 text-xs font-bold text-black/38">
                    Ready coupons
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mx-auto -my-6 grid h-20 w-20 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#f6e6a0_18%,#d1d5ff_42%,#151821_100%)] text-black shadow-[0_18px_46px_rgba(0,0,0,0.28)] ring-4 ring-white/70 sm:h-24 sm:w-24">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.55),transparent_62%)] blur-md" />
              <div className="relative grid h-12 w-12 place-items-center rounded-full bg-black text-white sm:h-14 sm:w-14">
                <Gift className="h-6 w-6 text-amber-300 sm:h-7 sm:w-7" />
              </div>
            </div>

            <div className="rounded-b-[40px] bg-white px-4 py-5 text-black shadow-[0_28px_70px_rgba(255,255,255,0.06)] sm:rounded-b-[56px] sm:px-7 sm:py-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-black/38">Archive</div>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#24b083] shadow-[0_16px_32px_rgba(36,176,131,0.24)] sm:h-20 sm:w-20">
                      <CheckCircle2 className="h-8 w-8 text-white sm:h-10 sm:w-10" />
                    </div>
                    <div>
                      <div className="text-2xl font-black sm:text-4xl">USED</div>
                      <div className="mt-1 text-xs font-bold text-black/36">
                        ประวัติการใช้
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-black text-white sm:px-4">
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    {summary.used.toLocaleString("th-TH")}
                  </div>
                  <div className="mt-5 text-3xl font-black tracking-[-0.06em] sm:text-5xl">
                    {summary.used.toLocaleString("th-TH")}
                  </div>
                  <div className="mt-1 text-xs font-bold text-black/38">
                    Used coupons
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-white/46">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-300" />
                ทั้งหมด {summary.total.toLocaleString("th-TH")} ใบ
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                ซิงก์สถานะอัตโนมัติ
              </span>
            </div>

            <div className="mt-6 rounded-[36px] bg-black p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
              <div className="flex min-h-[72px] items-center gap-3 rounded-[30px] px-3 text-white sm:px-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_20%,#fff,#c7d2fe_38%,#111827_100%)] text-black shadow-[0_16px_40px_rgba(255,255,255,0.12)]">
                  <Search className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/38">
                    Search Coupons
                  </div>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นหาชื่อรางวัล"
                    className="mt-1 w-full bg-transparent text-lg font-black outline-none placeholder:text-white/40 sm:text-2xl"
                  />
                </div>
                <div className="hidden shrink-0 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-black text-white/60 sm:block">
                  {filteredCoupons.length.toLocaleString("th-TH")} ผลลัพธ์
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white/88">
            <Gift className="h-4 w-4 text-amber-300" />
            ทุกการแลกได้คูปองใหม่เสมอ
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            แต่ละครั้งจะสร้าง QR ของใบนั้นแบบใช้ครั้งเดียว ใช้เสร็จแล้วระบบจะล็อกทันที
          </p>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white/88">
            <Clock3 className="h-4 w-4 text-cyan-300" />
            ซิงก์สถานะอัตโนมัติ
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            หน้านี้จะรีเฟรชสถานะคูปองเมื่อกลับมาใช้งานหรือเมื่อเปิดหน้าไว้ระหว่างรอใช้
          </p>
        </div>

        <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white/88">
            <QrCode className="h-4 w-4 text-emerald-300" />
            พร้อมให้ staff สแกน
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">
            เปิดหน้ารายละเอียดคูปองแล้วให้พนักงานสแกนจากหน้า /staff ได้ทันทีทั้งคอมและมือถือ
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
            {loading
              ? "กำลังซิงก์..."
              : `ทั้งหมด ${summary.total.toLocaleString("th-TH")} รายการ`}
          </div>
        </div>

        {filteredCoupons.length === 0 ? (
          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center text-white/45">
            ไม่พบคูปองที่ค้นหา
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredCoupons.map((coupon) => (
              <button
                key={coupon.id}
                type="button"
                onClick={() => setSelectedCode(coupon.code)}
                className="group text-left"
              >
                <article className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,12,0.96))] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-amber-300/20">
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
          <div className="relative max-h-[100dvh] w-full overflow-auto rounded-t-[30px] border border-white/10 bg-[#080a11] px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[30px] sm:p-5">
            <button
              type="button"
              onClick={() => setSelectedCode("")}
              className="sticky right-0 top-0 z-10 ml-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/[0.1]"
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
