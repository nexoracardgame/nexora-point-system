import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String((session?.user as any)?.id || "");

    if (!currentUserId) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const deals = await prisma.dealRequest.findMany({
      where: {
        status: {
          in: ["pending", "accepted"],
        },
        OR: [
          { sellerId: currentUserId },
          { buyerId: currentUserId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const buyerIds = [...new Set(deals.map((d) => d.buyerId))];
    const sellerIds = [...new Set(deals.map((d) => d.sellerId))];
    const cardIds = [...new Set(deals.map((d) => d.cardId))];

    const [buyers, sellers, listings] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: buyerIds } },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      }),
      prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      }),
      prisma.marketListing.findMany({
        where: { id: { in: cardIds } },
        select: {
          id: true,
          cardNo: true,
          cardName: true,
          imageUrl: true,
          status: true,
        },
      }),
    ]);

    const buyerMap = new Map(
      buyers.map((u) => [
        u.id,
        {
          id: u.id,
          name: u.displayName || u.name || "Unknown Buyer",
          image: u.image || "/avatar.png",
        },
      ])
    );

    const sellerMap = new Map(
      sellers.map((u) => [
        u.id,
        {
          id: u.id,
          name: u.displayName || u.name || "Unknown Seller",
          image: u.image || "/avatar.png",
        },
      ])
    );

    const listingMap = new Map(
      listings.map((l) => [l.id, l])
    );

    const result = deals.map((deal) => {
      const buyer = buyerMap.get(deal.buyerId) || {
        id: deal.buyerId,
        name: "Unknown Buyer",
        image: "/avatar.png",
      };

      const seller = sellerMap.get(deal.sellerId) || {
        id: deal.sellerId,
        name: "Unknown Seller",
        image: "/avatar.png",
      };

      const listing = listingMap.get(deal.cardId);

      return {
        id: deal.id,
        status: deal.status,
        offeredPrice: Number(deal.offeredPrice),
        isSeller: currentUserId === deal.sellerId,
        buyer,
        seller,
        cardName: listing?.cardName || "Unknown Card",
        cardNo: String(listing?.cardNo || "001"),
        cardImage:
          listing?.imageUrl ||
          `/cards/${String(listing?.cardNo || "001").padStart(3, "0")}.jpg`,
        listingStatus: listing?.status || "active",
      };
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET DEALS ERROR:", error);
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
