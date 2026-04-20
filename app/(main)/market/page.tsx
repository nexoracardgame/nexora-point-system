import { getLocalMarketListings } from "@/lib/local-market-store";
import { normalizeMarketListingView } from "@/lib/market-listing-view";
import MarketDashboardTFT from "./MarketDashboardTFT";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function loadListings() {
  const localItems = await getLocalMarketListings();
  return localItems
    .filter((item) => String(item.status || "").toLowerCase() !== "sold")
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )
    .slice(0, 24)
    .map((item) => normalizeMarketListingView(item));
}

export default async function MarketPage() {
  return (
    <MarketDashboardTFT initialItems={await loadListings()} initialItemsLoaded />
  );
}
