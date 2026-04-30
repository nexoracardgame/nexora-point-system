"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  CheckCircle2,
  Clock3,
  Gift,
  QrCode,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { formatThaiDateTime } from "@/lib/thai-time";

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

  return formatThaiDateTime(value);
}

const REWARD_IMAGE_FALLBACK = "/avatar.png";

export default function CouponDetailCard({
  coupon,
  compact = false,
}: {
  coupon: CouponViewModel;
  compact?: boolean;
}) {
  const qrSize = compact ? 166 : 196;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
      <div
        className={`overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#ffffff_0%,#f2f5fb_100%)] shadow-[0_24px_70px_rgba(20,20,30,0.12)] ring-1 ring-black/5 ${
          compact ? "p-4 sm:p-5" : "p-5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-white">
            <Ticket className="h-3.5 w-3.5 text-[#ffe486]" />
            Reward Coupon
          </div>
          <div
            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${
              coupon.used
                ? "bg-black text-white"
                : "bg-[#e7fff1] text-[#0f9f68]"
            }`}
          >
            {coupon.statusLabel}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-4">
            <div className="relative min-h-[220px] overflow-hidden rounded-[28px] bg-[#eef2fa] ring-1 ring-black/5 sm:min-h-[280px]">
              <img
                src={coupon.rewardImageUrl}
                alt={coupon.rewardName}
                loading={compact ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = REWARD_IMAGE_FALLBACK;
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(9,9,11,0.74))] p-4">
                <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white backdrop-blur-md">
                  Reward Item
                </div>
                <div className="mt-2 line-clamp-2 text-xl font-black leading-tight text-white sm:text-2xl">
                  {coupon.rewardName}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                Coupon Code
              </div>
              <div className="mt-2 break-all text-sm font-black text-black/86 sm:text-base">
                {coupon.code}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] bg-[#f7f9fd] p-5 text-center ring-1 ring-black/5">
              <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                <QrCode className="h-3.5 w-3.5 text-[#ffe486]" />
                Scan To Redeem
              </div>
              <div className="mt-4 flex justify-center">
                <div className="rounded-[28px] bg-white p-3 shadow-[0_18px_46px_rgba(20,20,30,0.12)] ring-1 ring-black/5">
                  <QRCodeCanvas value={coupon.code} size={qrSize} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                  <Gift className="h-3.5 w-3.5 text-[#f5b623]" />
                  มูลค่า
                </div>
                <div className="mt-2 text-lg font-black text-black sm:text-xl">
                  {coupon.valueLabel}
                </div>
              </div>

              <div className="rounded-[24px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                  <Clock3 className="h-3.5 w-3.5 text-black/65" />
                  หมดอายุ
                </div>
                <div className="mt-2 text-lg font-black text-black sm:text-xl">
                  {coupon.expiryLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div
          className={`rounded-[28px] bg-[linear-gradient(180deg,#ffffff_0%,#f2f5fb_100%)] shadow-[0_20px_60px_rgba(20,20,30,0.1)] ring-1 ring-black/5 ${
            compact ? "p-4 sm:p-5" : "p-5"
          }`}
        >
          <div className="flex items-center gap-2 text-base font-black text-black sm:text-lg">
            <ShieldCheck className="h-5 w-5 text-[#0f9f68]" />
            รายละเอียดคูปอง
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[24px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                รางวัลที่แลก
              </div>
              <div className="mt-2 text-lg font-black text-black sm:text-xl">
                {coupon.rewardName}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                  สร้างเมื่อ
                </div>
                <div className="mt-2 text-sm font-black text-black/82 sm:text-base">
                  {formatDateTime(coupon.createdAt)}
                </div>
              </div>

              <div className="rounded-[24px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                  ใช้งานเมื่อ
                </div>
                <div className="mt-2 text-sm font-black text-black/82 sm:text-base">
                  {formatDateTime(coupon.usedAt)}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[#eef2fa] p-4 ring-1 ring-black/5">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/35">
                <CheckCircle2 className="h-3.5 w-3.5 text-black/65" />
                สถานะ
              </div>
              <div className="mt-2 text-lg font-black text-black sm:text-xl">
                {coupon.statusLabel}
              </div>
            </div>
          </div>
        </div>

        {!compact ? (
          <Link
            href="/redeem"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-black text-white shadow-[0_18px_36px_rgba(20,20,30,0.16)] transition hover:scale-[1.01]"
          >
            กลับไปหน้า Redeem
          </Link>
        ) : null}
      </div>
    </div>
  );
}
