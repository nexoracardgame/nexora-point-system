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
import { authOptions } from "@/lib/auth";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

export default async function RedeemPage() {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  const profile = await getLocalProfileByUserId(userId).catch(() => null);
  const displayName =
    profile?.displayName ||
    String(session?.user?.name || "").trim() ||
    "NEXORA User";
  const profileImage = safeImage(profile?.image || session?.user?.image);

  const coupons: Array<{
    id: string;
    code: string;
    used: boolean;
  }> = [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#16243f_0%,#0b0d13_42%,#05070d_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-5%,rgba(34,211,238,0.18),transparent_22%),radial-gradient(circle_at_0%_100%,rgba(168,85,247,0.12),transparent_25%),radial-gradient(circle_at_100%_100%,rgba(251,191,36,0.1),transparent_24%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,29,0.98),rgba(13,15,24,0.92))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
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
                ตอนนี้หน้า Redeem ถูกย้ายออกจาก DB เก่าแล้ว เพื่อไม่ให้ระบบล่มจาก quota เดิม
                รายการคูปองจะกลับมาแสดงทันทีเมื่อเชื่อมเข้าระบบคูปองชุดใหม่เรียบร้อย
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <Image
                      src={profileImage}
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

              <div className="rounded-[26px] border border-emerald-300/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(16,185,129,0.08))] p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-emerald-200/70">
                  <QrCode className="h-3.5 w-3.5" />
                  พร้อมใช้
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-300 sm:text-3xl">
                  0
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/55">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ใช้แล้ว
                </div>
                <div className="mt-2 text-2xl font-black text-white sm:text-3xl">
                  0
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <Gift className="h-4 w-4 text-amber-300" />
              พร้อมย้ายสู่ระบบใหม่
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              หน้านี้ถูกกันไม่ให้ใช้ DB เก่าแล้ว เพื่อให้เว็บหลักไม่พังอีกจากปริมาณใช้งานเดิม
            </p>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              สถานะชัดเจน
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              ระหว่างที่ระบบคูปองใหม่ยังไม่ต่อครบ หน้า Redeem จะไม่แสดงข้อมูลค้างหรือหลอนจากฐานเก่าอีก
            </p>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              ปลอดภัยบนเว็บจริง
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              หน้าใช้งานจะไม่ล้มจาก Prisma quota เดิมอีก แม้ระบบคูปองใหม่ยังอยู่ระหว่างเชื่อมต่อ
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

          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center text-white/45">
            ยังไม่มีรายการคูปองจากระบบใหม่ในตอนนี้
            <div className="mt-4">
              <Link
                href="/rewards"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-black text-black transition hover:scale-[1.01]"
              >
                กลับไปหน้ารางวัล
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
