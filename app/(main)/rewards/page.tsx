import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import RewardRedeemClient from "./RewardRedeemClient";

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
    },
  });

  if (!user) redirect("/login");

  const rewards = await prisma.reward.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <RewardRedeemClient
      user={{
        lineId: user.lineId,
        nexPoint: Number(user.nexPoint),
        coin: Number(user.coin),
        name: user.name || "Duelist",
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
  );
}