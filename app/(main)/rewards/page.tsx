import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import RewardRedeemClient from "./RewardRedeemClient";

export const revalidate = 30;
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lineId: true,
      nexPoint: true,
      coin: true,
      name: true,
      displayName: true,
      image: true,
    },
  });

  if (!user) redirect("/login");

  const rewards = await prisma.reward.findMany({
    orderBy: { createdAt: "desc" },
  });

  const displayName =
    user.displayName || user.name || "Duelist";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1c1036_0%,#0a0b12_42%,#05070d_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:px-8 md:py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[28px] border border-amber-400/10 bg-white/[0.04] p-5 shadow-[0_25px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:rounded-[36px] md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(251,191,36,0.14),transparent_35%),radial-gradient(circle_at_10%_10%,rgba(168,85,247,0.14),transparent_30%)]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-amber-300">
                NEXORA REWARD VAULT
              </p>

              <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">
                🎁 Reward Redemption Center
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-zinc-400 md:text-base">
                แลกรางวัลสุดพรีเมียมด้วย NEX และ COIN
                จากระบบสะสมการ์ด NEXORA แบบ luxury marketplace
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[360px]">
              <div className="rounded-3xl border border-amber-400/10 bg-amber-400/10 px-5 py-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/80">
                  NEX Balance
                </div>
                <div className="mt-2 text-2xl font-black text-amber-300">
                  {Number(user.nexPoint).toLocaleString()}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-400/10 bg-cyan-400/10 px-5 py-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">
                  Coin Balance
                </div>
                <div className="mt-2 text-2xl font-black text-cyan-300">
                  {Number(user.coin).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* USER STRIP */}
        <section className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.03] p-4 backdrop-blur-2xl md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/20 bg-gradient-to-br from-amber-300/20 to-yellow-500/20 text-xl font-black text-amber-300">
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                  COMMANDER
                </div>
                <div className="text-xl font-black">
                  {displayName}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
              พร้อมแลกรางวัลจากระบบสะสมระดับโลก ✨
            </div>
          </div>
        </section>

        {/* REWARD GRID CLIENT */}
        <div className="mt-6">
          <RewardRedeemClient
            user={{
              lineId: user.lineId,
              nexPoint: Number(user.nexPoint),
              coin: Number(user.coin),
              name: displayName,
            }}
            rewards={rewards.map((r) => ({
              id: r.id,
              name: r.name,
              imageUrl: r.imageUrl,
              nexCost: r.nexCost,
              coinCost: r.coinCost,
              stock: r.stock,
            }))}
          />
        </div>
      </div>
    </div>
  );
}