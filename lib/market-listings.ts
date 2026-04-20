import { prisma } from "@/lib/prisma";
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
    imageUrl: item.imageUrl || null,
    rarity: item.rarity || null,
  };
}

async function getDbListings(where?: {
  id?: string;
  sellerId?: string;
  cardNo?: string;
}) {
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
    return getLocalMarketListings();
  }

  try {
    return await getDbListings();
  } catch {
    return process.env.NODE_ENV === "production"
      ? []
      : getLocalMarketListings();
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

    return listing ? toMarketListingRecord(listing) : null;
  } catch {
    return process.env.NODE_ENV === "production"
      ? null
      : getLocalMarketListingById(id);
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
        NOT: {
          status: {
            equals: "sold",
            mode: "insensitive",
          },
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
