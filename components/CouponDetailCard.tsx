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
  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,21,35,0.96),rgba(10,12,20,0.96))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.36)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15),transparent_30%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.14),transparent_34%)]" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">
            <Ticket className="h-3.5 w-3.5" />
            REWARD COUPON
          </div>

          <div
            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] ${
              coupon.used
                ? "border border-white/10 bg-white/10 text-white/70"
                : "border border-emerald-300/18 bg-emerald-300/12 text-emerald-300"
            }`}
          >
            {coupon.statusLabel}
          </div>
        </div>

        <div className="relative mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
          <div className="pointer-events-none absolute inset-y-0 left-[46px] w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.25),transparent)] sm:left-[60px]" />
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto rounded-[24px] bg-white p-3 shadow-[0_18px_50px_rgba(255,255,255,0.08)] sm:mx-0">
              <QRCodeCanvas value={coupon.code} size={compact ? 168 : 188} />
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/38">
                  รางวัลที่แลก
                </div>
                <div className="mt-2 text-2xl font-black leading-tight text-white sm:text-[2rem]">
                  {coupon.rewardName}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    มูลค่า
                  </div>
                  <div className="mt-1 text-lg font-black text-amber-300">
                    {coupon.valueLabel}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    วันหมดอายุ
                  </div>
                  <div className="mt-1 text-lg font-black text-cyan-200">
                    {coupon.expiryLabel}
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                  รหัสคูปอง
                </div>
                <div className="mt-1 break-all text-sm font-black text-white/88 sm:text-base">
                  {coupon.code}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,16,26,0.96),rgba(10,11,18,0.92))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2 text-lg font-black text-white">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            รายละเอียดคูปอง
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/35">
                <Gift className="h-3.5 w-3.5 text-amber-300" />
                รายการที่แลก
              </div>
              <div className="mt-2 text-xl font-black">{coupon.rewardName}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  สร้างเมื่อ
                </div>
                <div className="mt-2 text-sm font-bold text-white/80">
                  {formatDateTime(coupon.createdAt)}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  ใช้งานเมื่อ
                </div>
                <div className="mt-2 text-sm font-bold text-white/80">
                  {formatDateTime(coupon.usedAt)}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/35">
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
                  <div className="mt-1 text-sm leading-6 text-white/58">
                    {coupon.used
                      ? "คูปองใบนี้ถูกใช้งานแล้วและไม่สามารถสแกนซ้ำได้อีก"
                      : "เมื่อถึงเวลารับของ ให้เปิดหน้าต่างนี้เพื่อให้พนักงานยิงสแกน QR แล้วระบบจะอัปเดตทันที"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,16,26,0.96),rgba(10,11,18,0.92))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2 text-lg font-black text-white">
            <QrCode className="h-5 w-5 text-violet-300" />
            วิธีใช้งาน
          </div>

          <div className="mt-4 space-y-3 text-sm leading-6 text-white/60">
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
