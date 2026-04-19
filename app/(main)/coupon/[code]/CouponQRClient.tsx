"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { CheckCircle2, Clock3, QrCode, ShieldCheck, Ticket } from "lucide-react";

type Props = {
  coupon: {
    code: string;
    used: boolean;
    createdAt: string;
    usedAt?: string | null;
    rewardName: string;
    rewardType: string;
    userName: string;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CouponQRClient({ coupon }: Props) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#13243c_0%,#090b12_45%,#04060b_100%)] text-white">
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 sm:text-xs">
                <Ticket className="h-3.5 w-3.5" />
                COUPON READY
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                {coupon.used ? "คูปองถูกใช้งานแล้ว" : "เปิด QR ให้พนักงานสแกน"}
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
                แสดงหน้านี้ให้พนักงานที่หน้าร้านหรือเคาน์เตอร์สแกน เพื่อยืนยันการใช้สิทธิ์ของรางวัลใบนี้
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <div
                  className={`rounded-full px-4 py-2 text-xs font-black ${
                    coupon.used
                      ? "border border-white/10 bg-white/10 text-white/70"
                      : "border border-emerald-300/15 bg-emerald-300/10 text-emerald-300"
                  }`}
                >
                  {coupon.used ? "ใช้แล้ว" : "พร้อมใช้งาน"}
                </div>

                <div className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200">
                  {coupon.rewardType}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4 shadow-[0_10px_50px_rgba(0,0,0,0.25)]">
              <div className="rounded-[24px] bg-white p-4">
                <QRCodeCanvas value={coupon.code} size={220} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-lg font-black">
              <QrCode className="h-5 w-5 text-cyan-300" />
              รายละเอียดคูปอง
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  ชื่อผู้ใช้
                </div>
                <div className="mt-2 text-base font-black">{coupon.userName}</div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  ของรางวัล
                </div>
                <div className="mt-2 text-base font-black">{coupon.rewardName}</div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  รหัสคูปอง
                </div>
                <div className="mt-2 break-all text-base font-black">{coupon.code}</div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                  แลกเมื่อ
                </div>
                <div className="mt-2 text-base font-black">
                  {formatDateTime(coupon.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
              <div className="flex items-center gap-2 text-lg font-black">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                สถานะการใช้งาน
              </div>

              <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white/85">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      coupon.used ? "text-white/70" : "text-emerald-300"
                    }`}
                  />
                  {coupon.used ? "คูปองถูกใช้งานแล้ว" : "คูปองยังพร้อมใช้งาน"}
                </div>

                <div className="mt-3 flex items-start gap-2 text-sm text-white/55">
                  <Clock3 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <div>
                    {coupon.used
                      ? `ใช้สิทธิ์เมื่อ ${formatDateTime(coupon.usedAt)}`
                      : "ยังไม่มีการใช้งานคูปองใบนี้"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-2xl">
              <div className="text-sm leading-6 text-white/60">
                หากใช้งานเสร็จแล้ว คูปองจะถูกบันทึกสถานะเป็นใช้แล้วในระบบทันทีเพื่อป้องกันการใช้ซ้ำ
              </div>

              <Link
                href="/redeem"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.09]"
              >
                กลับไปหน้าคูปองทั้งหมด
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
