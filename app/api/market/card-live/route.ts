import { NextRequest, NextResponse } from "next/server";
import { getMarketListings } from "@/lib/market-listings";
import { prisma } from "@/lib/prisma";

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

  const listings = await getMarketListings();
  const relatedListings = listings
    .filter((item) => String(item.cardNo || "").trim() === cardNo)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const latestListing = relatedListings[0] || null;
  const relatedListingIds = relatedListings.map((item) => item.id);

  const deals = relatedListingIds.length
    ? await prisma.dealRequest.findMany({
        where: {
          cardId: {
            in: relatedListingIds,
          },
        },
        include: {
          buyer: {
            select: {
              id: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : [];

  const bidders = deals
    .filter(
      (item) =>
        latestListing &&
        item.cardId === latestListing.id &&
        ["pending", "accepted", "completed"].includes(item.status)
    )
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      offeredPrice: item.offeredPrice,
      status: item.status,
      createdAt: item.createdAt,
      buyerId: item.buyerId,
      buyerName: getDisplayName(item.buyer),
      buyerImage: item.buyer.image || "/avatar.png",
    }));

  const history = deals
    .filter((item) => ["accepted", "completed"].includes(item.status))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      action: item.status === "completed" ? "sold" : "deal_accepted",
      detail:
        item.status === "completed"
          ? `${getDisplayName(item.buyer)} bought this card for ฿${Number(item.offeredPrice || 0).toLocaleString("th-TH")}`
          : `${getDisplayName(item.buyer)} offered ฿${Number(item.offeredPrice || 0).toLocaleString("th-TH")}`,
      price: item.offeredPrice,
      listingId: item.cardId,
      sellerId: latestListing?.sellerId || null,
      buyerId: item.buyerId,
      cardName: latestListing?.cardName || null,
      imageUrl: latestListing?.imageUrl || null,
    }));

  return NextResponse.json({
    owner: latestListing?.sellerId || null,
    ownerId: latestListing?.sellerId || null,
    ownerName: latestListing?.sellerName || null,
    history,
    bidders,
  });
}
