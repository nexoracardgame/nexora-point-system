"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Plus,
  Handshake,
  ShieldCheck,
  Sparkles,
  Flame,
  Clock3,
  ChevronRight,
} from "lucide-react";

type MarketItem = {
  id: string;
  cardNo: string;
  name: string;
  price: string;
  likes: number;
  rarity: string;
  image: string;
  createdAt?: string;
  sellerId?: string;
  sellerName?: string;
  sellerImage?: string;
};

function rarityClasses(rarity: string) {
  const value = String(rarity || "").toLowerCase();

  if (value.includes("legendary") || value.includes("diamond")) {
    return {
      glow: "from-amber-400/25 via-orange-400/10 to-transparent",
      ring: "hover:shadow-[0_20px_80px_rgba(251,191,36,0.22)]",
      badge:
        "border-amber-300/25 bg-amber-400/10 text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.12)]",
    };
  }

  if (value.includes("gold") || value.includes("ทอง")) {
    return {
      glow: "from-yellow-400/20 via-amber-400/10 to-transparent",
      ring: "hover:shadow-[0_20px_80px_rgba(250,204,21,0.18)]",
      badge:
        "border-yellow-300/25 bg-yellow-400/10 text-yellow-200 shadow-[0_0_25px_rgba(250,204,21,0.1)]",
    };
  }

  return {
    glow: "from-fuchsia-500/20 via-violet-400/10 to-transparent",
    ring: "hover:shadow-[0_20px_80px_rgba(217,70,239,0.18)]",
    badge:
      "border-violet-300/25 bg-violet-400/10 text-violet-200 shadow-[0_0_25px_rgba(168,85,247,0.1)]",
  };
}

function SellerChip({
  name,
  image,
  compact = false,
}: {
  name?: string;
  image?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src={image || "/default-avatar.png"}
        alt={name || "Seller"}
        className={`rounded-full object-cover ring-1 ring-white/10 ${
          compact ? "h-5 w-5" : "h-7 w-7"
        }`}
      />
      <span
        className={`truncate ${
          compact ? "text-[10px] text-white/60" : "text-xs text-white/70"
        }`}
      >
        {name || "Unknown Seller"}
      </span>
    </div>
  );
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
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-violet-300/30 hover:bg-white/[0.06] md:rounded-[26px] md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-violet-300/15 bg-violet-300/10 p-3 text-violet-200">
          {icon}
        </div>

        <ChevronRight className="mt-1 h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
      </div>

      <div className="mt-4 text-base font-black md:text-lg">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-white/50 md:text-sm">
        {subtitle}
      </div>
    </Link>
  );
}

export default function MarketDashboardTFT() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedCards, setLikedCards] = useState<string[]>([]);
  const [heroMode, setHeroMode] = useState<"popular" | "latest">("popular");
  const [mouse, setMouse] = useState({ x: 50, y: 50 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexora_market_likes");
      const parsed = raw ? JSON.parse(raw) : [];

      const list = Array.isArray(parsed)
        ? parsed
        : Object.keys(parsed || {}).filter((k) => parsed[k]);

      setLikedCards(list);
    } catch {
      setLikedCards([]);
    }
  }, []);

  const toggleLike = (cardId: string) => {
    let next: string[];

    if (likedCards.includes(cardId)) {
      next = likedCards.filter((x) => x !== cardId);
    } else {
      next = [...likedCards, cardId];
    }

    setLikedCards(next);

    const mapped = Object.fromEntries(next.map((id) => [id, true]));
    localStorage.setItem("nexora_market_likes", JSON.stringify(mapped));
  };

  useEffect(() => {
    fetch("/api/market/listings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const mapped = (data || []).map((item: any) => {
          const cardNo = item.card_no || item.cardNo || item.id;

          return {
            id: item.id,
            cardNo: String(cardNo),
            name: `${item.cardName || item.card_name || item.name || "Unknown"} #${String(cardNo).padStart(3, "0")}`,
            price: `฿${Number(item.price || 0).toLocaleString()}`,
            likes: item.likes || 0,
            rarity: item.rarity || "Legendary",
            image:
              item.image_url ||
              item.imageUrl ||
              `/cards/${String(cardNo).padStart(3, "0")}.jpg`,
            createdAt: item.createdAt,
            sellerId: item.sellerId || item.seller?.id,
            sellerName:
              item.seller?.displayName ||
              item.seller?.name ||
              "Unknown Seller",
            sellerImage: item.seller?.image || "/default-avatar.png",
          };
        });

        setItems(mapped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
    return [...(loading ? [] : items)].sort((a, b) => b.likes - a.likes);
  }, [items, loading]);

  const heroTop3 = useMemo(() => {
    const list = [...sortedItems];

    if (heroMode === "latest") {
      return list
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        )
        .slice(0, 3);
    }

    return list.sort((a, b) => b.likes - a.likes).slice(0, 3);
  }, [sortedItems, heroMode]);

  const leftHero = heroTop3[1];
  const centerHero = heroTop3[0];
  const rightHero = heroTop3[2];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* MOBILE HERO */}
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(128,90,255,0.24),transparent_36%),linear-gradient(180deg,#11121a_0%,#0a0b11_100%)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.32)] lg:hidden">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.38em] text-violet-300/80">
                <Sparkles className="h-3.5 w-3.5" />
                NEXORA ELITE MARKET
              </div>

              <h1 className="mt-3 text-[30px] font-black leading-[0.95] tracking-[-0.05em]">
                FEATURED TOP 3
              </h1>

              <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-white/45">
                คัดการ์ดเด่นที่สุดในตลาดตอนนี้ให้ดูแบบ app-first
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Live
              </div>
              <div className="mt-1 text-sm font-black text-emerald-300">
                {sortedItems.length}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 bg-white/[0.03] p-2">
            <button
              onClick={() => setHeroMode("popular")}
              className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                heroMode === "popular"
                  ? "bg-pink-500/20 text-pink-300 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                  : "bg-transparent text-white/55"
              }`}
            >
              <Flame className="h-4 w-4" />
              Popular
            </button>

            <button
              onClick={() => setHeroMode("latest")}
              className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                heroMode === "latest"
                  ? "bg-violet-500/20 text-violet-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                  : "bg-transparent text-white/55"
              }`}
            >
              <Clock3 className="h-4 w-4" />
              Latest
            </button>
          </div>
        </div>

        {centerHero && (
          <Link
            href={`/market/card/${centerHero.id}`}
            className="mt-5 block overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_30px_90px_rgba(168,85,247,0.20)] backdrop-blur-xl"
          >
            <div className="relative">
              <img
                src={centerHero.image}
                alt={centerHero.name}
                className="h-[360px] w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />

              <div className="absolute left-3 top-3">
                <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-white/70 backdrop-blur-md">
                  #{centerHero.cardNo}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleLike(centerHero.id);
                }}
                className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/45 p-3 backdrop-blur-md"
              >
                <Heart
                  className={`h-5 w-5 ${
                    likedCards.includes(centerHero.id)
                      ? "fill-pink-500 text-pink-500"
                      : "text-white"
                  }`}
                />
              </button>

              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${rarityClasses(
                        centerHero.rarity
                      ).badge}`}
                    >
                      {centerHero.rarity}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/60">
                      <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
                      {centerHero.likes +
                        (likedCards.includes(centerHero.id) ? 1 : 0)}
                    </div>
                  </div>

                  <div className="mt-3 line-clamp-2 text-2xl font-black leading-tight tracking-[-0.03em]">
                    {centerHero.name}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <SellerChip
                      name={centerHero.sellerName}
                      image={centerHero.sellerImage}
                    />

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Floor
                      </div>
                      <div className="text-lg font-black text-amber-300">
                        {centerHero.price}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {(leftHero || rightHero) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[leftHero, rightHero].filter(Boolean).map((card, idx) => {
              if (!card) return null;

              const rarity = rarityClasses(card.rarity);

              return (
                <Link
                  key={card.id}
                  href={`/market/card/${card.id}`}
                  className={`group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0f16] shadow-[0_20px_60px_rgba(0,0,0,0.32)] transition ${rarity.ring}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-b ${rarity.glow}`} />

                  <img
                    src={card.image}
                    alt={card.name}
                    className="h-[210px] w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleLike(card.id);
                    }}
                    className="absolute right-2.5 top-2.5 rounded-full border border-white/10 bg-black/45 p-2 backdrop-blur-md"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        likedCards.includes(card.id)
                          ? "fill-pink-500 text-pink-500"
                          : "text-white"
                      }`}
                    />
                  </button>

                  <div className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-bold text-white/75 backdrop-blur-md">
                    #{idx === 0 ? "02" : "03"}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3">
                    <div className="line-clamp-2 text-sm font-black leading-tight">
                      {card.name}
                    </div>

                    <div className="mt-1 text-xs font-bold text-amber-300">
                      {card.price}
                    </div>

                    <div className="mt-2">
                      <SellerChip
                        name={card.sellerName}
                        image={card.sellerImage}
                        compact
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* DESKTOP HERO */}
      <section className="relative hidden overflow-hidden rounded-[44px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(120,80,255,0.16),transparent_35%),linear-gradient(180deg,#111218_0%,#0b0c11_100%)] px-8 py-12 shadow-[0_30px_120px_rgba(0,0,0,0.35)] xl:px-14 xl:py-16 lg:block">
        <div className="flex items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.44em] text-violet-300/80">
              <Sparkles className="h-4 w-4" />
              NEXORA ELITE MARKET
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] md:text-6xl">
              FEATURED TOP 3
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">
              ประสบการณ์ตลาดการ์ดสไตล์ collectible app เน้น hero-first และ
              mobile-ready UX
            </p>
          </div>

          <div className="flex gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-2">
            <button
              onClick={() => setHeroMode("popular")}
              className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                heroMode === "popular"
                  ? "bg-pink-500/20 text-pink-300 shadow-[0_0_25px_rgba(236,72,153,0.15)]"
                  : "text-white/60"
              }`}
            >
              ❤️ Popular
            </button>

            <button
              onClick={() => setHeroMode("latest")}
              className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                heroMode === "latest"
                  ? "bg-violet-500/20 text-violet-300 shadow-[0_0_25px_rgba(168,85,247,0.15)]"
                  : "text-white/60"
              }`}
            >
              🆕 Latest
            </button>
          </div>
        </div>

        <div className="relative mt-16 flex min-h-[600px] items-end justify-center">
          {leftHero && (
            <Link
              href={`/market/card/${leftHero.id}`}
              className="absolute left-8 bottom-0 hidden lg:block"
            >
              <div className="group relative">
                <img
                  src={leftHero.image}
                  alt={leftHero.name}
                  className="h-[400px] w-[270px] rotate-[-10deg] rounded-[30px] object-cover shadow-[0_24px_90px_rgba(0,0,0,0.42)] transition duration-500 hover:scale-105"
                />

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLike(leftHero.id);
                  }}
                  className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/45 p-2.5 backdrop-blur-md"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      likedCards.includes(leftHero.id)
                        ? "fill-pink-500 text-pink-500"
                        : "text-white"
                    }`}
                  />
                </button>

                <div className="absolute inset-x-3 bottom-3 rounded-[24px] border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
                  <div className="line-clamp-2 text-base font-black leading-tight">
                    {leftHero.name}
                  </div>

                  <div className="mt-2">
                    <SellerChip
                      name={leftHero.sellerName}
                      image={leftHero.sellerImage}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-base font-bold text-amber-300">
                      {leftHero.price}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/65">
                      <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
                      {leftHero.likes +
                        (likedCards.includes(leftHero.id) ? 1 : 0)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {centerHero && (
            <Link
              href={`/market/card/${centerHero.id}`}
              className="relative z-20 w-full max-w-[420px] overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.06] shadow-[0_34px_140px_rgba(168,85,247,0.20)] backdrop-blur-xl transition duration-500 hover:-translate-y-2"
              style={{
                transform: `translate(${(mouse.x - 50) * 0.06}px, ${(mouse.y - 50) * 0.04}px)`,
              }}
            >
              <img
                src={centerHero.image}
                alt={centerHero.name}
                className="h-[590px] w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />

              <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-white/75 backdrop-blur-md">
                #{centerHero.cardNo}
              </div>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleLike(centerHero.id);
                }}
                className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/45 p-3 backdrop-blur-md"
              >
                <Heart
                  className={`h-5 w-5 ${
                    likedCards.includes(centerHero.id)
                      ? "fill-pink-500 text-pink-500"
                      : "text-white"
                  }`}
                />
              </button>

              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="rounded-[28px] border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] ${rarityClasses(
                        centerHero.rarity
                      ).badge}`}
                    >
                      {centerHero.rarity}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/65">
                      <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
                      {centerHero.likes +
                        (likedCards.includes(centerHero.id) ? 1 : 0)}
                    </div>
                  </div>

                  <div className="mt-3 text-3xl font-black tracking-[-0.03em]">
                    {centerHero.name}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <SellerChip
                      name={centerHero.sellerName}
                      image={centerHero.sellerImage}
                    />

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                        Current Price
                      </div>
                      <div className="text-xl font-black text-amber-300">
                        {centerHero.price}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {rightHero && (
            <Link
              href={`/market/card/${rightHero.id}`}
              className="absolute right-8 bottom-0 hidden lg:block"
            >
              <div className="group relative">
                <img
                  src={rightHero.image}
                  alt={rightHero.name}
                  className="h-[400px] w-[270px] rotate-[10deg] rounded-[30px] object-cover shadow-[0_24px_90px_rgba(0,0,0,0.42)] transition duration-500 hover:scale-105"
                />

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLike(rightHero.id);
                  }}
                  className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/45 p-2.5 backdrop-blur-md"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      likedCards.includes(rightHero.id)
                        ? "fill-pink-500 text-pink-500"
                        : "text-white"
                    }`}
                  />
                </button>

                <div className="absolute inset-x-3 bottom-3 rounded-[24px] border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
                  <div className="line-clamp-2 text-base font-black leading-tight">
                    {rightHero.name}
                  </div>

                  <div className="mt-2">
                    <SellerChip
                      name={rightHero.sellerName}
                      image={rightHero.sellerImage}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-base font-bold text-amber-300">
                      {rightHero.price}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/65">
                      <Heart className="h-3.5 w-3.5 fill-pink-500 text-pink-500" />
                      {rightHero.likes +
                        (likedCards.includes(rightHero.id) ? 1 : 0)}
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
          subtitle="สร้างรายการขายการ์ดจริงแบบรวดเร็ว"
        />
        <ActionButton
          href="/market/deals"
          icon={<Handshake className="h-5 w-5" />}
          title="Deal Requests"
          subtitle="ดูคำขอดีล ตอบรับ และติดตามสถานะ"
        />
        <ActionButton
          href="/market/wishlist"
          icon={<Heart className="h-5 w-5" />}
          title="Wishlist"
          subtitle="การ์ดที่กำลังติดตามและเล็งไว้"
        />
        <ActionButton
          href="/market/seller-center"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Seller Center"
          subtitle="จัดการโพสต์ ราคา และการขาย"
        />
      </section>

      {/* MARKET GRID */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4 lg:mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-violet-300/70">
              Curated listings
            </div>
            <div className="mt-2 text-2xl font-black lg:text-3xl">
              🛒 Marketplace Listings
            </div>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold text-white/55 md:block">
            {sortedItems.length} items live
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-5">
          {sortedItems.map((card) => {
            const rarity = rarityClasses(card.rarity);
            const liked = likedCards.includes(card.id);

            return (
              <Link
                key={card.id}
                href={`/market/card/${card.id}`}
                className={`group relative transition-all duration-500 hover:-translate-y-2 ${rarity.ring}`}
              >
                <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0d0f16] shadow-[0_22px_60px_rgba(0,0,0,0.4)] lg:rounded-[30px]">
                  <div className={`absolute inset-0 bg-gradient-to-b ${rarity.glow}`} />

                  <div className="relative aspect-[2/3] w-full overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.name}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />

                    <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white/75 backdrop-blur-md">
                      #{card.cardNo}
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleLike(card.id);
                      }}
                      className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-md transition hover:scale-105"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          liked
                            ? "fill-pink-500 text-pink-500"
                            : "text-white/70"
                        }`}
                      />
                    </button>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 lg:p-4">
                      <div
                        className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${rarity.badge}`}
                      >
                        {card.rarity}
                      </div>

                      <div className="line-clamp-2 text-sm font-black leading-tight text-white lg:text-base">
                        {card.name}
                      </div>

                      <div className="mt-1 text-xs font-bold text-amber-300 lg:text-sm">
                        {card.price}
                      </div>

                      {card.sellerId && (
                        <div className="mt-2">
                          <SellerChip
                            name={card.sellerName}
                            image={card.sellerImage}
                            compact
                          />
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-1 text-[10px] text-white/50">
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
      </section>
    </div>
  );
}