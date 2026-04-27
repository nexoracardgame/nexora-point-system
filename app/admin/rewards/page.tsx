import { prisma } from "@/lib/prisma";
import RewardCreateForm from "./RewardCreateForm";
import RewardsTable from "./RewardsTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRewardsPage() {
  const rewards = await prisma.reward.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []);

  return (
    <div className="space-y-5 text-white">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/35">Admin Rewards</div>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Rewards</h1>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-lg font-black sm:text-xl">เพิ่มของรางวัล</h2>
        <div className="mt-4">
          <RewardCreateForm />
        </div>
      </div>

      <RewardsTable
        rewards={rewards.map((reward) => ({
          id: reward.id,
          name: reward.name,
          imageUrl: reward.imageUrl,
          nexCost: reward.nexCost,
          coinCost: reward.coinCost,
          stock: reward.stock,
          createdAt: reward.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
