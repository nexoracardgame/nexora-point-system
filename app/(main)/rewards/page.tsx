import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import RewardsShowcaseClient from "./RewardsShowcaseClient";

export const revalidate = 30;
export const dynamic = "force-dynamic";

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

function safeDisplayName(name?: string | null, displayName?: string | null) {
  return displayName || name || "NEXORA User";
}

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = (session?.user || {}) as {
    id?: string;
    lineId?: string;
    name?: string | null;
    image?: string | null;
    nexPoint?: number;
    coin?: number;
  };

  const userId = String(sessionUser.id || "").trim();

  if (!userId) {
    redirect("/login");
  }

  let user:
    | {
        lineId: string;
        nexPoint: number;
        coin: number;
        name: string | null;
        displayName?: string | null;
        image: string | null;
      }
    | null = null;

  let rewards: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    nexCost: number | null;
    coinCost: number | null;
    stock: number;
  }> = [];

  try {
    [user, rewards] = await Promise.all([
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
  } catch {
    user = null;
    rewards = [];
  }

  const safeUser = user || {
    lineId: String(sessionUser.lineId || userId),
    nexPoint: Number(sessionUser.nexPoint || 0),
    coin: Number(sessionUser.coin || 0),
    name: sessionUser.name || "NEXORA User",
    displayName: sessionUser.name || "NEXORA User",
    image: sessionUser.image || "/avatar.png",
  };

  return (
    <RewardsShowcaseClient
      displayName={safeDisplayName(safeUser.name, safeUser.displayName)}
      profileImage={safeImage(safeUser.image)}
      nexPoint={Number(safeUser.nexPoint || 0)}
      coin={Number(safeUser.coin || 0)}
      rewards={rewards}
    />
  );
}
