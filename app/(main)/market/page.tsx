import { prisma } from "@/lib/prisma";
import MarketDashboardTFT from "./MarketDashboardTFT";

export const revalidate = 30;

async function loadListings() {
  const listings = await prisma.marketListing.findMany({
    where: {
      NOT: {
        status: "sold",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      },
    },
  });

  return listings.map((item) => {
    const cardNo = item.cardNo || item.id;

    return {
      id: item.id,
      cardNo: String(cardNo),
      name: `${item.cardName || "Unknown"} #${String(cardNo).padStart(3, "0")}`,
      price: `฿${Number(item.price || 0).toLocaleString()}`,
      likes: item.likes || 0,
      rarity: item.rarity || "Legendary",
      image:
        item.imageUrl ||
        `/cards/${String(cardNo).padStart(3, "0")}.jpg`,
      createdAt: item.createdAt?.toISOString?.() || String(item.createdAt || ""),
      sellerId: item.seller?.id || item.sellerId,
      sellerName:
        item.seller?.displayName ||
        item.seller?.name ||
        "Unknown Seller",
      sellerImage: item.seller?.image || "/default-avatar.png",
    };
  });
}

export default async function MarketPage() {
  return <MarketDashboardTFT initialItems={await loadListings()} initialItemsLoaded />;
}
