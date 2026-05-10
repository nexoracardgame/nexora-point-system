import AuctionRoomClient from "./AuctionRoomClient";
import { getAuctionRoomWithBids } from "@/lib/auction-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AuctionRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialPayload = await getAuctionRoomWithBids(id).catch(() => null);

  return <AuctionRoomClient roomId={id} initialPayload={initialPayload} />;
}
