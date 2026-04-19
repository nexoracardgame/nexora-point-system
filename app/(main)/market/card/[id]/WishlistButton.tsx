"use client";

import { Heart } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";

type WishlistItem = {
  id: string;
  cardNo: string;
  cardName?: string;
  sellerName?: string;
};

function normalizeWishlist(raw: string | null): WishlistItem[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown[]) : [];

    return parsed.map((item) => {
      if (typeof item === "string") {
        return {
          id: item,
          cardNo: item,
          cardName: `Card #${item}`,
          sellerName: "Vault Prime",
        };
      }

      const value = (item || {}) as Partial<WishlistItem>;

      return {
        id: String(value.id || ""),
        cardNo: String(value.cardNo || value.id || ""),
        cardName: value.cardName || undefined,
        sellerName: value.sellerName || undefined,
      };
    });
  } catch {
    return [];
  }
}

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
  const { data: session } = useSession();
  const [saved, setSaved] = useState(() => {
    if (typeof window === "undefined") return false;

    const wishlist = normalizeWishlist(localStorage.getItem("nexora_wishlist"));
    return wishlist.some((item) => item.id === listingId);
  });

  const handleWishlist = () => {
    const list = normalizeWishlist(localStorage.getItem("nexora_wishlist"));
    const exists = list.some((item) => item.id === listingId);

    const nextList = exists
      ? list.filter((item) => item.id !== listingId)
      : [
          ...list,
          {
            id: listingId,
            cardNo,
            cardName:
              cardName || `Card #${String(cardNo).padStart(3, "0")}`,
            sellerName: sellerName || "Vault Prime",
          },
        ];

    localStorage.setItem("nexora_wishlist", JSON.stringify(nextList));
    setSaved(!exists);

    if (!exists && session?.user?.id) {
      void fetch("/api/market/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId,
          cardNo,
        }),
      });
    }
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
