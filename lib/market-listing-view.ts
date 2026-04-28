import { resolveCardDisplayImage } from "@/lib/card-image";

export type MarketViewItem = {
  id: string;
  cardNo: string;
  name: string;
  price: string;
  likes: number;
  rarity: string;
  image: string;
  createdAt?: string;
  sellerId?: string;
  sellerName?: string;
  sellerImage?: string;
};

type MarketListingLike = {
  id: string;
  card_no?: string;
  cardNo?: string;
  cardName?: string | null;
  card_name?: string | null;
  name?: string | null;
  price?: number | string | null;
  likes?: number | null;
  rarity?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  createdAt?: string | Date | null;
  sellerId?: string | null;
  sellerName?: string | null;
  sellerImage?: string | null;
  seller?: {
    id?: string | null;
    displayName?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
};

export function normalizeMarketListingView(
  item: MarketListingLike
): MarketViewItem {
  const cardNo = String(item.card_no || item.cardNo || item.id || "");
  const paddedCardNo = cardNo.padStart(3, "0");
  const seller = item.seller || undefined;
  const numericPrice =
    typeof item.price === "number"
      ? item.price
      : Number(String(item.price || 0).replace(/[^\d.-]/g, ""));

  return {
    id: item.id,
    cardNo,
    name: `${
      item.cardName || item.card_name || item.name || "Unknown"
    } #${paddedCardNo}`,
    price: `฿${
      Number.isFinite(numericPrice)
        ? numericPrice.toLocaleString("th-TH")
        : "0"
    }`,
    likes: Number(item.likes || 0),
    rarity: item.rarity || "Legendary",
    image: resolveCardDisplayImage(
      paddedCardNo,
      item.image_url || item.imageUrl
    ),
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : item.createdAt?.toISOString?.() || undefined,
    sellerId: item.sellerId || seller?.id || undefined,
    sellerName:
      item.sellerName || seller?.displayName || seller?.name || "Unknown Seller",
    sellerImage: item.sellerImage || seller?.image || "/default-avatar.png",
  };
}
