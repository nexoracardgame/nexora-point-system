"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  CheckCircle2,
  Clock3,
  Gift,
  QrCode,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";

export type CouponViewModel = {
  id: string;
  code: string;
  used: boolean;
  createdAt: string;
  usedAt: string | null;
  expiresAt: string | null;
  rewardId: string;
  rewardName: string;
  rewardImageUrl: string;
  valueCurrency: "NEX" | "COIN" | null;
  valueAmount: number | null;
  valueLabel: string;
  userId: string;
  lineId: string;
  userName: string;
  userImage: string;
  detailUrl: string;
  statusLabel: string;
  expiryLabel: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CouponDetailCard({
  coupon,
  compact = false,
}: {
  coupon: CouponViewModel;
  compact?: boolean;
}) {
  const sectionRadius = compact ? "rounded-[26px] sm:rounded-[30px]" : "rounded-[30px]";
  const sectionPadding = compact ? "p-4 sm:p-5" : "p-5";
  const titleSize = compact
    ? "text-xl sm:text-[2rem]"
    : "text-2xl sm:text-[2rem]";
  const qrSize = compact ? 144 : 188;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div
        className={`relative overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,35,0.96),rgba(10,12,20,0.96))] shadow-[0_20px_80px_rgba(0,0,0,0.36)] ${sectionRadius} ${sectionPadding}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_30%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_34%)]" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-amber-200 sm:text-[10px] sm:tracking-[0.28em]">
            <Ticket className="h-3.5 w-3.5" />
            REWARD COUPON
          </div>

          <div
            className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] sm:text-[10px] sm:tracking-[0.22em] ${
              coupon.used
                ? "border border-white/10 bg-white/10 text-white/70"
                : "border border-emerald-300/18 bg-emerald-300/12 text-emerald-300"
            }`}
          >
            {coupon.statusLabel}
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 sm:mt-5 sm:rounded-[28px] sm:p-4">
          <div className="pointer-events-none absolute inset-y-0 left-[42px] hidden w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.25),transparent)] sm:block sm:left-[60px]" />
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto rounded-[20px] bg-white p-2.5 shadow-[0_18px_50px_rgba(255,255,255,0.08)] sm:mx-0 sm:rounded-[24px] sm:p-3">
              <QRCodeCanvas value={coupon.code} size={qrSize} />
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <div className="text-[9px] uppercase tracking-[0.22em] text-white/38 sm:text-[10px] sm:tracking-[0.28em]">
                  รางวัลที่แลก
                </div>
                <div className={`mt-2 font-black leading-tight text-white ${titleSize}`}>
                  {coupon.rewardName}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-white/35 sm:text-[10px] sm:tracking-[0.22em]">
                    มูลค่า
                  </div>
                  <div className="mt-1 text-base font-black text-amber-300 sm:text-lg">
                    {coupon.valueLabel}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-white/35 sm:text-[10px] sm:tracking-[0.22em]">
                    วันหมดอายุ
                  </div>
                  <div className="mt-1 text-base font-black text-cyan-200 sm:text-lg">
                    {coupon.expiryLabel}
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] p-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/35 sm:text-[10px] sm:tracking-[0.22em]">
                  รหัสคูปอง
                </div>
                <div className="mt-1 break-all text-[13px] font-black text-white/88 sm:text-base">
                  {coupon.code}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div
          className={`border border-white/10 bg-[linear-gradient(180deg,rgba(14,16,26,0.96),rgba(10,11,18,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.28)] ${sectionRadius} ${sectionPadding}`}
        >
          <div className="flex items-center gap-2 text-base font-black text-white sm:text-lg">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            รายละเอียดคูปอง
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35 sm:text-[11px] sm:tracking-[0.24em]">
                <Gift className="h-3.5 w-3.5 text-amber-300" />
                รายการที่แลก
              </div>
              <div className="mt-2 text-lg font-black sm:text-xl">{coupon.rewardName}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/35 sm:text-[10px] sm:tracking-[0.24em]">
                  สร้างเมื่อ
                </div>
                <div className="mt-2 text-sm font-bold text-white/80">
                  {formatDateTime(coupon.createdAt)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[9px] uppercase tracking-[0.16em] text-white/35 sm:text-[10px] sm:tracking-[0.24em]">
                  ใช้งานเมื่อ
                </div>
                <div className="mt-2 text-sm font-bold text-white/80">
                  {formatDateTime(coupon.usedAt)}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35 sm:text-[11px] sm:tracking-[0.24em]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                สถานะการรับสิทธิ์
              </div>
              <div className="mt-2 flex items-start gap-3">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 ${
                    coupon.used ? "text-white/60" : "text-emerald-300"
                  }`}
                />
                <div>
                  <div className="font-black text-white">{coupon.statusLabel}</div>
                  <div className="mt-1 text-[13px] leading-6 text-white/58 sm:text-sm">
                    {coupon.used
                      ? "คูปองใบนี้ถูกใช้งานแล้วและไม่สามารถสแกนซ้ำได้อีก"
                      : "เมื่อถึงเวลารับของ ให้เปิดหน้าต่างนี้เพื่อให้พนักงานยิงสแกน QR แล้วระบบจะอัปเดตทันที"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`border border-white/10 bg-[linear-gradient(180deg,rgba(14,16,26,0.96),rgba(10,11,18,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.28)] ${sectionRadius} ${sectionPadding}`}
        >
          <div className="flex items-center gap-2 text-base font-black text-white sm:text-lg">
            <QrCode className="h-5 w-5 text-violet-300" />
            วิธีใช้งาน
          </div>

          <div className="mt-4 space-y-3 text-[13px] leading-6 text-white/60 sm:text-sm">
            <p>1. แตะหรือคลิกคูปองใบนี้ตอนอยู่หน้ารับของ</p>
            <p>2. เปิด QR ให้พนักงานที่หน้า /staff ยิงสแกน</p>
            <p>3. หลังสแกนสำเร็จ คูปองจะเปลี่ยนสถานะเป็นใช้งานแล้วทันที</p>
          </div>

          {!compact ? (
            <Link
              href="/redeem"
              className="mt-4 inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.1]"
            >
              กลับไปหน้า Redeem
            </Link>
          ) : null}

          <div className="mt-4 flex items-start gap-2 rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-white/52">
            <Clock3 className="mt-0.5 h-4 w-4 text-cyan-300" />
            ระบบจะซิงก์สถานะคูปองอัตโนมัติเมื่อมีการใช้งานจากฝั่งพนักงาน
          </div>
        </div>
      </div>
    </div>
  );
}
