import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cardRareRewards } from "@/lib/card-rare-rewards";
import CardRareClient from "./CardRareClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CardRarePage() {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  const rewards = cardRareRewards
    .slice()
    .sort((a, b) => {
      const valueDiff =
        Math.max(...b.options.map((option) => option.nexValue)) -
        Math.max(...a.options.map((option) => option.nexValue));
      if (valueDiff !== 0) return valueDiff;
      return Number(a.cardNo) - Number(b.cardNo);
    })
    .map((reward, index) => ({
      ...reward,
      maxNexValue: Math.max(...reward.options.map((option) => option.nexValue)),
      priorityImage: index < 10,
    }));

  return <CardRareClient rewards={rewards} />;
}
