import MarketEmbedClient from "./MarketEmbedClient";
import { getActiveMarketViewItems } from "@/lib/market-feed";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MarketEmbedPage() {
  const items = await getActiveMarketViewItems(80).catch(() => []);

  return <MarketEmbedClient items={items} />;
}
