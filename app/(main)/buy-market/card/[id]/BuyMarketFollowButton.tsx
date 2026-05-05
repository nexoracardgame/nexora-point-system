"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import type { BuyMarketListing } from "@/lib/buy-market-types";

const BUY_WISHLIST_KEY = "nexora_buy_wishlist";

function readItems() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUY_WISHLIST_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as BuyMarketListing[]) : [];
  } catch {
    return [];
  }
}

export default function BuyMarketFollowButton({
  listing,
}: {
  listing: BuyMarketListing;
}) {
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    setFollowed(readItems().some((item) => item.id === listing.id));
  }, [listing.id]);

  function toggleFollow() {
    const items = readItems();
    const next = followed
      ? items.filter((item) => item.id !== listing.id)
      : [listing, ...items.filter((item) => item.id !== listing.id)];

    window.localStorage.setItem(BUY_WISHLIST_KEY, JSON.stringify(next));
    setFollowed(!followed);
  }

  return (
    <button
      type="button"
      onClick={toggleFollow}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-black transition ${
        followed
          ? "bg-black text-white"
          : "border border-black/10 bg-white text-black hover:border-black/25"
      }`}
    >
      <Heart className={`h-4 w-4 ${followed ? "fill-white" : ""}`} />
      {followed ? "ติดตามแล้ว" : "ติดตามการ์ดใบนี้"}
    </button>
  );
}
