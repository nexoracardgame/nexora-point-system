import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-auth";
import {
  getCardSetBonusOptions,
  getCardSetRedemptionChoice,
  parseCardSetNexValue,
} from "@/lib/card-set-redemptions";
import { getCardSetImageUrls } from "@/lib/card-set-images";
import {
  getCollectionCardIds,
  nexoraCollectionSets,
} from "@/lib/nexora-collection-sets";
import CardSetClient from "./CardSetClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CardSetPage() {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  const role = String(
    (session?.user as { role?: string } | undefined)?.role || ""
  );

  const sets = nexoraCollectionSets
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((set, index) => {
      const images = getCardSetImageUrls(set.order);
      const standardChoice = getCardSetRedemptionChoice(set, "standard");
      const bonusOptions = getCardSetBonusOptions(set);

      return {
        id: set.id,
        order: set.order,
        name: set.name,
        subtitle: set.subtitle,
        story: set.story,
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

  return (
    <CardSetClient
      sets={sets}
      canUseAdminMode={isStaffRole(role)}
    />
  );
}
