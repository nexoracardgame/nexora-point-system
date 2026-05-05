import BuyCenterClient from "./BuyCenterClient";
import { getBuyMarketListingsByBuyer } from "@/lib/buy-market";
import { getBuyMarketCurrentUser } from "@/lib/buy-market-auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BuyCenterPage() {
  const user = await getBuyMarketCurrentUser();
  const initialListings = user.id
    ? await getBuyMarketListingsByBuyer(user.id).catch(() => [])
    : [];

  return <BuyCenterClient initialListings={initialListings} />;
}
