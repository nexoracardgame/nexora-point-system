"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

type WishlistItem = {
  id: string;
  cardNo: string;
  cardName?: string;
  sellerName?: string;
};

export default function WishlistButton({
  listingId,
  cardNo,
  cardName,
  sellerName,
}: {
  listingId: string;
  cardNo: string;
  cardName?: string;
  sellerName?: string;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("nexora_wishlist");
    const parsed = raw ? JSON.parse(raw) : [];

    const normalized: WishlistItem[] = parsed.map((item: any) =>
      typeof item === "string"
        ? {
            id: item,
            cardNo: item,
            cardName: `Card #${item}`,
            sellerName: "Vault Prime",
          }
        : item
    );

    setSaved(normalized.some((x) => x.id === listingId));
  }, [listingId]);

  const handleWishlist = () => {
    const raw = localStorage.getItem("nexora_wishlist");
    const parsed = raw ? JSON.parse(raw) : [];

    let list: WishlistItem[] = parsed.map((item: any) =>
      typeof item === "string"
        ? {
            id: item,
            cardNo: item,
            cardName: `Card #${item}`,
            sellerName: "Vault Prime",
          }
        : item
    );

    const exists = list.some((x) => x.id === listingId);

    if (exists) {
      list = list.filter((x) => x.id !== listingId);
      setSaved(false);
    } else {
      list.push({
        id: listingId,
        cardNo,
        cardName:
          cardName || `Card #${String(cardNo).padStart(3, "0")}`,
        sellerName: sellerName || "Vault Prime",
      });

      setSaved(true);
    }

    localStorage.setItem("nexora_wishlist", JSON.stringify(list));
  };

  return (
    <button
      onClick={handleWishlist}
      className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold transition-all duration-300 ${
        saved
          ? "border border-pink-400/20 bg-pink-500/20 text-pink-300 shadow-[0_0_30px_rgba(236,72,153,0.16)]"
          : "border border-white/10 bg-white/[0.04] text-white hover:border-pink-400/20 hover:bg-pink-500/10"
      }`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
      {saved ? "Wishlisted" : "Add Wishlist"}
    </button>
  );
}