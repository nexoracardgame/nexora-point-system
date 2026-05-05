"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import SafeCardImage from "@/components/SafeCardImage";
import type { BuyMarketListing } from "@/lib/buy-market-types";

const BUY_WISHLIST_KEY = "nexora_buy_wishlist";

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

export default function BuyWishlistPage() {
  const [items, setItems] = useState<BuyMarketListing[]>([]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(BUY_WISHLIST_KEY) || "[]");
      setItems(Array.isArray(parsed) ? parsed.filter((item) => item?.id) : []);
    } catch {
      localStorage.removeItem(BUY_WISHLIST_KEY);
      setItems([]);
    }
  }, []);

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    localStorage.setItem(BUY_WISHLIST_KEY, JSON.stringify(next));
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 text-black">
      <section className="rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
              Following
            </div>
            <h1 className="text-3xl font-black sm:text-5xl">
              รายการรับซื้อที่ติดตามไว้
            </h1>
          </div>
        </div>
      </section>

      <BuyMarketFeatureNav />

      {items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white p-8 text-center text-sm font-bold text-black/45">
          ยังไม่มีโพสต์รับซื้อที่ติดตามไว้
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-[24px] bg-white shadow-[0_22px_70px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
            >
              <Link href={`/buy-market/card/${item.id}`}>
                <div className="relative aspect-[2.5/3.45] overflow-hidden bg-[#f4f4f5]">
                  <SafeCardImage
                    cardNo={item.cardNo}
                    imageUrl={item.imageUrl || undefined}
                    alt={item.cardName || `Card #${item.cardNo}`}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">
                      รับซื้อ
                    </div>
                    <div className="mt-1 line-clamp-2 text-lg font-black">
                      {item.cardName || `Card #${item.cardNo}`}
                    </div>
                    <div className="mt-2 text-2xl font-black">
                      {formatPrice(item.offerPrice)}
                    </div>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                aria-label="ลบจากรายการติดตาม"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
