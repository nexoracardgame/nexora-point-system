import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveCardDisplayImage, sanitizeCardImageUrl } from "@/lib/card-image";
import { getDealChatRoomId } from "@/lib/deal-chat";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { createLocalNotification } from "@/lib/local-notification-store";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import type { BuyDealCard, BuyMarketListing } from "@/lib/buy-market-types";

type UserLike = {
  id: string;
  displayName?: string | null;
  name?: string | null;
  image?: string | null;
};

type MarketListingLike = {
  id: string;
  cardNo: string;
  price: number;
  sellerId: string;
  status: string;
  likes: number;
  views: number;
  createdAt: Date;
  cardName?: string | null;
  imageUrl?: string | null;
  rarity?: string | null;
  seller?: UserLike | null;
};

type DealLike = {
  id: string;
  cardId: string;
  buyerId: string;
  sellerId: string;
  offeredPrice: number;
  status: string;
  createdAt: Date;
  buyer: UserLike;
  seller: UserLike;
};

function hasDatabaseConfig() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

function safeName(user?: UserLike | null, fallback = "NEXORA User") {
  return String(user?.displayName || user?.name || "").trim() || fallback;
}

function safeImage(user?: UserLike | null) {
  return String(user?.image || "").trim() || "/avatar.png";
}

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isWantedStatus(value?: string | null) {
  return normalizeStatus(value) === "wanted";
}

function normalizeCardNo(value: string | number) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? String(Number(digits)).padStart(3, "0") : "";
}

function toBuyListingRecord(item: MarketListingLike): BuyMarketListing {
  return {
    id: item.id,
    cardNo: normalizeCardNo(item.cardNo) || "001",
    cardName: item.cardName || null,
    imageUrl: sanitizeCardImageUrl(item.imageUrl),
    rarity: item.rarity || null,
    offerPrice: Number(item.price || 0),
    buyerId: item.sellerId,
    buyerName: safeName(item.seller, "ผู้รับซื้อ"),
    buyerImage: safeImage(item.seller),
    status: String(item.status || "wanted"),
    likes: Number(item.likes || 0),
    views: Number(item.views || 0),
    createdAt: item.createdAt.toISOString(),
  };
}

function toBuyDealCard(
  deal: DealLike,
  listing: MarketListingLike,
  currentUserId: string
): BuyDealCard {
  const cardNo = normalizeCardNo(listing.cardNo) || "001";

  return {
    id: deal.id,
    status: normalizeStatus(deal.status) as BuyDealCard["status"],
    createdAt: deal.createdAt.toISOString(),
    offeredPrice: Number(deal.offeredPrice || listing.price || 0),
    isBuyer: deal.buyerId === currentUserId,
    isResponder: deal.sellerId === currentUserId,
    buyer: {
      id: deal.buyer.id,
      name: safeName(deal.buyer, "ผู้รับซื้อ"),
      image: safeImage(deal.buyer),
    },
    seller: {
      id: deal.seller.id,
      name: safeName(deal.seller, "ผู้เสนอขาย"),
      image: safeImage(deal.seller),
    },
    cardName:
      String(listing.cardName || "").trim() || `Card #${cardNo}`,
    cardNo,
    cardImage: resolveCardDisplayImage(cardNo, listing.imageUrl),
    listingStatus: String(listing.status || "wanted"),
  };
}

export async function getBuyMarketListings() {
  if (!hasDatabaseConfig()) {
    return [];
  }

  try {
    const rows = await prisma.marketListing.findMany({
      where: {
        status: {
          equals: "wanted",
          mode: "insensitive",
        },
      },
      include: {
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

    return rows.map(toBuyListingRecord);
  } catch {
    return [];
  }
}

export async function getBuyMarketListingById(id: string) {
  const safeId = String(id || "").trim();
  if (!safeId || !hasDatabaseConfig()) {
    return null;
  }

  try {
    const listing = await prisma.marketListing.findUnique({
      where: {
        id: safeId,
      },
      include: {
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

    return listing && isWantedStatus(listing.status)
      ? toBuyListingRecord(listing)
      : null;
  } catch {
    return null;
  }
}

export async function getBuyMarketListingsByBuyer(buyerId: string) {
  const safeBuyerId = String(buyerId || "").trim();
  if (!safeBuyerId || !hasDatabaseConfig()) {
    return [];
  }

  try {
    const rows = await prisma.marketListing.findMany({
      where: {
        sellerId: safeBuyerId,
        status: {
          equals: "wanted",
          mode: "insensitive",
        },
      },
      include: {
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

    return rows.map(toBuyListingRecord);
  } catch {
    return [];
  }
}

export async function createBuyMarketListing(input: {
  cardNo: string;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  offerPrice: number;
  buyerId: string;
}) {
  const cardNo = normalizeCardNo(input.cardNo);
  const buyerId = String(input.buyerId || "").trim();
  const offerPrice = Number(input.offerPrice || 0);

  if (!hasDatabaseConfig()) {
    throw new Error("database-unavailable");
  }

  if (!cardNo || !buyerId || !Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw new Error("invalid-buy-listing");
  }

  const created = await prisma.marketListing.create({
    data: {
      cardNo,
      serialNo: null,
      price: offerPrice,
      sellerId: buyerId,
      status: "wanted",
      cardName: String(input.cardName || "").trim() || null,
      imageUrl: sanitizeCardImageUrl(input.imageUrl),
      rarity: String(input.rarity || "").trim() || null,
    },
    include: {
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

  return toBuyListingRecord(created);
}

export async function updateBuyMarketListing(input: {
  id: string;
  buyerId: string;
  offerPrice: number;
}) {
  const id = String(input.id || "").trim();
  const buyerId = String(input.buyerId || "").trim();
  const offerPrice = Number(input.offerPrice || 0);

  if (!id || !buyerId || !Number.isFinite(offerPrice) || offerPrice <= 0) {
    throw new Error("invalid-buy-listing-update");
  }

  const updated = await prisma.marketListing.updateMany({
    where: {
      id,
      sellerId: buyerId,
      status: {
        equals: "wanted",
        mode: "insensitive",
      },
    },
    data: {
      price: offerPrice,
    },
  });

  if (updated.count === 0) {
    throw new Error("buy-listing-not-found");
  }

  return getBuyMarketListingById(id);
}

export async function deleteBuyMarketListing(input: {
  id: string;
  buyerId: string;
}) {
  const id = String(input.id || "").trim();
  const buyerId = String(input.buyerId || "").trim();

  if (!id || !buyerId) {
    throw new Error("invalid-buy-listing-delete");
  }

  const updated = await prisma.marketListing.updateMany({
    where: {
      id,
      sellerId: buyerId,
      status: {
        equals: "wanted",
        mode: "insensitive",
      },
    },
    data: {
      status: "buy-cancelled",
    },
  });

  if (updated.count === 0) {
    throw new Error("buy-listing-not-found");
  }
}

export async function createBuyDealRequest(input: {
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  offeredPrice: number;
}) {
  const listingId = String(input.listingId || "").trim();
  const sellerId = String(input.sellerId || "").trim();
  const offeredPrice = Number(input.offeredPrice || 0);

  if (!listingId || !sellerId || !Number.isFinite(offeredPrice) || offeredPrice <= 0) {
    throw new Error("invalid-buy-deal");
  }

  const listing = await prisma.marketListing.findUnique({
    where: {
      id: listingId,
    },
    include: {
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

  if (!listing || !isWantedStatus(listing.status)) {
    throw new Error("buy-listing-not-found");
  }

  if (listing.sellerId === sellerId) {
    throw new Error("self-buy-deal");
  }

  const existingOpenDeal = await prisma.dealRequest.findFirst({
    where: {
      cardId: listing.id,
      buyerId: listing.sellerId,
      sellerId,
      status: {
        in: ["pending", "accepted"],
      },
    },
  });

  if (existingOpenDeal) {
    throw new Error("buy-deal-exists");
  }

  const deal = await prisma.dealRequest.create({
    data: {
      cardId: listing.id,
      buyerId: listing.sellerId,
      sellerId,
      offeredPrice,
    },
  });

  await createLocalNotification({
    userId: listing.sellerId,
    type: "deal",
    title: `${input.sellerName || "ผู้ใช้งาน"} เสนอขายการ์ดให้คุณ`,
    body: `${String(listing.cardName || "").trim() || `Card #${normalizeCardNo(listing.cardNo)}`} ราคา ฿${offeredPrice.toLocaleString("th-TH")}`,
    href: "/buy-market/deals",
    image: input.sellerImage || "/avatar.png",
  }).catch(() => undefined);

  return deal;
}

export async function getBuyMarketDealsForUser(currentUserId: string) {
  const safeUserId = String(currentUserId || "").trim();
  if (!safeUserId || !hasDatabaseConfig()) {
    return [];
  }

  const deals = await prisma.dealRequest.findMany({
    where: {
      OR: [{ buyerId: safeUserId }, { sellerId: safeUserId }],
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

  const listingIds = Array.from(new Set(deals.map((deal) => deal.cardId)));
  const listings = listingIds.length
    ? await prisma.marketListing.findMany({
        where: {
          id: {
            in: listingIds,
          },
          status: {
            equals: "wanted",
            mode: "insensitive",
          },
        },
        include: {
          seller: {
            select: {
              id: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
      })
    : [];
  const listingMap = new Map(listings.map((item) => [item.id, item]));

  return deals
    .map((deal) => {
      const listing = listingMap.get(deal.cardId);
      return listing ? toBuyDealCard(deal, listing, safeUserId) : null;
    })
    .filter((deal): deal is BuyDealCard => Boolean(deal));
}

export async function actOnBuyDeal(input: {
  dealId: string;
  action: "accept" | "reject" | "cancel";
  actorId: string;
}) {
  const dealId = String(input.dealId || "").trim();
  const actorId = String(input.actorId || "").trim();

  if (!dealId || !actorId) {
    throw new Error("invalid-buy-deal-action");
  }

  if (!hasDatabaseConfig()) {
    throw new Error("database-unavailable");
  }

  const deal = await prisma.dealRequest.findUnique({
    where: {
      id: dealId,
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
  });

  const listing = deal
    ? await prisma.marketListing.findUnique({
        where: {
          id: deal.cardId,
        },
      })
    : null;

  if (!deal || !listing || !isWantedStatus(listing.status)) {
    throw new Error("buy-deal-not-found");
  }

  if (input.action === "cancel") {
    if (deal.sellerId !== actorId || normalizeStatus(deal.status) !== "pending") {
      throw new Error("forbidden");
    }

    await cleanupDealChat(deal.id).catch(() => undefined);
    await prisma.dealRequest.delete({
      where: {
        id: deal.id,
      },
    });

    await createLocalNotification({
      userId: deal.buyerId,
      type: "deal",
      title: `${safeName(deal.seller, "ผู้เสนอขาย")} ยกเลิกข้อเสนอขาย`,
      body: String(listing.cardName || "").trim() || `Card #${normalizeCardNo(listing.cardNo)}`,
      href: "/buy-market/deals",
      image: safeImage(deal.seller),
    }).catch(() => undefined);

    return { success: true, action: "cancel" as const, removedDealId: deal.id };
  }

  if (deal.buyerId !== actorId) {
    throw new Error("forbidden");
  }

  if (input.action === "reject") {
    await cleanupDealChat(deal.id).catch(() => undefined);
    await prisma.dealRequest.delete({
      where: {
        id: deal.id,
      },
    });

    await createLocalNotification({
      userId: deal.sellerId,
      type: "deal",
      title: `${safeName(deal.buyer, "ผู้รับซื้อ")} ปฏิเสธข้อเสนอขาย`,
      body: String(listing.cardName || "").trim() || `Card #${normalizeCardNo(listing.cardNo)}`,
      href: "/buy-market/deals",
      image: safeImage(deal.buyer),
    }).catch(() => undefined);

    return { success: true, action: "reject" as const, removedDealId: deal.id };
  }

  const updatedDeal = await prisma.dealRequest.update({
    where: {
      id: deal.id,
    },
    data: {
      status: "accepted",
    },
  });

  const supabase = getServerSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("dm_room").upsert({
        roomid: getDealChatRoomId(deal.id),
        usera: deal.buyer.id,
        userb: deal.seller.id,
        useraname: safeName(deal.buyer, "Buyer"),
        useraimage: safeImage(deal.buyer),
        userbname: safeName(deal.seller, "Seller"),
        userbimage: safeImage(deal.seller),
        updatedat: new Date().toISOString(),
      });
    } catch {}
  }

  await createLocalNotification({
    userId: deal.sellerId,
    type: "deal",
    title: `${safeName(deal.buyer, "ผู้รับซื้อ")} ตอบรับข้อเสนอขายของคุณ`,
    body: "เปิดห้องแชทดีลรับซื้อแล้ว",
    href: `/buy-market/deals/chat/${deal.id}`,
    image: safeImage(deal.buyer),
  }).catch(() => undefined);

  return { success: true, action: "accept" as const, deal: updatedDeal };
}
