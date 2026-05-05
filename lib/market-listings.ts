import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeCardImageUrl } from "@/lib/card-image";
import {
  createLocalMarketListing,
  deleteLocalMarketListing,
  getLocalMarketListingById,
  getLocalMarketListings,
  getLocalMarketListingsBySeller,
  incrementLocalMarketListingViews,
  updateLocalMarketListingPrice,
} from "@/lib/local-market-store";

export type MarketListingRecord = {
  id: string;
  cardNo: string;
  serialNo: string | null;
  price: number;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  status: string;
  likes: number;
  views: number;
  createdAt: string;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
};

function hasDatabaseConfig() {
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

function isActiveListing(item: { status?: string | null }) {
  return String(item.status || "").toLowerCase() === "active";
}

function toMarketListingRecord(item: {
  id: string;
  cardNo: string;
  serialNo?: string | null;
  price: number;
  sellerId: string;
  status: string;
  likes: number;
  views: number;
  createdAt: Date;
  cardName?: string | null;
  imageUrl?: string | null;
  rarity?: string | null;
  seller?: {
    displayName?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
}): MarketListingRecord {
  return {
    id: item.id,
    cardNo: String(item.cardNo || ""),
    serialNo: item.serialNo || null,
    price: Number(item.price || 0),
    sellerId: item.sellerId,
    sellerName:
      String(item.seller?.displayName || item.seller?.name || "").trim() ||
      "Unknown Seller",
    sellerImage: String(item.seller?.image || "").trim() || "/default-avatar.png",
    status: String(item.status || "active"),
    likes: Number(item.likes || 0),
    views: Number(item.views || 0),
    createdAt: item.createdAt.toISOString(),
    cardName: item.cardName || null,
    imageUrl: sanitizeCardImageUrl(item.imageUrl),
    rarity: item.rarity || null,
  };
}

async function getDbListings(where?: Prisma.MarketListingWhereInput) {
  const rows = await prisma.marketListing.findMany({
    where,
    include: {
      seller: {
        select: {
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

  return rows.map(toMarketListingRecord);
}

export async function getMarketListings() {
  if (!hasDatabaseConfig()) {
    return (await getLocalMarketListings()).filter(isActiveListing);
  }

  try {
    return await getDbListings({
      status: {
        equals: "active",
        mode: "insensitive",
      },
    });
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : (await getLocalMarketListings()).filter(isActiveListing);
  }
}

export async function getMarketListingById(id: string) {
  if (!hasDatabaseConfig()) {
    return getLocalMarketListingById(id);
  }

  try {
    const listing = await prisma.marketListing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return listing && isActiveListing(listing) ? toMarketListingRecord(listing) : null;
  } catch {
    return process.env.NODE_ENV === "production"
      ? null
      : getLocalMarketListingById(id);
  }
}

export async function getMarketListingsByCardNo(cardNo: string) {
  const normalizedCardNo = String(cardNo || "").trim();

  if (!normalizedCardNo) {
    return [];
  }

  if (!hasDatabaseConfig()) {
    const listings = await getLocalMarketListings();
    return listings.filter(
      (item) => String(item.cardNo || "") === normalizedCardNo && isActiveListing(item)
    );
  }

  try {
    return await getDbListings({
      cardNo: normalizedCardNo,
      status: {
        equals: "active",
        mode: "insensitive",
      },
    });
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : (await getLocalMarketListings()).filter(
          (item) =>
            String(item.cardNo || "") === normalizedCardNo && isActiveListing(item)
        );
  }
}

export async function getMarketListingStatsForRarity(rarity?: string | null) {
  const normalizedRarity = String(rarity || "").trim();

  if (!hasDatabaseConfig()) {
    const listings = await getLocalMarketListings();
    const activeListings = listings.filter(isActiveListing);

    return {
      totalActiveListings: activeListings.length,
      sameRarityActiveCount: activeListings.filter(
        (item) => String(item.rarity || "").trim() === normalizedRarity
      ).length,
    };
  }

  const activeWhere: Prisma.MarketListingWhereInput = {
    status: {
      equals: "active",
      mode: "insensitive",
    },
  };
  const rarityWhere: Prisma.MarketListingWhereInput = normalizedRarity
    ? {
        ...activeWhere,
        rarity: normalizedRarity,
      }
    : {
        ...activeWhere,
        OR: [{ rarity: null }, { rarity: "" }],
      };

  try {
    const [totalActiveListings, sameRarityActiveCount] = await Promise.all([
      prisma.marketListing.count({ where: activeWhere }),
      prisma.marketListing.count({ where: rarityWhere }),
    ]);

    return {
      totalActiveListings,
      sameRarityActiveCount,
    };
  } catch {
    if (process.env.NODE_ENV === "production") {
      return {
        totalActiveListings: 0,
        sameRarityActiveCount: 0,
      };
    }

    const listings = await getLocalMarketListings();
    const activeListings = listings.filter(isActiveListing);

    return {
      totalActiveListings: activeListings.length,
      sameRarityActiveCount: activeListings.filter(
        (item) => String(item.rarity || "").trim() === normalizedRarity
      ).length,
    };
  }
}

export async function getMarketListingsBySeller(sellerId: string) {
  if (!hasDatabaseConfig()) {
    return getLocalMarketListingsBySeller(sellerId);
  }

  try {
    const rows = await prisma.marketListing.findMany({
      where: {
        sellerId,
        status: {
          equals: "active",
          mode: "insensitive",
        },
      },
      include: {
        seller: {
          select: {
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

    return rows.map(toMarketListingRecord);
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : getLocalMarketListingsBySeller(sellerId);
  }
}

export async function createMarketListing(input: {
  cardNo: string;
  serialNo: string | null;
  price: number;
  sellerId: string;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  sellerName?: string;
  sellerImage?: string;
}) {
  if (!hasDatabaseConfig()) {
    return createLocalMarketListing({
      ...input,
      sellerName: input.sellerName || "Unknown Seller",
      sellerImage: input.sellerImage || "/default-avatar.png",
    });
  }

  try {
    const created = await prisma.marketListing.create({
      data: {
        cardNo: input.cardNo,
        serialNo: input.serialNo,
        price: Number(input.price || 0),
        sellerId: input.sellerId,
        cardName: input.cardName,
        imageUrl: input.imageUrl,
        rarity: input.rarity,
      },
      include: {
        seller: {
          select: {
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return toMarketListingRecord(created);
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("create-market-listing-failed");
    }

    return createLocalMarketListing({
      ...input,
      sellerName: input.sellerName || "Unknown Seller",
      sellerImage: input.sellerImage || "/default-avatar.png",
    });
  }
}

export async function updateMarketListingPrice(id: string, price: number) {
  if (!hasDatabaseConfig()) {
    return updateLocalMarketListingPrice(id, price);
  }

  try {
    const updated = await prisma.marketListing.update({
      where: { id },
      data: {
        price: Number(price || 0),
      },
      include: {
        seller: {
          select: {
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return toMarketListingRecord(updated);
  } catch {
    return process.env.NODE_ENV === "production"
      ? null
      : updateLocalMarketListingPrice(id, price);
  }
}

export async function incrementMarketListingViews(id: string) {
  if (!hasDatabaseConfig()) {
    return incrementLocalMarketListingViews(id);
  }

  try {
    const updated = await prisma.marketListing.update({
      where: { id },
      data: {
        views: {
          increment: 1,
        },
      },
      include: {
        seller: {
          select: {
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return toMarketListingRecord(updated);
  } catch {
    return process.env.NODE_ENV === "production"
      ? null
      : incrementLocalMarketListingViews(id);
  }
}

export async function incrementMarketListingLikes(id: string) {
  if (!hasDatabaseConfig()) {
    const { incrementLocalMarketListingLikes } = await import(
      "@/lib/local-market-store"
    );
    return incrementLocalMarketListingLikes(id);
  }

  try {
    const updated = await prisma.marketListing.update({
      where: { id },
      data: {
        likes: {
          increment: 1,
        },
      },
      include: {
        seller: {
          select: {
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return toMarketListingRecord(updated);
  } catch {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    const { incrementLocalMarketListingLikes } = await import(
      "@/lib/local-market-store"
    );
    return incrementLocalMarketListingLikes(id);
  }
}

export async function deleteMarketListing(id: string) {
  if (!hasDatabaseConfig()) {
    return deleteLocalMarketListing(id);
  }

  try {
    await prisma.marketListing.delete({
      where: { id },
    });
  } catch {
    if (process.env.NODE_ENV !== "production") {
      await deleteLocalMarketListing(id);
    }
  }
}
