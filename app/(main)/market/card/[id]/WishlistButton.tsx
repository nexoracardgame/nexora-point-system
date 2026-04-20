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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-all duration-300 md:min-h-14 md:text-base ${
        saved
          ? "border border-pink-400/25 bg-[linear-gradient(180deg,rgba(236,72,153,0.22),rgba(236,72,153,0.10))] text-pink-200 shadow-[0_18px_40px_rgba(236,72,153,0.14)]"
          : "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-white hover:-translate-y-0.5 hover:border-pink-400/20 hover:bg-pink-500/10"
      }`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
      {saved ? "Wishlisted" : "Add Wishlist"}
    </button>
  );
}
