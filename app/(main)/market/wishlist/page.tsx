"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Trash2 } from "lucide-react";

type WishlistCard = {
  id: string;
  cardNo: string;
  cardName?: string;
  sellerName?: string;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistCard[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexora_wishlist");

      if (!raw || raw.trim() === "") {
        setItems([]);
        return;
      }

      const parsed = JSON.parse(raw);

      const normalized: WishlistCard[] = parsed
        .filter((item: any) => item && item.id)
        .map((item: any) => ({
          id: item.id,
          cardNo: item.cardNo,
          cardName: item.cardName,
          sellerName: item.sellerName,
        }));

      localStorage.setItem(
        "nexora_wishlist",
        JSON.stringify(normalized)
      );

      setItems(normalized);
    } catch (error) {
      console.error("Wishlist parse error:", error);
      localStorage.removeItem("nexora_wishlist");
      setItems([]);
    }
  }, []);

  const removeWishlist = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    localStorage.setItem("nexora_wishlist", JSON.stringify(nextItems));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1b1830_0%,#090a10_55%,#05060a_100%)] px-3 py-4 text-white sm:px-6 sm:py-10">
      <section className="mx-auto max-w-7xl">
        
        {/* HEADER */}
        <div className="mb-6 flex items-center gap-3 md:mb-10 md:text-5xl md:font-black md:tracking-tight">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 md:h-auto md:w-auto md:bg-transparent">
            <Heart className="h-6 w-6 fill-pink-500 text-pink-500 md:h-10 md:w-10" />
          </div>

          <div className="text-2xl font-black md:text-5xl">
            My Wishlist
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/50 md:rounded-3xl md:p-8">
            ยังไม่มีการ์ดที่บันทึกไว้
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-8">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="group relative"
                style={{
                  transform:
                    window.innerWidth >= 768
                      ? `rotate(${index % 2 === 0 ? "-2deg" : "2deg"})`
                      : "none",
                }}
              >
                <Link
                  href={`/market/card/${item.id}`}
                  className="block cursor-pointer overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.05] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-pink-400/30 hover:shadow-[0_0_80px_rgba(236,72,153,0.18)] md:rounded-[32px]"
                >
                  <div className="pointer-events-none relative aspect-[3/4] overflow-hidden">
                    <img
                      src={`/cards/${String(item.cardNo).padStart(3, "0")}.jpg`}
                      alt={item.cardName || `Card ${item.cardNo}`}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                    {/* SELLER TAG */}
                    <div className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-[9px] font-semibold backdrop-blur-md md:left-4 md:top-4 md:px-3 md:text-xs">
                      {item.sellerName || "Vault Prime"}
                    </div>

                    {/* TEXT */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5">
                      <div className="line-clamp-2 text-sm font-black leading-tight md:text-2xl">
                        {item.cardName ||
                          `Card #${String(item.cardNo).padStart(3, "0")}`}
                      </div>

                      <div className="mt-1 text-[10px] text-white/60 md:text-xs">
                        Seller: {item.sellerName || "Vault Prime"}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* REMOVE BUTTON */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeWishlist(item.id);
                  }}
                  className="absolute right-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white/80 backdrop-blur-md transition-all duration-300 hover:border-red-400/30 hover:bg-red-500/20 hover:text-red-300 md:right-4 md:top-4 md:h-10 md:w-10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}