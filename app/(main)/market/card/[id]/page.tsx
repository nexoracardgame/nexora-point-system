import Link from "next/link";
import { prisma } from "@/lib/prisma";

import Card3DPreview from "./Card3DPreview";
import RequestDealButton from "./RequestDealButton";
import WishlistButton from "./WishlistButton";
import CardStatsClient from "./CardStatsClient";

async function getListing(id: string) {
  return prisma.marketListing.findUnique({
    where: { id },
    select: {
      id: true,
      cardNo: true,
      serialNo: true,
      price: true,
      sellerId: true,
      status: true,
      likes: true,
      views: true,
      createdAt: true,
      cardName: true,
      imageUrl: true,
      rarity: true,
      seller: {
        select: {
          id: true,
          displayName: true,
          name: true,
          image: true,
        },
      },
    },
  });
}

async function getLiveCard(cardNo: string) {
  try {
    const res = await fetch(
      `http://localhost:3000/api/market/card-live?cardNo=${cardNo}`,
      { cache: "no-store" }
    );
    return await res.json();
  } catch {
    return null;
  }
}

function getLocalCardImage(cardNo: string) {
  return `/cards/${String(cardNo || "").trim().padStart(3, "0")}.jpg`;
}

function splitRewardBadges(reward?: string) {
  const text = String(reward || "").trim();
  if (!text) return [];

  return text
    .split(/🎴|🀄/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getRarityStyle(rarity?: string) {
  const text = String(rarity || "").toLowerCase();

  if (text.includes("diamond") || text.includes("เพชร")) {
    return {
      badge:
        "border-cyan-300/30 bg-cyan-400/15 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.18)]",
    };
  }

  if (text.includes("gold") || text.includes("ทอง")) {
    return {
      badge:
        "border-amber-300/30 bg-amber-400/15 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.18)]",
    };
  }

  return {
    badge:
      "border-violet-300/30 bg-violet-400/15 text-violet-200 shadow-[0_0_30px_rgba(168,85,247,0.16)]",
  };
}

export default async function MarketCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    return (
      <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-6 text-white">
        Card listing not found
      </div>
    );
  }

  const liveCard = await getLiveCard(String(listing.cardNo));

  const ownerName =
    listing.seller?.displayName ||
    listing.seller?.name ||
    "Unknown Seller";

  const rewardBadges = splitRewardBadges(
    (listing as any)?.reward || ""
  );

  const rarityStyle = getRarityStyle(listing.rarity || undefined);

  const card = {
    name: `${listing.cardName || "Unknown"} #No.${String(
      listing.cardNo
    ).padStart(3, "0")}`,
    cardNo: String(listing.cardNo).padStart(3, "0"),
    price: `฿${Number(listing.price || 0).toLocaleString()}`,
    rarity: listing.rarity || "Legendary",
    views: Number(listing.views || 0),
    image:
      listing.imageUrl ||
      getLocalCardImage(String(listing.cardNo)),
    remoteImageUrl: listing.imageUrl || "",
    owner: ownerName,
    rewardBadges,
    history:
      liveCard?.history?.length > 0
        ? liveCard.history.map((h: any) => ({
            time: new Date(h.createdAt).toLocaleString("th-TH"),
            text: h.detail,
          }))
        : [
            {
              time: "ล่าสุด",
              text: "กำลังเป็นที่นิยมในตลาดสะสม",
            },
          ],
    bidders:
      liveCard?.bidders?.length > 0
        ? liveCard.bidders.map(
            (b: any) =>
              `${b.buyerName || b.buyerId} เสนอ ${b.offeredPrice} NEX`
          )
        : ["ยังไม่มีคำขอดีลล่าสุด"],
    rarityChance: "0.03%",
  };

  return (
    <div className="space-y-4 text-white md:space-y-6">
      {/* HERO */}
      <section className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-4 md:rounded-[36px] md:p-6">
        <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300 md:text-[11px] md:tracking-[0.35em]">
          NEXORA MARKET / CARD DETAIL
        </p>

        <h1 className="mt-3 text-2xl font-black leading-[0.95] tracking-[-0.04em] sm:text-4xl md:mt-4 md:text-6xl xl:text-7xl">
          {card.name}
        </h1>
      </section>

      {/* MAIN */}
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] md:gap-6">
        {/* MOBILE preview first */}
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-3 md:rounded-[34px] md:p-5">
          <Card3DPreview
            image={card.image}
            name={card.name}
            cardNo={card.cardNo}
            remoteImageUrl={card.remoteImageUrl}
          />
        </div>

        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-4 md:rounded-[34px] md:p-6">
          <div className="mb-4 flex flex-wrap gap-2 md:mb-5">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold md:px-4 md:text-sm ${rarityStyle.badge}`}
            >
              {card.rarity}
            </span>

            {card.rewardBadges.slice(0, 3).map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-white/80 md:text-xs"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 md:rounded-[24px] md:p-5">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 md:text-xs md:tracking-[0.28em]">
              Current Owner
            </div>

            <Link
              href={`/profile/${listing.sellerId}`}
              className="mt-2 block text-xl font-black transition hover:text-violet-300 sm:text-2xl md:mt-3 md:text-3xl"
            >
              {card.owner}
            </Link>
          </div>         

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:mt-5 md:gap-4">
            <StatCard
              label="Price"
              value={card.price}
              color="text-orange-400"
            />

            <CardStatsClient
              cardNo={card.cardNo}
              listingId={listing.id}
              initialViews={card.views}
              initialLikes={Number(listing.likes || 0)}
            />

            <StatCard
              label="Drop Rate"
              value={card.rarityChance}
              color="text-violet-300"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-6">
            <RequestDealButton
              cardId={listing.id}
              sellerId={listing.sellerId}
/>

            <WishlistButton
              listingId={listing.id}
              cardNo={card.cardNo}
              cardName={card.name}
              sellerName={card.owner}
            />
          </div>
        </div>
      </section>

      {/* PANELS */}
      <section className="grid gap-4 xl:grid-cols-2 md:gap-6">
        <Panel title="Live Price Graph">
          <div className="relative h-36 rounded-[20px] border border-white/6 bg-[#090b12] md:h-44 md:rounded-[24px]">
            <svg viewBox="0 0 300 120" className="h-full w-full">
              <path
                d="M20 100 C60 80, 90 75, 120 60 S190 30, 220 20 S260 18, 280 10"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </Panel>

        <Panel title="Ownership Timeline">
          <div className="space-y-3">
            {card.history.map((h: any) => (
              <div
                key={`${h.time}-${h.text}`}
                className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 md:rounded-[20px] md:py-4"
              >
                <div className="text-xs font-semibold md:text-sm">
                  {h.time}
                </div>
                <div className="mt-1 text-xs text-white/70 md:text-sm">
                  {h.text}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Bidders Realtime">
         <div className="space-y-3">
           {card.bidders.map((b: string) => (
             <div
               key={b}
               className="rounded-[18px] border border-emerald-400/10 bg-emerald-500/10 px-4 py-3 text-xs md:rounded-[20px] md:text-sm"
             >
              {b}
             </div>
          ))}
        </div>
      </Panel>

        <Panel title="Rarity Probability">
          <div className="flex items-center gap-3 rounded-[20px] border border-white/6 bg-white/[0.03] p-4 md:gap-4 md:rounded-[24px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-violet-400/30 text-xs font-black text-violet-300 md:h-16 md:w-16 md:text-sm">
              {card.rarityChance}
            </div>

            <p className="text-xs text-white/70 md:text-sm">
              {card.rarity} drop chance extremely rare
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/6 bg-white/[0.03] p-3 md:rounded-[22px] md:p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 md:text-xs">
        {label}
      </div>
      <div className={`mt-2 text-sm font-black md:mt-3 md:text-lg ${color}`}>
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-4 md:rounded-[28px] md:p-6">
      <h3 className="mb-3 text-lg font-black text-white md:mb-4 md:text-xl">
        {title}
      </h3>
      {children}
    </div>
  );
}