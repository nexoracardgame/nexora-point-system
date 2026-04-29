import { resolveCardDisplayImage } from "@/lib/card-image";
import { getMarketListings, type MarketListingRecord } from "@/lib/market-listings";
import {
  normalizeMarketListingView,
  type MarketViewItem,
} from "@/lib/market-listing-view";

export type MarketListingFeedItem = Omit<
  MarketListingRecord,
  "cardName" | "imageUrl" | "rarity"
> & {
  cardName: string;
  imageUrl: string;
  rarity: string;
};

function getCreatedAtTime(value?: string | Date | null) {
  const time =
    value instanceof Date
      ? value.getTime()
      : new Date(String(value || 0)).getTime();

  return Number.isNaN(time) ? 0 : time;
}

export function compareMarketNewestFirst(
  a: { createdAt?: string | Date | null; likes?: number | null; id?: string },
  b: { createdAt?: string | Date | null; likes?: number | null; id?: string }
) {
  const createdAtDiff = getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const likesDiff = Number(b.likes || 0) - Number(a.likes || 0);
  if (likesDiff !== 0) {
    return likesDiff;
  }

  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function toMarketListingFeedItem(
  item: MarketListingRecord
): MarketListingFeedItem {
  const cardNo = String(item.cardNo || item.id || "").trim();

  return {
    ...item,
    cardName: item.cardName || `Card #${cardNo.padStart(3, "0")}`,
    imageUrl: resolveCardDisplayImage(cardNo, item.imageUrl),
    rarity: item.rarity || "Legendary",
    sellerName: item.sellerName || "Unknown Seller",
    sellerImage: item.sellerImage || "/default-avatar.png",
  };
}

export async function getActiveMarketListingFeed(limit = 120) {
  const listings = await getMarketListings();

  return listings
    .filter((item) => String(item.status || "").toLowerCase() !== "sold")
    .sort(compareMarketNewestFirst)
    .slice(0, limit)
    .map(toMarketListingFeedItem);
}

export async function getActiveMarketViewItems(
  limit = 120
): Promise<MarketViewItem[]> {
  const listings = await getActiveMarketListingFeed(limit);

  return listings.map(normalizeMarketListingView).sort(compareMarketNewestFirst);
}
