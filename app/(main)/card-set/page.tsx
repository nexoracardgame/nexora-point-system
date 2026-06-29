import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import fs from "node:fs";
import path from "node:path";
import { authOptions } from "@/lib/auth";
import {
  getCardSetBonusOptions,
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

function publicAssetPath(assetPath: string) {
  return path.join(publicDir, ...assetPath.split("/").filter(Boolean));
}

function withAssetVersion(assetPath: string) {
  try {
    const stat = fs.statSync(publicAssetPath(assetPath));
    return `${assetPath}?v=${Math.floor(stat.mtimeMs)}`;
  } catch {
    return assetPath;
  }
}

function resolveCardSetImages(order: number, fallback: string) {
  const optimizedPath = `/card-sets/optimized/${order}.webp`;
  const sourceCandidates = cardSetImageExtensions.map(
    (extension) => `/card-sets/${order}.${extension}`
  );
  const existingSource =
    sourceCandidates.find((imagePath) => fs.existsSync(publicAssetPath(imagePath))) ||
    fallback;

  if (fs.existsSync(publicAssetPath(optimizedPath))) {
    return {
      coverImage: withAssetVersion(optimizedPath),
      fallbackImage: withAssetVersion(existingSource),
    };
  }

  return {
    coverImage: withAssetVersion(existingSource),
    fallbackImage: fallback,
  };
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
      const images = resolveCardSetImages(set.order, fallback);
      const standardChoice = getCardSetRedemptionChoice(set, "standard");
      const bonusOptions = getCardSetBonusOptions(set);

      return {
        id: set.id,
        order: set.order,
        name: set.name,
        subtitle: set.subtitle,
        reward: set.reward,
        tier: set.tier,
        stars: set.stars,
        totalCards: getCollectionCardIds(set).length,
        coverImage: images.coverImage,
        fallbackImage: images.fallbackImage,
        priorityImage: index < 6,
        nexValue: standardChoice.nexValue || parseCardSetNexValue(set.reward),
        bonusOptions,
        finish: set.finish || "normal",
      };
    });

  return <CardSetClient sets={sets} />;
}
