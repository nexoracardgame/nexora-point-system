import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import fs from "node:fs";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import {
  getCardSetBonusOption,
  getCardSetCoverImage,
  getCardSetRedemptionChoice,
  parseCardSetNexValue,
} from "@/lib/card-set-redemptions";
import {
  getCollectionCardIds,
  nexoraCollectionSets,
} from "@/lib/nexora-collection-sets";
import CardSetClient from "./CardSetClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const publicDir = path.join(process.cwd(), "public");
const cardSetImageExtensions = ["webp", "jpg", "jpeg", "png"];

function resolveCardSetImage(order: number, fallback: string) {
  const optimizedPath = `/card-sets/optimized/${order}.webp`;
  if (fs.existsSync(path.join(publicDir, optimizedPath))) {
    return optimizedPath;
  }

  for (const extension of cardSetImageExtensions) {
    const imagePath = `/card-sets/${order}.${extension}`;
    if (fs.existsSync(path.join(publicDir, imagePath))) {
      return imagePath;
    }
  }

  return fallback;
}

export default async function CardSetPage() {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  const sets = nexoraCollectionSets
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((set, index) => {
      const fallback = getCardSetCoverImage(set);
      const standardChoice = getCardSetRedemptionChoice(set, "standard");
      const bonusOption = getCardSetBonusOption(set);

      return {
        id: set.id,
        order: set.order,
        name: set.name,
        subtitle: set.subtitle,
        reward: set.reward,
        tier: set.tier,
        stars: set.stars,
        totalCards: getCollectionCardIds(set).length,
        coverImage: resolveCardSetImage(set.order, fallback),
        priorityImage: index < 6,
        nexValue: standardChoice.nexValue || parseCardSetNexValue(set.reward),
        bonusOption,
        finish: set.finish || "normal",
      };
    });

  return <CardSetClient sets={sets} />;
}
