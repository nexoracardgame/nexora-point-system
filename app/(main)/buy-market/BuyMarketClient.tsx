"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Heart, RefreshCw, Search, Store } from "lucide-react";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import SafeCardImage from "@/components/SafeCardImage";
import type { BuyMarketListing } from "@/lib/buy-market-types";

const BUY_WISHLIST_KEY = "nexora_buy_wishlist";

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function readFollowedIds() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUY_WISHLIST_KEY) || "[]");
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(
      parsed
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}

function writeFollowedListing(listing: BuyMarketListing) {
  let current: BuyMarketListing[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUY_WISHLIST_KEY) || "[]");
    current = Array.isArray(parsed) ? parsed : [];
  } catch {}
  const next = [
    listing,
    ...current.filter((item) => item.id !== listing.id),
  ];
  window.localStorage.setItem(BUY_WISHLIST_KEY, JSON.stringify(next));
}

function removeFollowedListing(id: string) {
  let current: BuyMarketListing[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUY_WISHLIST_KEY) || "[]");
    current = Array.isArray(parsed) ? parsed : [];
  } catch {}
  const next = current.filter((item) => item.id !== id);
  window.localStorage.setItem(BUY_WISHLIST_KEY, JSON.stringify(next));
}

export default function BuyMarketClient({
  initialListings,
}: {
  initialListings: BuyMarketListing[];
}) {
  const [listings, setListings] = useState(initialListings);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFollowedIds(readFollowedIds());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refresh(silent = true) {
      if (!silent) setRefreshing(true);

      try {
        const res = await fetch(`/api/buy-market/listings?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!cancelled && Array.isArray(data?.listings)) {
          setListings(data.listings);
        }
      } catch {
        return;
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    }, 2500);
    const onFocus = () => void refresh(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const filteredListings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return listings;

    return listings.filter((item) =>
      [
        item.cardNo,
        item.cardName,
        item.rarity,
        item.buyerName,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle))
    );
  }, [listings, query]);

  const toggleFollow = (listing: BuyMarketListing) => {
    setFollowedIds((current) => {
      const next = new Set(current);
      if (next.has(listing.id)) {
        next.delete(listing.id);
        removeFollowedListing(listing.id);
      } else {
        next.add(listing.id);
        writeFollowedListing(listing);
      }
      return next;
    });
  };

  return (
    <div className="min-h-full text-black">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_24px_90px_rgba(0,0,0,0.28)] ring-1 ring-black/5">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-5 sm:p-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                <BadgeDollarSign className="h-3.5 w-3.5" />
                NEXORA BUY MARKET
              </div>
              <h1 className="mt-5 max-w-3xl text-[34px] font-black leading-[0.98] text-black sm:text-5xl lg:text-6xl">
                ตลาดรับซื้อการ์ดใบเดียว
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-black/58 sm:text-base">
                โหมดนี้สำหรับประกาศรับซื้อการ์ดใบเดียว ผู้ขายการ์ดกดเสนอขายเข้าดีลได้ทันที
                แยกจากหน้าตลาดขายชัดเจนเพื่อไม่ให้สับสน
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
                <div className="rounded-[20px] border border-black/8 bg-black text-white p-3">
                  <div className="text-2xl font-black">{listings.length}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                    buy posts
                  </div>
                </div>
                <div className="rounded-[20px] border border-black/8 bg-[#f4f4f5] p-3">
                  <div className="text-2xl font-black">
                    {listings.filter((item) => item.offerPrice > 0).length}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black/42">
                    priced
                  </div>
                </div>
                <div className="rounded-[20px] border border-black/8 bg-[#f4f4f5] p-3">
                  <div className="text-2xl font-black">{followedIds.size}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-black/42">
                    following
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-black/8 bg-black p-5 text-white lg:border-l lg:border-t-0">
              <div className="flex h-full flex-col justify-between gap-5 rounded-[24px] border border-white/10 bg-white/[0.06] p-5">
                <div>
                  <Store className="h-8 w-8 text-white" />
                  <h2 className="mt-4 text-2xl font-black leading-tight">
                    Buyer Mode
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-white/58">
                    ดีลจากหน้านี้จะแสดงป้ายรับซื้อในแชท เพื่อแยกจากดีลขายการ์ดใบเดียว
                  </p>
                </div>
                <Link
                  href="/buy-market/create"
                  className="inline-flex items-center justify-center rounded-[18px] bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
                >
                  สร้างการ์ดรับซื้อ
                </Link>
              </div>
            </div>
          </div>
        </section>

        <BuyMarketFeatureNav />

        <section className="rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
                Latest Buy Posts
              </div>
              <h2 className="mt-1 text-2xl font-black">โพสต์รับซื้อล่าสุด</h2>
            </div>
            <div className="flex gap-2">
              <label className="flex min-w-0 items-center gap-2 rounded-[18px] border border-black/10 bg-[#f4f4f5] px-3 py-2">
                <Search className="h-4 w-4 text-black/45" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาเลขการ์ด / ชื่อการ์ด"
                  className="min-w-0 bg-transparent text-sm font-bold outline-none placeholder:text-black/30"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  setRefreshing(true);
                  const res = await fetch(`/api/buy-market/listings?ts=${Date.now()}`, {
                    cache: "no-store",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (Array.isArray(data?.listings)) setListings(data.listings);
                  setRefreshing(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-black text-white"
                aria-label="Refresh buy posts"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {filteredListings.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-black/12 bg-[#f6f6f7] p-8 text-center text-sm font-bold text-black/45">
              ยังไม่มีโพสต์รับซื้อที่ตรงกับเงื่อนไข
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredListings.map((listing) => {
                const followed = followedIds.has(listing.id);

                return (
                  <article
                    key={listing.id}
                    className="group overflow-hidden rounded-[24px] border border-black/8 bg-[#f5f5f6] transition duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_24px_60px_rgba(0,0,0,0.16)]"
                  >
                    <Link href={`/buy-market/card/${listing.id}`} className="block">
                      <div className="relative aspect-[2.5/3.35] overflow-hidden bg-white">
                        <SafeCardImage
                          cardNo={listing.cardNo}
                          imageUrl={listing.imageUrl || undefined}
                          alt={listing.cardName || `Card #${listing.cardNo}`}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/10 to-transparent" />
                        <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-[10px] font-black text-black">
                          BUY MODE
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            toggleFollow(listing);
                          }}
                          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border ${
                            followed
                              ? "border-white bg-white text-black"
                              : "border-white/30 bg-black/50 text-white"
                          }`}
                          aria-label="ติดตามโพสต์รับซื้อ"
                        >
                          <Heart className={`h-4 w-4 ${followed ? "fill-black" : ""}`} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">
                            ต้องการรับซื้อ
                          </div>
                          <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight">
                            {listing.cardName || `Card #${listing.cardNo}`}
                          </h3>
                          <div className="mt-2 text-2xl font-black text-white">
                            {formatPrice(listing.offerPrice)}
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-black/70">
                          ผู้รับซื้อ: {listing.buyerName}
                        </div>
                        <div className="mt-0.5 text-[11px] font-bold text-black/40">
                          Card #{listing.cardNo}
                        </div>
                      </div>
                      <Link
                        href={`/buy-market/card/${listing.id}`}
                        className="shrink-0 rounded-full bg-black px-3 py-2 text-[11px] font-black text-white"
                      >
                        เสนอขาย
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
