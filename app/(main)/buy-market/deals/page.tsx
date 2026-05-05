import BuyDealsClient from "./BuyDealsClient";
import { getBuyMarketDealsForUser } from "@/lib/buy-market";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BuyDealsPage() {
  const user = await getBuyMarketCurrentUser();
  const initialDeals = user.id
    ? await getBuyMarketDealsForUser(user.id).catch(() => [])
    : [];

  return <BuyDealsClient initialDeals={initialDeals} />;
}
