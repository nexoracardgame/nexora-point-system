import { getLocalMarketListings } from "@/lib/local-market-store";
import MarketDashboardTFT from "./MarketDashboardTFT";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type DashboardItem = {
  id: string;
  cardNo: string;
  name: string;
  price: string;
  likes: number;
  rarity: string;
  image: string;
  createdAt: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
};

function mapDashboardItem(item: {
  id: string;
  cardNo: string;
  cardName: string | null;
  price: number;
  likes: number;
  rarity: string | null;
  imageUrl: string | null;
  createdAt: string | Date;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
}): DashboardItem {
  const cardNo = item.cardNo || item.id;

  return {
    id: item.id,
    cardNo: String(cardNo),
    name: `${item.cardName || "Unknown"} #${String(cardNo).padStart(3, "0")}`,
    price: `฿${Number(item.price || 0).toLocaleString("th-TH")}`,
    likes: item.likes || 0,
    rarity: item.rarity || "Legendary",
    image: item.imageUrl || `/cards/${String(cardNo).padStart(3, "0")}.jpg`,
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : item.createdAt?.toISOString?.() || String(item.createdAt || ""),
    sellerId: item.sellerId,
    sellerName: item.sellerName || "Unknown Seller",
    sellerImage: item.sellerImage || "/default-avatar.png",
  };
}

async function loadListings() {
  const localItems = await getLocalMarketListings();
  return localItems
    .filter((item) => String(item.status || "").toLowerCase() !== "sold")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 24)
    .map((item) => mapDashboardItem(item));
}

export default async function MarketPage() {
  return (
    <MarketDashboardTFT initialItems={await loadListings()} initialItemsLoaded />
  );
}
