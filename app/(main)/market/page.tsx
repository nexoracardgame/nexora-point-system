import MarketDashboardTFT from "./MarketDashboardTFT";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveMarketViewItems } from "@/lib/market-feed";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type MarketSession = {
  user?: {
    id?: string | null;
    lineId?: string | null;
  };
};

export default async function MarketPage() {
  const [initialItems, session] = await Promise.all([
    getActiveMarketViewItems().catch(() => []),
    getServerSession(authOptions) as Promise<MarketSession | null>,
  ]);
  const initialViewerKey =
    String(session?.user?.id || session?.user?.lineId || "guest").trim() ||
    "guest";

  return (
    <MarketDashboardTFT
      initialItems={initialItems}
      initialItemsLoaded
      initialViewerKey={initialViewerKey}
    />
  );
}
