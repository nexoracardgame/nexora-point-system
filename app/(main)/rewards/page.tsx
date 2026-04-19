import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Gift, Gem, Coins, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import RewardRedeemButtons from "./RewardRedeemButtons";

export const revalidate = 30;
export const dynamic = "force-dynamic";

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

function safeDisplayName(name?: string | null, displayName?: string | null) {
  return displayName || name || "ผู้ใช้งาน";
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("th-TH");
}

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();

  if (!userId) {
    redirect("/login");
  }

  const [user, rewards] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        lineId: true,
        nexPoint: true,
        coin: true,
        name: true,
        displayName: true,
        image: true,
      },
    }),
    prisma.reward.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        imageUrl: true,
        nexCost: true,
        coinCost: true,
        stock: true,
      },
    }),
  ]);

  if (!user?.lineId) {
    redirect("/login");
  }

  const displayName = safeDisplayName(user.name, user.displayName);
  const profileImage = safeImage(user.image);
  const nexPoint = Number(user.nexPoint || 0);
  const coin = Number(user.coin || 0);
  const rewardCount = rewards.length;
  const availableCount = rewards.filter((reward) => reward.stock > 0).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1138_0%,#0a0b12_42%,#05070d_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-5%,rgba(168,85,247,0.24),transparent_26%),radial-gradient(circle_at_0%_100%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_100%_100%,rgba(251,191,36,0.12),transparent_22%)]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[260px] w-[260px] rounded-full bg-violet-500/12 blur-3xl sm:h-[360px] sm:w-[360px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,17,35,0.96),rgba(15,14,24,0.9))] p-4 shadow-[0_25px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[34px] sm:p-6 xl:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(251,191,36,0.14),transparent_30%),radial-gradient(circle_at_8%_18%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.1),transparent_35%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-violet-100 sm:text-xs">
                <Gift className="h-3.5 w-3.5" />
                NEXORA REWARDS
              </div>

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                ศูนย์แลกรางวัลระดับพรีเมียม
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                ใช้ <span className="font-bold text-amber-300">NEX</span> และ{" "}
                <span className="font-bold text-cyan-300">COIN</span> แลกรับรางวัล,
                คูปอง และสิทธิพิเศษจากระบบ NEXORA แบบลื่นขึ้นทั้งคอมและมือถือ
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    รางวัลทั้งหมด
                  </div>
                  <div className="mt-1 text-xl font-black text-white">
                    {formatNumber(rewardCount)}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/10 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-200/70">
                    พร้อมแลก
                  </div>
                  <div className="mt-1 text-xl font-black text-emerald-300">
                    {formatNumber(availableCount)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
              <div className="rounded-[26px] border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
                      ผู้ใช้งาน
                    </div>
                    <div className="truncate text-base font-black">
                      {displayName}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-amber-300/12 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(251,191,36,0.08))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-amber-200/70">
                  <Gem className="h-3.5 w-3.5" />
                  NEX คงเหลือ
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300 sm:text-3xl">
                  {formatNumber(nexPoint)}
                </div>
              </div>

              <div className="rounded-[26px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(34,211,238,0.08))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">
                  <Coins className="h-3.5 w-3.5" />
                  COIN คงเหลือ
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-300 sm:text-3xl">
                  {formatNumber(coin)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              แลกแล้วรับคูปองทันที
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              ระบบจะพาไปยังหน้าคูปองหรือสิทธิ์ที่ได้รับทันทีหลังแลกสำเร็จ
            </p>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <Sparkles className="h-4 w-4 text-violet-300" />
              ใช้ได้ทั้ง NEX และ COIN
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              แต่ละรางวัลสามารถตั้งแลกได้หลายสกุลเพื่อให้ใช้งานคล่องขึ้น
            </p>
          </div>

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-white/88">
              <Ticket className="h-4 w-4 text-amber-300" />
              สต็อกอัปเดตตามจริง
            </div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              จำนวนคงเหลือของแต่ละรางวัลจะแสดงจากระบบจริง ไม่ใช่ค่าหลอก
            </p>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/35">
                REWARD LIST
              </div>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                เลือกรางวัลที่ต้องการแลก
              </h2>
            </div>

            <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-white/55">
              แตะเพื่อแลกรางวัลได้ทันที
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rewards.map((reward) => (
              <article
                key={reward.id}
                className="group overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,16,30,0.98),rgba(15,13,24,0.94))] p-3 shadow-[0_14px_60px_rgba(0,0,0,0.3)] transition duration-500 hover:-translate-y-1 hover:border-amber-300/18 hover:shadow-[0_20px_80px_rgba(0,0,0,0.4)] sm:p-4"
              >
                <div className="relative overflow-hidden rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.14),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.03))]">
                  <div className="absolute left-3 top-3 z-10 rounded-full border border-white/8 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 backdrop-blur-xl">
                    คงเหลือ {formatNumber(reward.stock)}
                  </div>

                  <div className="relative aspect-[4/3]">
                    <Image
                      src={
                        reward.imageUrl ||
                        "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200"
                      }
                      alt={reward.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-contain p-4 transition duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">
                      {reward.name}
                    </h3>
                    <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/35">
                      รางวัลในระบบ
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {reward.nexCost != null ? (
                    <div className="rounded-[24px] border border-amber-300/10 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(251,191,36,0.07))] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-amber-200/70">
                        <Gem className="h-3.5 w-3.5" />
                        NEX
                      </div>
                      <div className="mt-2 text-2xl font-black text-amber-300">
                        {formatNumber(reward.nexCost)}
                      </div>
                    </div>
                  ) : null}

                  {reward.coinCost != null ? (
                    <div className="rounded-[24px] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(34,211,238,0.07))] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">
                        <Coins className="h-3.5 w-3.5" />
                        COIN
                      </div>
                      <div className="mt-2 text-2xl font-black text-cyan-300">
                        {formatNumber(reward.coinCost)}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <RewardRedeemButtons
                    rewardId={reward.id}
                    lineId={user.lineId}
                    rewardName={reward.name}
                    stock={reward.stock}
                    userNexPoint={nexPoint}
                    userCoin={coin}
                    nexCost={reward.nexCost}
                    coinCost={reward.coinCost}
                  />
                </div>
              </article>
            ))}
          </div>

          {rewards.length === 0 ? (
            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center text-white/45">
              ยังไม่มีรางวัลในระบบตอนนี้
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
