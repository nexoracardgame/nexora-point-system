import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import DealsClient from "./DealsClient";
import { authOptions } from "@/lib/auth";
import { getMarketDealsForUser } from "@/lib/market-deals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DealsPage() {
  const session = await getServerSession(authOptions);
  const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();

  if (!userId) {
    redirect("/login");
  }

  const initialDeals = await getMarketDealsForUser(userId);

  return <DealsClient initialDeals={initialDeals} />;
}
