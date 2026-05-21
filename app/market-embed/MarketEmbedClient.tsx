"use client";

import SafeCardImage from "@/components/SafeCardImage";
import type { MarketViewItem } from "@/lib/market-listing-view";

type Props = {
  items: MarketViewItem[];
};

const TOP3_BACKGROUND_URL =
  "https://r4.wallpaperflare.com/wallpaper/976/74/465/multiple-display-mountains-snow-nature-wallpaper-c1b4ba2a902ec5b27032d3c4aefe604d.jpg";

function openMarketLogin() {
  const target = new URL(
    "/login?callbackUrl=%2Fmarket",
    window.location.origin
  ).toString();

  window.open(target, "_blank", "noopener,noreferrer");
}

export default function MarketEmbedClient({ items }: Props) {
  const top3 = items.slice(0, 3);
  const [centerHero, leftHero, rightHero] = top3;

  return (
    <main className="min-h-[100dvh] bg-[#050608] text-white">
      <button
        type="button"
        aria-label="Open NEX POINT market in a new tab"
        onClick={openMarketLogin}
        className="fixed inset-0 z-30 cursor-pointer bg-transparent"
      />

      <section className="relative z-10 min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_30%),linear-gradient(180deg,#101216_0%,#050608_100%)]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#050608]/92 px-4 py-3 backdrop-blur-2xl sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.32em] text-amber-300/90">
                NEXORA MARKET
              </div>
              <h1 className="mt-1 truncate text-lg font-black tracking-[-0.03em] text-white sm:text-2xl">
                Marketplace Preview
              </h1>
            </div>
            <div className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
              Tap to Enter
            </div>
          </div>
        </div>

        {centerHero ? (
          <div className="pointer-events-none relative z-10 p-3 sm:p-5">
            <section className="relative overflow-hidden rounded-[26px] border border-white/75 bg-[#edf2fb] px-4 py-5 text-[#09090b] shadow-[0_24px_70px_rgba(20,20,30,0.14)] ring-1 ring-black/5 sm:rounded-[34px] sm:px-7 sm:py-8">
              <div className="absolute inset-0">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-100"
                  style={{ backgroundImage: `url(${TOP3_BACKGROUND_URL})` }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.46),rgba(237,242,251,0.62))]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.44),transparent_25%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.20),transparent_36%)]" />
              </div>

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.42em] text-black/36">
                    NEXORA ELITE MARKET
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.06em] sm:text-4xl">
                    FEATURED TOP 3
                  </h2>
                </div>
                <div className="hidden rounded-full border border-black/10 bg-white/72 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/58 shadow-[0_16px_34px_rgba(20,20,30,0.10)] sm:block">
                  Latest Listings
                </div>
              </div>

              <div className="relative mt-5 grid grid-cols-3 items-end gap-2 sm:mt-8 sm:grid-cols-[0.82fr_1fr_0.82fr] sm:gap-4">
                {leftHero ? (
                  <FeaturedCard item={leftHero} rank="02" compact tilt="left" />
                ) : null}
                <FeaturedCard item={centerHero} rank="01" featured />
                {rightHero ? (
                  <FeaturedCard item={rightHero} rank="03" compact tilt="right" />
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        <div className="pointer-events-none relative z-10 grid grid-cols-2 gap-3 p-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] sm:gap-4 sm:p-5 xl:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          {items.length > 0 ? (
            items.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.045] shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-black">
                  <SafeCardImage
                    cardNo={item.cardNo}
                    imageUrl={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))] p-3">
                    <div className="w-fit rounded-full border border-amber-300/35 bg-black/52 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
                      {item.rarity}
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-white">
                    {item.name}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-base font-black text-amber-300">
                      {item.price}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white/60">
                      {item.likes.toLocaleString("th-TH")}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-[11px] font-bold text-white/42">
                    {item.sellerName || "NEXORA Seller"}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-full flex min-h-[60dvh] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
              <div>
                <div className="text-xl font-black text-white">
                  Market preview is loading
                </div>
                <div className="mt-2 text-sm font-bold text-white/45">
                  Tap to open NEX POINT Marketplace
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function FeaturedCard({
  item,
  rank,
  compact = false,
  featured = false,
  tilt = "none",
}: {
  item: MarketViewItem;
  rank: string;
  compact?: boolean;
  featured?: boolean;
  tilt?: "left" | "right" | "none";
}) {
  const compactTiltClass =
    tilt === "left"
      ? "hidden sm:block sm:-mb-3 sm:rotate-[-4deg]"
      : tilt === "right"
        ? "hidden sm:block sm:-mb-3 sm:rotate-[4deg]"
        : "hidden sm:block sm:-mb-3";

  return (
    <article
      className={`relative overflow-hidden rounded-[18px] border border-white/20 bg-black shadow-[0_20px_64px_rgba(0,0,0,0.28)] sm:rounded-[26px] ${
        compact ? compactTiltClass : ""
      }`}
    >
      <div
        className={
          featured
            ? "h-[210px] sm:h-[360px] lg:h-[420px]"
            : "h-[150px] sm:h-[285px] lg:h-[330px]"
        }
      >
        <SafeCardImage
          cardNo={item.cardNo}
          imageUrl={item.image}
          alt={item.name}
          loading={featured ? "eager" : "lazy"}
          fetchPriority={featured ? "high" : "auto"}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute left-2 top-2 rounded-full border border-amber-300/35 bg-black/60 px-2 py-1 text-[9px] font-black tracking-[0.12em] text-amber-100 backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:text-xs">
        TOP {rank}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.92))] p-2 sm:p-4">
        <div className="line-clamp-2 text-[11px] font-black leading-tight text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.92)] sm:text-base lg:text-lg">
          {item.name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 sm:mt-2 sm:gap-3">
          <span className="text-xs font-black text-amber-300 [text-shadow:0_4px_18px_rgba(0,0,0,0.92)] sm:text-lg lg:text-xl">
            {item.price}
          </span>
          <span className="hidden rounded-full border border-white/12 bg-white/10 px-2 py-1 text-[10px] font-black text-white/70 sm:inline-flex">
            {item.likes.toLocaleString("th-TH")}
          </span>
        </div>
        <div className="mt-1 truncate text-[9px] font-bold text-white/58 sm:mt-2 sm:text-xs">
          {item.sellerName || "NEXORA Seller"}
        </div>
      </div>
    </article>
  );
}
