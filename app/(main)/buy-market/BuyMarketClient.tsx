"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import BuyMarketFeatureNav from "@/components/BuyMarketFeatureNav";
import SafeCardImage from "@/components/SafeCardImage";
import type { BuyMarketListing } from "@/lib/buy-market-types";

const BUY_WISHLIST_KEY = "nexora_buy_wishlist";
const BUY_SEEN_STORAGE_PREFIX = "nexora:buy-market-seen-listings";
const MAX_SEEN_BUY_LISTING_IDS = 2000;

function formatPrice(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function formatBuyPostedAt(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date)} น.`;
}

function getBuyListingIds(items: BuyMarketListing[]) {
  return items
    .map((item) => String(item.id || "").trim())
    .filter(Boolean);
}

function buildBuySeenStorageKey(viewerKey?: string | null) {
  const safeViewerKey = String(viewerKey || "guest").trim() || "guest";
  return `${BUY_SEEN_STORAGE_PREFIX}:${safeViewerKey}`;
}

function readSeenBuyListingIdArray(storageKey: string) {
  if (typeof window === "undefined" || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { ids?: unknown[] }).ids)
    ) {
      return (parsed as { ids: unknown[] }).ids.map(String).filter(Boolean);
    }
  } catch {
    return [];
  }

  return [];
}

function readSeenBuyListingIds(storageKey: string) {
  return new Set(readSeenBuyListingIdArray(storageKey));
}

function hasSeenBuyListingSnapshot(storageKey: string) {
  if (typeof window === "undefined" || !storageKey) return false;

  try {
    return window.localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

function rememberSeenBuyListingIds(storageKey: string, ids: string[]) {
  if (typeof window === "undefined" || !storageKey) return;

  const nextIds = Array.from(
    new Set([
      ...ids.map(String).filter(Boolean),
      ...readSeenBuyListingIdArray(storageKey),
    ])
  ).slice(0, MAX_SEEN_BUY_LISTING_IDS);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(nextIds));
  } catch {}
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
  currentUser,
}: {
  initialListings: BuyMarketListing[];
  currentUser: {
    id: string;
    isAdmin: boolean;
  };
}) {
  const [listings, setListings] = useState(initialListings);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => new Set());
  const [freshListingIds, setFreshListingIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<BuyMarketListing | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const listingIdsRef = useRef(new Set(getBuyListingIds(initialListings)));
  const seenListingIdsRef = useRef<Set<string>>(new Set());
  const seenStorageKeyRef = useRef("");
  const initializedSeenStorageKeyRef = useRef<string | null>(null);
  const buySeenBaselineReadyRef = useRef(initialListings.length > 0);
  const viewerSeenStorageKey = useMemo(
    () => buildBuySeenStorageKey(currentUser.id),
    [currentUser.id]
  );

  useEffect(() => {
    setFollowedIds(readFollowedIds());
  }, []);

  useEffect(() => {
    seenStorageKeyRef.current = viewerSeenStorageKey;
  }, [viewerSeenStorageKey]);

  useEffect(() => {
    if (!viewerSeenStorageKey) return;
    if (initializedSeenStorageKeyRef.current === viewerSeenStorageKey) return;

    const currentIds = getBuyListingIds(listings);
    const hadSeenSnapshot = hasSeenBuyListingSnapshot(viewerSeenStorageKey);
    const storedSeenIds = readSeenBuyListingIds(viewerSeenStorageKey);
    const unseenIds = hadSeenSnapshot
      ? currentIds.filter((id) => !storedSeenIds.has(id))
      : [];
    const nextSeenIds = new Set(storedSeenIds);
    currentIds.forEach((id) => nextSeenIds.add(id));

    listingIdsRef.current = new Set(currentIds);
    seenListingIdsRef.current = nextSeenIds;
    initializedSeenStorageKeyRef.current = viewerSeenStorageKey;
    buySeenBaselineReadyRef.current = true;
    setFreshListingIds(unseenIds);

    window.setTimeout(() => {
      rememberSeenBuyListingIds(viewerSeenStorageKey, currentIds);
    }, 0);
  }, [listings, viewerSeenStorageKey]);

  const absorbListings = useCallback((nextListings: BuyMarketListing[]) => {
    const currentIds = getBuyListingIds(nextListings);
    const storageKey = seenStorageKeyRef.current;
    const hasSeenBaseline =
      Boolean(storageKey && hasSeenBuyListingSnapshot(storageKey)) ||
      seenListingIdsRef.current.size > 0 ||
      buySeenBaselineReadyRef.current ||
      listingIdsRef.current.size > 0;
    const storedSeenIds = storageKey
      ? readSeenBuyListingIds(storageKey)
      : new Set<string>();
    const knownIds = new Set([
      ...Array.from(storedSeenIds),
      ...Array.from(seenListingIdsRef.current),
      ...Array.from(listingIdsRef.current),
    ]);
    const newIds = hasSeenBaseline
      ? currentIds.filter((id) => !knownIds.has(id))
      : [];

    currentIds.forEach((id) => knownIds.add(id));
    seenListingIdsRef.current = knownIds;
    listingIdsRef.current = new Set(currentIds);
    buySeenBaselineReadyRef.current = true;

    if (storageKey) {
      window.setTimeout(() => {
        rememberSeenBuyListingIds(storageKey, currentIds);
      }, 0);
    }

    setListings(nextListings);
    setFreshListingIds((previousIds) => {
      const visibleFreshIds = previousIds.filter((id) => currentIds.includes(id));

      if (newIds.length === 0) {
        return visibleFreshIds.length === previousIds.length
          ? previousIds
          : visibleFreshIds;
      }

      const nextFreshIds = new Set(visibleFreshIds);
      newIds.forEach((id) => nextFreshIds.add(id));
      return Array.from(nextFreshIds);
    });
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
          absorbListings(data.listings);
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
  }, [absorbListings]);

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

  async function confirmAdminDelete() {
    if (!deleteTarget || deletingId) return;

    try {
      setDeletingId(deleteTarget.id);
      setDeleteError("");

      const res = await fetch(`/api/buy-market/listings/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        setDeleteError(data?.error || "ลบโพสต์รับซื้อไม่สำเร็จ");
        return;
      }

      setListings((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      );
      listingIdsRef.current.delete(deleteTarget.id);
      setFreshListingIds((current) =>
        current.filter((id) => id !== deleteTarget.id)
      );
      setFollowedIds((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      removeFollowedListing(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteError("ลบโพสต์รับซื้อไม่สำเร็จ");
    } finally {
      setDeletingId("");
    }
  }

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
                  try {
                    const res = await fetch(`/api/buy-market/listings?ts=${Date.now()}`, {
                      cache: "no-store",
                    });
                    const data = await res.json().catch(() => ({}));
                    if (Array.isArray(data?.listings)) absorbListings(data.listings);
                  } finally {
                    setRefreshing(false);
                  }
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
            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {filteredListings.map((listing) => {
                const followed = followedIds.has(listing.id);
                const canAdminDelete = currentUser.isAdmin;
                const isFreshListing = freshListingIds.includes(listing.id);
                const postedAt = formatBuyPostedAt(listing.createdAt);

                return (
                  <article
                    key={listing.id}
                    className={`group overflow-hidden rounded-[24px] border border-black/8 bg-[#f5f5f6] transition duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_24px_60px_rgba(0,0,0,0.16)] ${
                      isFreshListing
                        ? "animate-[pulse_1.4s_ease-in-out_3] ring-2 ring-emerald-300/50"
                        : ""
                    }`}
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
                        <div className="absolute left-2 top-2 flex flex-col items-start gap-1 sm:left-3 sm:top-3">
                          {isFreshListing ? (
                            <span className="rounded-full border border-emerald-200/50 bg-emerald-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-[0_0_22px_rgba(110,231,183,0.45)]">
                              NEW
                            </span>
                          ) : null}
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-black shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
                            BUY MODE
                          </span>
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
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white sm:p-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">
                            ต้องการรับซื้อ
                          </div>
                          <h3 className="mt-1 line-clamp-2 text-sm font-black leading-tight sm:text-lg">
                            {listing.cardName || `Card #${listing.cardNo}`}
                          </h3>
                          <div className="mt-2 text-lg font-black text-white sm:text-2xl">
                            {formatPrice(listing.offerPrice)}
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-col gap-2 p-2.5 sm:gap-3 sm:p-3">
                      <Link
                        href={`/profile/${listing.buyerId}`}
                        className="flex min-w-0 items-center gap-2 rounded-[16px] bg-white px-2 py-2 transition hover:bg-zinc-100 sm:rounded-[18px] sm:px-2.5"
                      >
                        <img
                          src={listing.buyerImage || "/avatar.png"}
                          alt={listing.buyerName}
                          className="h-7 w-7 shrink-0 rounded-xl object-cover sm:h-9 sm:w-9 sm:rounded-2xl"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-black text-black/70 sm:text-xs">
                            ผู้รับซื้อ: {listing.buyerName}
                          </div>
                          <div className="mt-0.5 text-[11px] font-bold text-black/40">
                            Card #{listing.cardNo}
                          </div>
                          {postedAt ? (
                            <div className="mt-0.5 truncate text-[10px] font-black text-black/34">
                              ลงรับซื้อ {postedAt}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {canAdminDelete ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(listing);
                              setDeleteError("");
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-red-50 px-3 py-2 text-[11px] font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            GM ลบ
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => toggleFollow(listing)}
                          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black ${
                            followed
                              ? "bg-black text-white"
                              : "bg-white text-black ring-1 ring-black/10"
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${followed ? "fill-white" : ""}`} />
                          {followed ? "ติดตามแล้ว" : "ติดตาม"}
                        </button>
                        <Link
                          href={`/buy-market/card/${listing.id}`}
                          className="shrink-0 rounded-full bg-black px-3 py-2 text-center text-[11px] font-black text-white"
                        >
                          เสนอขาย
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-5 text-black shadow-[0_34px_120px_rgba(0,0,0,0.42)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/42">
                  GM Delete
                </div>
                <h2 className="mt-1 text-2xl font-black">ลบโพสต์รับซื้อ</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-black/52">
                  ยืนยันการลบโพสต์รับซื้อ{" "}
                  {deleteTarget.cardName || `Card #${deleteTarget.cardNo}`}{" "}
                  ออกจากตลาดรับซื้อการ์ดใบเดียว
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="mt-4 rounded-[16px] bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return;
                  setDeleteTarget(null);
                  setDeleteError("");
                }}
                disabled={Boolean(deletingId)}
                className="rounded-full bg-[#f4f4f5] px-4 py-3 text-xs font-black text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmAdminDelete()}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-xs font-black text-white transition hover:bg-zinc-900 disabled:opacity-60"
              >
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
