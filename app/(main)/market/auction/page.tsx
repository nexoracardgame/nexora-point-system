import AuctionClient from "./AuctionClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function MarketAuctionPage() {
  return <AuctionClient />;
}

