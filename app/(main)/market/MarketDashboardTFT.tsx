"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Heart, Plus, Handshake, ShieldCheck, Search } from "lucide-react";
import {
  normalizeMarketListingView,
  type MarketViewItem,
} from "@/lib/market-listing-view";
import { listenMarketSync } from "@/lib/market-sync";
import { listenProfileSync } from "@/lib/profile-sync";

type MarketItem = MarketViewItem;

type ListingApiItem = {
  id: string;
  card_no?: string;
  cardNo?: string;
  cardName?: string;
  card_name?: string;
  name?: string;
  price?: number;
  likes?: number;
  rarity?: string;
  image_url?: string;
  imageUrl?: string;
  createdAt?: string;
  sellerId?: string;
  sellerName?: string;
  sellerImage?: string;
  seller?: {
    id?: string;
    displayName?: string;
    name?: string;
    image?: string;
  };
};

function rarityClasses(rarity: string) {
  switch (rarity) {
    case "Legendary":
      return {
        glow: "from-amber-400/20 via-orange-400/10 to-transparent",
        ring: "hover:shadow-[0_20px_80px_rgba(251,191,36,0.18)]",
      };
    default:
      return {
        glow: "from-fuchsia-500/20 via-violet-400/10 to-transparent",
        ring: "hover:shadow-[0_20px_80px_rgba(217,70,239,0.16)]",
      };
  }
}

function getCreatedAtValue(dateString?: string) {
  const value = new Date(dateString || 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function normalizeCardNumber(value?: string | number | null) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
}

function comparePopularCards(a: MarketItem, b: MarketItem) {
  if (b.likes !== a.likes) {
    return b.likes - a.likes;
  }

  const createdAtDiff =
    getCreatedAtValue(a.createdAt) - getCreatedAtValue(b.createdAt);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return a.id.localeCompare(b.id);
}

function compareLatestCards(a: MarketItem, b: MarketItem) {
  const createdAtDiff =
    getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  if (b.likes !== a.likes) {
    return b.likes - a.likes;
  }

  return a.id.localeCompare(b.id);
}

function ActionButton({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const subtitleMap: Record<string, string> = {
    "Create Listing": "สร้างโพสต์ขายการ์ดของคุณ",
    "Deal Requests": "ดูคำขอดีลและตอบรับได้ทันที",
    Wishlist: "รายการการ์ดที่คุณติดตามไว้",
    "Seller Center": "จัดการโพสต์ขายและลบรายการ",
  };

  const safeSubtitle =
    subtitle.includes("เธ") || subtitle.includes("เน€")
      ? subtitleMap[title] || ""
      : subtitle;

  return (
    <Link
      href={href}
      className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-violet-300/30 hover:bg-white/[0.05] md:rounded-[24px] md:p-5"
    >
      <div className="mb-3 inline-flex rounded-2xl bg-violet-300/10 p-3 text-violet-300 md:mb-4">
        {icon}
      </div>
      <div className="text-base font-black md:text-lg">{title}</div>
      <div className="mt-1 text-xs text-white/50 md:text-sm">{safeSubtitle}</div>
    </Link>
  );
}

export default function MarketDashboardTFT({
  initialItems = [],
  initialItemsLoaded = false,
}: {
  initialItems?: MarketItem[];
  initialItemsLoaded?: boolean;
}) {
  const { data: session } = useSession();
  const [items, setItems] = useState<MarketItem[]>(initialItems);
  const [loading, setLoading] = useState(!initialItemsLoaded);
  const [likedCards, setLikedCards] = useState<string[]>([]);
  const [likesReady, setLikesReady] = useState(false);
  const [heroMode, setHeroMode] = useState<"popular" | "latest">("popular");
  const [cardNoQuery, setCardNoQuery] = useState("");
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const [freshListingIds, setFreshListingIds] = useState<string[]>([]);
  const itemsRef = useRef(items);
  const seenListingIdsRef = useRef<Set<string>>(new Set(initialItems.map((item) => item.id)));
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    startTransition(() => {
      setItems(initialItems);
      setLoading(!initialItemsLoaded && initialItems.length === 0);
    });
  }, [initialItems, initialItemsLoaded]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("nexora_market_likes");
        const parsed = raw ? JSON.parse(raw) : [];

        const nextLikedCards = Array.isArray(parsed)
          ? parsed
          : Object.keys(parsed || {}).filter((key) => parsed[key]);

        setLikedCards(nextLikedCards);
      } catch {
        setLikedCards([]);
      } finally {
        setLikesReady(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const toggleLike = (cardId: string, cardNo: string) => {
    const alreadyLiked = likedCards.includes(cardId);
    const next = alreadyLiked
      ? likedCards.filter((x) => x !== cardId)
      : [...likedCards, cardId];

    setLikedCards(next);

    const mapped = Object.fromEntries(next.map((id) => [id, true]));
    window.localStorage.setItem("nexora_market_likes", JSON.stringify(mapped));

    if (!alreadyLiked && session?.user?.id) {
      void fetch("/api/market/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: cardId,
          cardNo,
        }),
      });
    }
  };

  const refreshListings = useEffectEvent(
    async ({ preserveOnEmpty = false }: { preserveOnEmpty?: boolean } = {}) => {
      try {
        const res = await fetch("/api/market/listings", { cache: "no-store" });
        const data = await res.json();
        const mapped = Array.isArray(data)
          ? (data as ListingApiItem[]).map((item) =>
              normalizeMarketListingView(item)
            )
          : [];

        if (preserveOnEmpty && mapped.length === 0 && itemsRef.current.length > 0) {
          startTransition(() => {
            setLoading(false);
          });
          return;
        }

        const previousIds = seenListingIdsRef.current;
        const newIds = mapped
          .map((item) => item.id)
          .filter((id) => !previousIds.has(id));

        seenListingIdsRef.current = new Set(mapped.map((item) => item.id));

        startTransition(() => {
          setItems(mapped);
          setLoading(false);
          if (newIds.length > 0 && itemsRef.current.length > 0) {
            setFreshListingIds(newIds);
          }
        });

        if (newIds.length > 0) {
          window.setTimeout(() => {
            setFreshListingIds((prev) =>
              prev.filter((id) => !newIds.includes(id))
            );
          }, 5000);
        }
      } catch {
        startTransition(() => {
          setLoading(false);
        });
      }
    }
  );

  useEffect(() => {
    if (initialItemsLoaded) {
      return;
    }

    void refreshListings();
  }, [initialItemsLoaded]);

  useEffect(() => {
    return listenProfileSync((detail) => {
      const currentUserId = String(session?.user?.id || "").trim();
      const nextName = String(detail.name || "").trim();
      const nextImage = String(detail.image || "").trim();

      if (!currentUserId || (!nextName && !nextImage)) {
        return;
      }

      setItems((prev) =>
        prev.map((item) => {
          if (String(item.sellerId || "").trim() !== currentUserId) {
            return item;
          }

          return {
            ...item,
            sellerName: nextName || item.sellerName,
            sellerImage: nextImage || item.sellerImage,
          };
        })
      );
    });
  }, [session?.user?.id]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshListings({ preserveOnEmpty: true });
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useEffect(() => {
    return listenMarketSync(() => {
      void refreshListings({ preserveOnEmpty: false });
    });
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible" || refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;
      void refreshListings({ preserveOnEmpty: true }).finally(() => {
        refreshInFlightRef.current = false;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return;

      setMouse({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const sortedItems = useMemo(() => {
    if (loading && items.length === 0) {
      return [];
    }

    return [...items].sort(comparePopularCards);
  }, [items, loading]);

  const normalizedCardNoQuery = normalizeCardNumber(cardNoQuery);
  const visibleItems = useMemo(() => {
    if (!normalizedCardNoQuery) {
      return sortedItems;
    }

    return sortedItems.filter((item) => {
      const normalizedCardNo = normalizeCardNumber(item.cardNo);
      return (
        normalizedCardNo === normalizedCardNoQuery ||
        normalizedCardNo.endsWith(normalizedCardNoQuery)
      );
    });
  }, [normalizedCardNoQuery, sortedItems]);

  const heroTop3 = useMemo(() => {
    const list = [...sortedItems];

    if (heroMode === "latest") {
      return list.sort(compareLatestCards).slice(0, 3);
    }

    return list.sort(comparePopularCards).slice(0, 3);
  }, [sortedItems, heroMode]);

  const leftHero = heroTop3[1];
  const centerHero = heroTop3[0];
  const rightHero = heroTop3[2];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* MOBILE HERO */}
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(120,80,255,0.18),transparent_38%),linear-gradient(180deg,#111218_0%,#0b0c11_100%)] p-4 lg:hidden">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.42em] text-violet-300/80">
              NEXORA ELITE MARKET
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">
              FEATURED TOP 3
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setHeroMode("popular")}
              className={`rounded-2xl px-4 py-2 text-sm font-black tracking-tight transition-all duration-300 ${
                heroMode === "popular"
                  ? "border border-pink-300/20 bg-[linear-gradient(135deg,rgba(236,72,153,0.26),rgba(168,85,247,0.18))] text-pink-200 shadow-[0_0_28px_rgba(236,72,153,0.18)]"
                  : "border border-white/5 bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/85"
              }`}
            >
              Popular
            </button>

            <button
              onClick={() => setHeroMode("latest")}
              className={`rounded-2xl px-4 py-2 text-sm font-black tracking-tight transition-all duration-300 ${
                heroMode === "latest"
                  ? "border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(99,102,241,0.18))] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.16)]"
                  : "border border-white/5 bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/85"
              }`}
            >
              Latest
            </button>
          </div>
        </div>

        {centerHero && (
          <Link
            href={`/market/card/${centerHero.id}`}
            className="mt-5 block overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.06] shadow-[0_25px_80px_rgba(168,85,247,0.20)] backdrop-blur-xl"
          >
            <div className="relative">
              <img
                src={centerHero.image}
                alt={centerHero.name}
                className="h-[300px] w-full object-cover"
              />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleLike(centerHero.id, centerHero.cardNo);
                }}
                className="absolute right-3 top-3 rounded-full bg-black/50 p-3"
              >
                <Heart
                  className={`h-5 w-5 ${
                    likesReady && likedCards.includes(centerHero.id)
                      ? "fill-pink-500 text-pink-500"
                      : "text-white"
                  }`}
                />
              </button>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                    FEATURED CARD
                  </div>

                  <div className="mt-2 line-clamp-2 text-xl font-black leading-tight">
                    {centerHero.name}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <img
                      src={centerHero.sellerImage || "/default-avatar.png"}
                      alt={centerHero.sellerName || "Seller"}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="truncate text-xs text-white/70">
                      {centerHero.sellerName}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-base font-bold text-amber-300">
                      {centerHero.price}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
                      {centerHero.likes +
                        (likesReady && likedCards.includes(centerHero.id) ? 1 : 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {(leftHero || rightHero) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[leftHero, rightHero].filter(Boolean).map((card) => {
              if (!card) return null;

              return (
                <Link
                  key={card.id}
                  href={`/market/card/${card.id}`}
                  className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]"
                >
                  <img
                    src={card.image}
                    alt={card.name}
                    className="h-[180px] w-full object-cover"
                  />

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleLike(card.id, card.cardNo);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-2"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        likesReady && likedCards.includes(card.id)
                          ? "fill-pink-500 text-pink-500"
                          : "text-white"
                      }`}
                    />
                  </button>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <div className="line-clamp-2 text-sm font-black leading-tight">
                      {card.name}
                    </div>

                    <div className="mt-1 text-xs font-bold text-amber-300">
                      {card.price}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={card.sellerImage || "/default-avatar.png"}
                        alt={card.sellerName || "Seller"}
                        className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10"
                      />
                      <span className="truncate text-[10px] text-white/60">
                        {card.sellerName}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
                      <Heart className="h-3 w-3 fill-pink-500 text-pink-500" />
                      {card.likes +
                        (likesReady && likedCards.includes(card.id) ? 1 : 0)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* DESKTOP HERO - ORIGINAL */}
      <section className="relative hidden overflow-hidden rounded-[42px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(120,80,255,0.14),transparent_35%),linear-gradient(180deg,#111218_0%,#0b0c11_100%)] px-8 py-12 xl:px-14 xl:py-16 lg:block">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.5em] text-violet-300/80">
              NEXORA ELITE MARKET
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">
              FEATURED TOP 3
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setHeroMode("popular")}
              className={`rounded-2xl border px-4 py-2 text-sm font-black tracking-tight transition-all duration-300 ${
                heroMode === "popular"
                  ? "border-pink-300/20 bg-[linear-gradient(135deg,rgba(236,72,153,0.26),rgba(168,85,247,0.18))] text-pink-200 shadow-[0_0_28px_rgba(236,72,153,0.18)]"
                  : "border-white/5 bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/85"
              }`}
            >
              Popular
            </button>

            <button
              onClick={() => setHeroMode("latest")}
              className={`rounded-2xl border px-4 py-2 text-sm font-black tracking-tight transition-all duration-300 ${
                heroMode === "latest"
                  ? "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(99,102,241,0.18))] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.16)]"
                  : "border-white/5 bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/85"
              }`}
            >
              Latest
            </button>
          </div>
        </div>

        <div className="relative mt-16 flex min-h-[560px] items-end justify-center">
          {leftHero && (
            <Link
              href={`/market/card/${leftHero.id}`}
              className="absolute left-10 bottom-0 hidden lg:block"
            >
              <div className="group relative">
                <img
                  src={leftHero.image}
                  alt={leftHero.name}
                  className="h-[380px] w-[260px] rotate-[-10deg] rounded-[28px] object-cover shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition hover:scale-105"
                />

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLike(leftHero.id, leftHero.cardNo);
                  }}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      likesReady && likedCards.includes(leftHero.id)
                        ? "fill-pink-500 text-pink-500"
                        : "text-white"
                    }`}
                  />
                </button>

                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
                  <div className="line-clamp-2 text-sm font-black leading-tight">
                    {leftHero.name}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={leftHero.sellerImage || "/default-avatar.png"}
                      alt={leftHero.sellerName || "Seller"}
                      className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="truncate text-[10px] text-white/60">
                      {leftHero.sellerName}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm font-bold text-amber-300">
                      {leftHero.price}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/70">
                      <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
                      {leftHero.likes +
                        (likesReady && likedCards.includes(leftHero.id) ? 1 : 0)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {centerHero && (
            <Link
              href={`/market/card/${centerHero.id}`}
              className="relative z-20 w-full max-w-[400px] overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.06] shadow-[0_30px_120px_rgba(168,85,247,0.20)] backdrop-blur-xl transition duration-500 hover:-translate-y-2"
              style={{
                transform: `translate(${(mouse.x - 50) * 0.06}px, ${
                  (mouse.y - 50) * 0.04
                }px)`,
              }}
            >
              <img
                src={centerHero.image}
                alt={centerHero.name}
                className="h-[560px] w-full object-cover"
              />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleLike(centerHero.id, centerHero.cardNo);
                }}
                className="absolute right-4 top-4 rounded-full bg-black/50 p-3"
              >
                <Heart
                  className={`h-5 w-5 ${
                    likesReady && likedCards.includes(centerHero.id)
                      ? "fill-pink-500 text-pink-500"
                      : "text-white"
                  }`}
                />
              </button>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-6">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                    FEATURED CARD
                  </div>

                  <div className="mt-2 text-3xl font-black">
                    {centerHero.name}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <img
                      src={centerHero.sellerImage || "/default-avatar.png"}
                      alt={centerHero.sellerName || "Seller"}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="truncate text-sm text-white/70">
                      {centerHero.sellerName}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-lg font-bold text-amber-300">
                      {centerHero.price}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
                      {centerHero.likes +
                        (likesReady && likedCards.includes(centerHero.id) ? 1 : 0)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {rightHero && (
            <Link
              href={`/market/card/${rightHero.id}`}
              className="absolute right-10 bottom-0 hidden lg:block"
            >
              <div className="group relative">
                <img
                  src={rightHero.image}
                  alt={rightHero.name}
                  className="h-[380px] w-[260px] rotate-[10deg] rounded-[28px] object-cover shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition hover:scale-105"
                />

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLike(rightHero.id, rightHero.cardNo);
                  }}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      likesReady && likedCards.includes(rightHero.id)
                        ? "fill-pink-500 text-pink-500"
                        : "text-white"
                    }`}
                  />
                </button>

                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
                  <div className="line-clamp-2 text-sm font-black leading-tight">
                    {rightHero.name}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={rightHero.sellerImage || "/default-avatar.png"}
                      alt={rightHero.sellerName || "Seller"}
                      className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="truncate text-[10px] text-white/60">
                      {rightHero.sellerName}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm font-bold text-amber-300">
                      {rightHero.price}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/70">
                      <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
                      {rightHero.likes +
                        (likesReady && likedCards.includes(rightHero.id) ? 1 : 0)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* ACTIONS */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-4">
        <ActionButton
          href="/market/create"
          icon={<Plus className="h-5 w-5" />}
          title="Create Listing"
          subtitle="เธชเธฃเนเธฒเธเธฃเธฒเธขเธเธฒเธฃเธเธฒเธขเธเธฒเธฃเนเธ”เธเธฃเธดเธ"
        />
        <ActionButton
          href="/market/deals"
          icon={<Handshake className="h-5 w-5" />}
          title="Deal Requests"
          subtitle="เธ”เธนเธเธณเธเธญเธ”เธตเธฅ / เธ•เธญเธเธฃเธฑเธ"
        />
        <ActionButton
          href="/market/wishlist"
          icon={<Heart className="h-5 w-5" />}
          title="Wishlist"
          subtitle="เธเธฒเธฃเนเธ”เธ—เธตเนเธเธณเธฅเธฑเธเธ•เธดเธ”เธ•เธฒเธก"
        />
        <ActionButton
          href="/market/seller-center"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Seller Center"
          subtitle="เธเธฑเธ”เธเธฒเธฃเนเธเธชเธ•เนเนเธฅเธฐเธฃเธตเธงเธดเธง"
        />
      </section>

      {/* MARKET GRID */}
      <section>
        <div className="mb-4 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-2xl font-black lg:text-3xl">
              Marketplace Listings
            </div>
            <div className="mt-1 text-sm text-white/45">
              {normalizedCardNoQuery
                ? `เจอการ์ดเลข ${cardNoQuery} จำนวน ${visibleItems.length} รายการ`
                : `การ์ดพร้อมซื้อขาย ${sortedItems.length} รายการ`}
            </div>
          </div>

          <label className="group relative block w-full lg:w-[360px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70 transition group-focus-within:text-amber-200" />
            <input
              value={cardNoQuery}
              onChange={(e) => {
                setCardNoQuery(e.target.value.replace(/[^\d]/g, ""));
              }}
              inputMode="numeric"
              placeholder="ค้นหาเลขการ์ด เช่น 0006, 006, 6"
              className="h-[52px] w-full rounded-[22px] border border-amber-200/14 bg-[linear-gradient(135deg,rgba(251,191,36,0.10),rgba(255,255,255,0.035))] px-11 py-3 text-sm font-bold text-white outline-none shadow-[0_16px_45px_rgba(0,0,0,0.25)] transition placeholder:text-white/35 focus:border-amber-200/32 focus:ring-2 focus:ring-amber-300/12"
            />
            {cardNoQuery ? (
              <button
                type="button"
                onClick={() => setCardNoQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black text-white/70 transition hover:text-white"
              >
                ล้าง
              </button>
            ) : null}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-5">
          {visibleItems.map((card) => {
            const rarity = rarityClasses(card.rarity);
            const liked = likesReady && likedCards.includes(card.id);

            return (
              <Link
                key={card.id}
                href={`/market/card/${card.id}`}
                className={`group relative transition-all duration-500 hover:-translate-y-2 ${rarity.ring} ${
                  freshListingIds.includes(card.id)
                    ? "animate-[pulse_1.4s_ease-in-out_3]"
                    : ""
                }`}
              >
                {freshListingIds.includes(card.id) && (
                  <div className="absolute -top-2 left-3 z-30 rounded-full border border-amber-300/30 bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-[0_0_22px_rgba(251,191,36,0.35)]">
                    NEW
                  </div>
                )}
                <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0d0f16] shadow-[0_20px_60px_rgba(0,0,0,0.4)] lg:rounded-[28px]">
                  <div className={`absolute inset-0 bg-gradient-to-b ${rarity.glow}`} />

                  <div className="relative aspect-[2/3] w-full overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleLike(card.id, card.cardNo);
                      }}
                      className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md transition hover:scale-105"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          liked ? "fill-pink-500 text-pink-500" : "text-white/70"
                        }`}
                      />
                    </button>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 lg:p-4">
                      <div className="line-clamp-2 text-sm font-black leading-tight text-white lg:text-base">
                        {card.name}
                      </div>

                      <div className="mt-1 text-xs font-bold text-amber-300 lg:text-sm">
                        {card.price}
                      </div>

                      {card.sellerId && (
                        <div className="mt-2 flex items-center gap-2">
                          <img
                            src={card.sellerImage || "/default-avatar.png"}
                            alt={card.sellerName || "Seller"}
                            className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10"
                          />
                          <span className="truncate text-[10px] text-white/60 lg:text-xs">
                            {card.sellerName}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
                        <Heart className="h-3 w-3 fill-pink-500 text-pink-500" />
                        {card.likes + (liked ? 1 : 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {visibleItems.length === 0 && (
          <div className="mt-5 rounded-[28px] border border-amber-200/12 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(255,255,255,0.025))] p-8 text-center shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
            <div className="text-lg font-black text-white">ไม่พบการ์ดเลขนี้ในตลาด</div>
            <div className="mt-2 text-sm text-white/50">
              ลองพิมพ์เลขแบบ 6, 006 หรือ 0006 ได้เลย ระบบจะค้นหาให้ทันที
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
