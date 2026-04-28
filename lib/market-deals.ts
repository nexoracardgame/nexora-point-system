import { resolveCardDisplayImage } from "@/lib/card-image";
import { prisma } from "@/lib/prisma";

export type DealMember = {
  id: string;
  name: string;
  image: string;
};

export type DealCard = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  createdAt: string;
  offeredPrice: number;
  isSeller: boolean;
  buyer: DealMember;
  seller: DealMember;
  cardName: string;
  cardNo: string;
  cardImage: string;
  listingStatus: string;
};

type DealStatus = DealCard["status"];

function safeMemberName(name?: string | null, fallback = "ผู้ใช้งาน") {
  const value = String(name || "").trim();
  return value || fallback;
}

function safeMemberImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

export async function getMarketDealsForUser(
  currentUserId: string
): Promise<DealCard[]> {
  const normalizedUserId = String(currentUserId || "").trim();

  if (!normalizedUserId) {
    return [];
  }

  const deals = await prisma.dealRequest.findMany({
    where: {
      OR: [{ buyerId: normalizedUserId }, { sellerId: normalizedUserId }],
      status: {
        in: ["pending", "accepted"],
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
      seller: {
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
  });

  const listingIds = Array.from(
    new Set(deals.map((deal) => String(deal.cardId || "").trim()).filter(Boolean))
  );

  const listings = listingIds.length
    ? await prisma.marketListing.findMany({
        where: {
          id: {
            in: listingIds,
          },
        },
        select: {
          id: true,
          cardNo: true,
          cardName: true,
          imageUrl: true,
          status: true,
        },
      })
    : [];

  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

  return deals.map((deal) => {
    const listing = listingMap.get(deal.cardId);
    const cardNo = String(listing?.cardNo || "001");

    return {
      id: deal.id,
      status: deal.status as DealStatus,
      createdAt: deal.createdAt.toISOString(),
      offeredPrice: Number(deal.offeredPrice || 0),
      isSeller: normalizedUserId === deal.sellerId,
      buyer: {
        id: deal.buyer.id,
        name: safeMemberName(
          deal.buyer.displayName || deal.buyer.name,
          "ผู้ซื้อ"
        ),
        image: safeMemberImage(deal.buyer.image),
      },
      seller: {
        id: deal.seller.id,
        name: safeMemberName(
          deal.seller.displayName || deal.seller.name,
          "ผู้ขาย"
        ),
        image: safeMemberImage(deal.seller.image),
      },
      cardName: safeMemberName(listing?.cardName, "การ์ดไม่พบข้อมูล"),
      cardNo,
      cardImage: resolveCardDisplayImage(cardNo, listing?.imageUrl),
      listingStatus: String(listing?.status || "active"),
    };
  });
}
