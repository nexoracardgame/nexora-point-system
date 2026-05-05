import BuyMarketClient from "./BuyMarketClient";
import { getBuyMarketListings } from "@/lib/buy-market";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BuyMarketPage() {
  const initialListings = await getBuyMarketListings().catch(() => []);

  return <BuyMarketClient initialListings={initialListings} />;
}
