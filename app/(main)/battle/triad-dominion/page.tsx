import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import TriadDominionClient from "./TriadDominionClient";
import { authOptions } from "@/lib/auth";
import {
  getTriadCatalogSummary,
  triadCards,
  triadSkillRules,
} from "@/lib/triad-dominion";

export default async function TriadDominionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const userId = String(sessionUser?.id || "").trim();

  if (!userId) {
    const query = await searchParams;
    const params = new URLSearchParams();
    for (const key of ["room", "spectate"]) {
      const value = query?.[key];
      if (typeof value === "string") params.set(key, value);
    }
    redirect(`/game/login?callbackUrl=${encodeURIComponent(`/game${params.size ? `?${params}` : ""}`)}`);
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
