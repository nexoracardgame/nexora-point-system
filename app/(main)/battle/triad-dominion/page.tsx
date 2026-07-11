import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import TriadDominionClient from "./TriadDominionClient";
import { authOptions } from "@/lib/auth";
import {
  getTriadCatalogSummary,
  triadCards,
  triadSkillRules,
} from "@/lib/triad-dominion";

export default async function TriadDominionPage() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const userId = String(sessionUser?.id || "").trim();

  if (!userId) {
    redirect("/login?callbackUrl=/battle/triad-dominion");
  }

  const summary = getTriadCatalogSummary();
  const cards = triadCards.map((card) => ({
    cardNo: card.cardNo,
    name: card.name,
    kind: card.kind,
    attack: card.attack,
    support: card.support,
    element: card.element,
    skillText: card.skillText,
    sourceImage: card.sourceImage,
  }));
  const reviewSkills = triadSkillRules
    .filter((rule) => rule.needsReview)
    .slice(0, 18)
    .map((rule) => ({
      cardNo: rule.cardNo,
      name: rule.name,
      shape: rule.shape,
      text: rule.text,
      reviewReason: rule.reviewReason || "",
    }));

  return (
    <TriadDominionClient
      cards={cards}
      reviewSkills={reviewSkills}
      summary={summary}
      currentUser={{
        id: userId,
        name: String(sessionUser?.name || "PLAYER"),
        image: String(sessionUser?.image || "/avatar.png"),
        role: String(sessionUser?.role || "USER"),
      }}
    />
  );
}
