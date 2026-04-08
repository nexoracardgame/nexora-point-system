import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cardNo = req.nextUrl.searchParams.get("cardNo");

  if (!cardNo) {
    return NextResponse.json(
      { error: "missing cardNo" },
      { status: 400 }
    );
  }

  const listing = await prisma.marketListing.findFirst({
    where: {
      cardNo,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const seller = listing
    ? await prisma.user.findUnique({
        where: {
          id: listing.sellerId,
        },
      })
    : null;

  const history = await prisma.marketHistory.findMany({
    where: {
      listingId: cardNo,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  const bidders = await prisma.dealRequest.findMany({
    where: {
      cardId: cardNo,
      status: "pending",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  return NextResponse.json({
    owner: listing?.sellerId || "Vault Prime",
    ownerName:
      seller?.name ||
      seller?.lineId ||
      listing?.sellerId ||
      "Vault Prime",
    ownerId: listing?.sellerId || "me",
    history,
    bidders,
  });
}