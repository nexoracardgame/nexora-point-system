import { NextRequest, NextResponse } from "next/server";
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

  const relatedListings = await prisma.marketListing.findMany({
    where: {
      cardNo,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      sellerId: true,
      price: true,
      status: true,
      createdAt: true,
      seller: {
        select: {
          id: true,
          displayName: true,
          name: true,
          image: true,
        },
      },
    },
  });

  const latestListing = relatedListings[0] || null;
  const relatedListingIds = relatedListings.map((item) => item.id);

  const [history, bidders] = await Promise.all([
    relatedListingIds.length
      ? prisma.marketHistory.findMany({
          where: {
            listingId: {
              in: relatedListingIds,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        })
      : Promise.resolve([]),
    latestListing
      ? prisma.dealRequest.findMany({
          where: {
            cardId: latestListing.id,
            status: {
              in: ["pending", "accepted", "completed"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
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
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    owner: latestListing?.sellerId || null,
    ownerId: latestListing?.sellerId || null,
    ownerName: latestListing?.seller
      ? getDisplayName(latestListing.seller)
      : null,
    history,
    bidders: bidders.map((item) => ({
      id: item.id,
      offeredPrice: item.offeredPrice,
      status: item.status,
      createdAt: item.createdAt,
      buyerId: item.buyerId,
      buyerName: getDisplayName(item.buyer),
      buyerImage: item.buyer.image || "/avatar.png",
    })),
  });
}
