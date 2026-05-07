import AuctionRoomClient from "./AuctionRoomClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AuctionRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuctionRoomClient roomId={id} />;
}

