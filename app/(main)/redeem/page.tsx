import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Ticket,
  QrCode,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  Gift,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const revalidate = 30;
export const dynamic = "force-dynamic";

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

function formatDateTime(value?: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function RedeemPage() {
  const session = await getServerSession(authOptions);
  const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();

  if (!userId) {
    redirect("/login");
  }

  const [user, coupons] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        image: true,
        nexPoint: true,
        coin: true,
      },
    }),
    prisma.coupon.findMany({
      where: {
        userId,
      },
      include: {
        reward: {
          select: {
            name: true,
            imageUrl: true,
            nexCost: true,
            coinCost: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  const displayName = user.displayName || user.name || "ผู้ใช้งาน";
  const activeCoupons = coupons.filter((coupon) => !coupon.used).length;
  const usedCoupons = coupons.filter((coupon) => coupon.used).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#16243f_0%,#0b0d13_42%,#05070d_100%)] text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_10%_10%,rgba(251,191,36,0.12),transparent_25%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200 sm:text-xs">
                <Ticket className="h-3.5 w-3.5" />
                REDEEM WALLET
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                คูปองและรางวัลที่คุณแลกไว้
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                ใช้หน้านี้เปิดคูปองหรือ QR ให้พนักงานสแกนที่หน้าร้านหรือบริษัท
                พร้อมเช็กสถานะว่าใบไหนใช้แล้ว ใบไหนยังพร้อมใช้งาน
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <Image
                      src={safeImage(user.image)}
                      alt={displayName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                      ผู้ถือคูปอง
                    </div>
                    <div className="truncate text-base font-black">
                      {displayName}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-emerald-300/12 bg-emerald-300/10 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-emerald-200/70">
                  <QrCode className="h-3.5 w-3.5" />
                  พร้อมใช้งาน
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-300 sm:text-3xl">
                  {activeCoupons.toLocaleString("th-TH")}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.05] p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/55">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ใช้แล้ว
                </div>
                <div className="mt-2 text-2xl font-black text-white sm:text-3xl">
                  {usedCoupons.toLocaleString("th-TH")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <Gift className="h-4 w-4 text-amber-300" />
              เปิดคูปองได้ทันที
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              แตะรายการที่ต้องการ ระบบจะเปิดหน้า QR ของคูปองใบจริงให้ทันที
            </p>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              สถานะชัดเจน
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              แยกชัดว่าใบไหนยังพร้อมใช้ และใบไหนถูกใช้ไปแล้วเมื่อเวลาใด
            </p>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              เหมาะกับการใช้งานหน้าร้าน
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              พนักงานสามารถสแกนจากหน้า QR และตรวจสถานะการใช้สิทธิ์ได้ตรงจากระบบ
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
                รายการคูปองของฉัน
              </h2>
            </div>

            <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-white/55">
              ทั้งหมด {coupons.length.toLocaleString("th-TH")} รายการ
            </div>
          </div>

          {coupons.length === 0 ? (
            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center text-white/45">
              ยังไม่มีคูปองที่แลกไว้ตอนนี้
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {coupons.map((coupon) => {
                const rewardType =
                  coupon.reward.nexCost != null
                    ? "แลกด้วย NEX"
                    : coupon.reward.coinCost != null
                      ? "แลกด้วย COIN"
                      : "คูปอง";

                return (
                  <article
                    key={coupon.id}
                    className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[0_14px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="relative h-[120px] overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.04] sm:w-[152px] sm:min-w-[152px]">
                        <Image
                          src={
                            coupon.reward.imageUrl ||
                            "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"
                          }
                          alt={coupon.reward.name}
                          fill
                          sizes="(max-width: 640px) 100vw, 152px"
                          className="object-contain p-3"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                              coupon.used
                                ? "border border-white/8 bg-white/10 text-white/60"
                                : "border border-emerald-300/15 bg-emerald-300/10 text-emerald-300"
                            }`}
                          >
                            {coupon.used ? "ใช้แล้ว" : "พร้อมใช้งาน"}
                          </div>

                          <div className="rounded-full border border-cyan-300/12 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80">
                            {rewardType}
                          </div>
                        </div>

                        <h3 className="mt-3 text-xl font-black sm:text-2xl">
                          {coupon.reward.name}
                        </h3>

                        <div className="mt-3 grid gap-2 text-sm text-white/58 sm:grid-cols-2">
                          <div>
                            <span className="text-white/32">รหัสคูปอง</span>
                            <div className="mt-1 break-all font-semibold text-white/88">
                              {coupon.code}
                            </div>
                          </div>

                          <div>
                            <span className="text-white/32">แลกเมื่อ</span>
                            <div className="mt-1 font-semibold text-white/88">
                              {formatDateTime(coupon.createdAt)}
                            </div>
                          </div>

                          <div>
                            <span className="text-white/32">หมดอายุ</span>
                            <div className="mt-1 font-semibold text-white/88">
                              ใช้ได้จนกว่าจะใช้งาน
                            </div>
                          </div>

                          <div>
                            <span className="text-white/32">ใช้สิทธิ์เมื่อ</span>
                            <div className="mt-1 font-semibold text-white/88">
                              {coupon.usedAt
                                ? formatDateTime(coupon.usedAt)
                                : "ยังไม่ถูกใช้งาน"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link
                            href={`/coupon/${coupon.code}`}
                            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                              coupon.used
                                ? "border border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/[0.09]"
                                : "bg-gradient-to-r from-cyan-400 to-emerald-300 text-black hover:scale-[1.01]"
                            }`}
                          >
                            <QrCode className="h-4 w-4" />
                            {coupon.used ? "ดูรายละเอียดคูปอง" : "เปิด QR เพื่อใช้งาน"}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
