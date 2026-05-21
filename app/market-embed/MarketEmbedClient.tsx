"use client";

import SafeCardImage from "@/components/SafeCardImage";
import type { MarketViewItem } from "@/lib/market-listing-view";

type Props = {
  items: MarketViewItem[];
};

function openMarketLogin() {
  const target = new URL(
    "/login?callbackUrl=%2Fmarket",
    window.location.origin
  ).toString();

  window.open(target, "_blank", "noopener,noreferrer");
}

export default function MarketEmbedClient({ items }: Props) {
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
