import { prisma } from "@/lib/prisma";
import RewardsTable from "./RewardsTable";
import RewardCreateForm from "./RewardCreateForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRewardsPage() {
  let rewards: Awaited<ReturnType<typeof prisma.reward.findMany>> = [];

  try {
    rewards = await prisma.reward.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    rewards = [];
  }

  return (
    <div style={{ color: "#fff" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: "bold", margin: 0 }}>
          🎁 Rewards
        </h1>
      </div>

      <div
        style={{
          marginBottom: 24,
          background: "#111",
          border: "1px solid #222",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>เพิ่มของรางวัล</h2>
        <RewardCreateForm />
      </div>

      <RewardsTable
        rewards={rewards.map((reward: any) => ({
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
