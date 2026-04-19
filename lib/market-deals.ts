import { prisma } from "@/lib/prisma";

export type DealMember = {
  id: string;
  name: string;
  image: string;
};

export type DealCard = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "completed";
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
      status: {
        in: ["pending", "accepted"],
      },
      OR: [{ sellerId: normalizedUserId }, { buyerId: normalizedUserId }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (deals.length === 0) {
    return [];
  }

  const buyerIds = [...new Set(deals.map((deal) => deal.buyerId))];
  const sellerIds = [...new Set(deals.map((deal) => deal.sellerId))];
  const listingIds = [...new Set(deals.map((deal) => deal.cardId))];

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
      where: { id: { in: listingIds } },
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
    buyers.map((user) => [
      user.id,
      {
        id: user.id,
        name: safeMemberName(user.displayName || user.name, "ผู้ซื้อ"),
        image: safeMemberImage(user.image),
      },
    ])
  );

  const sellerMap = new Map(
    sellers.map((user) => [
      user.id,
      {
        id: user.id,
        name: safeMemberName(user.displayName || user.name, "ผู้ขาย"),
        image: safeMemberImage(user.image),
      },
    ])
  );

  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

  return deals.map((deal) => {
    const buyer = buyerMap.get(deal.buyerId) || {
      id: deal.buyerId,
      name: "ผู้ซื้อ",
      image: "/avatar.png",
    };

    const seller = sellerMap.get(deal.sellerId) || {
      id: deal.sellerId,
      name: "ผู้ขาย",
      image: "/avatar.png",
    };

    const listing = listingMap.get(deal.cardId);
    const cardNo = String(listing?.cardNo || "001");

    return {
      id: deal.id,
      status: deal.status as DealStatus,
      offeredPrice: Number(deal.offeredPrice || 0),
      isSeller: normalizedUserId === deal.sellerId,
      buyer,
      seller,
      cardName: safeMemberName(listing?.cardName, "การ์ดไม่พบข้อมูล"),
      cardNo,
      cardImage:
        String(listing?.imageUrl || "").trim() ||
        `/cards/${cardNo.padStart(3, "0")}.jpg`,
      listingStatus: String(listing?.status || "active"),
    };
  });
}
