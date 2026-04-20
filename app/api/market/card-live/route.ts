import { NextRequest, NextResponse } from "next/server";
import { getAllLocalDeals } from "@/lib/local-deal-store";
import { getLocalMarketListings } from "@/lib/local-market-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getDisplayName(user?: {
  displayName?: string | null;
  name?: string | null;
}) {
  return user?.displayName || user?.name || "Unknown User";
}

export async function GET(req: NextRequest) {
  const cardNo = String(req.nextUrl.searchParams.get("cardNo") || "").trim();

  if (!cardNo) {
    return NextResponse.json({ error: "missing cardNo" }, { status: 400 });
  }

  const [listings, deals] = await Promise.all([
    getLocalMarketListings(),
    getAllLocalDeals(),
  ]);

  const relatedListings = listings
    .filter((item) => String(item.cardNo || "").trim() === cardNo)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const latestListing = relatedListings[0] || null;
  const relatedListingIds = relatedListings.map((item) => item.id);

  const bidders = deals
    .filter(
      (item) =>
        latestListing &&
        item.cardId === latestListing.id &&
        ["pending", "accepted", "completed"].includes(item.status)
    )
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      offeredPrice: item.offeredPrice,
      status: item.status,
      createdAt: item.createdAt,
      buyerId: item.buyerId,
      buyerName: getDisplayName({
        displayName: item.buyerName,
        name: item.buyerName,
      }),
      buyerImage: item.buyerImage || "/avatar.png",
    }));

  const history = deals
    .filter(
      (item) =>
        relatedListingIds.includes(item.cardId) &&
        ["accepted", "completed"].includes(item.status)
    )
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      action: item.status === "completed" ? "sold" : "deal_accepted",
      detail:
        item.status === "completed"
          ? `${item.buyerName} bought this card for ฿${Number(item.offeredPrice || 0).toLocaleString("th-TH")}`
          : `${item.buyerName} offered ฿${Number(item.offeredPrice || 0).toLocaleString("th-TH")}`,
      price: item.offeredPrice,
      listingId: item.cardId,
      sellerId: item.sellerId,
      buyerId: item.buyerId,
      cardName: item.cardName,
      imageUrl: item.cardImage,
    }));

  return NextResponse.json({
    owner: latestListing?.sellerId || null,
    ownerId: latestListing?.sellerId || null,
    ownerName: latestListing?.sellerName || null,
    history,
    bidders,
  });
}
