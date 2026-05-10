import AuctionClient from "./AuctionClient";
import { getAuctionRooms } from "@/lib/auction-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MarketAuctionPage() {
  const initialRooms = await getAuctionRooms().catch(() => []);

  return <AuctionClient initialRooms={initialRooms} />;
}
