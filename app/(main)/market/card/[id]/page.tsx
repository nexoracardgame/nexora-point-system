import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import {
  getLocaleTag,
  resolveLocale,
  translate,
  type Locale,
} from "@/lib/i18n-core";
import {
  getMarketListingById,
  getMarketListings,
} from "@/lib/market-listings";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/thai-time";
import CardStatsClient from "./CardStatsClient";
import RequestDealButton from "./RequestDealButton";
import WishlistButton from "./WishlistButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DetailListing = {
  id: string;
  cardNo: string;
  serialNo: string | null;
  price: number;
  sellerId: string;
  status: string;
  likes: number;
  views: number;
  createdAt: string | Date;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  seller: {
    id: string;
    displayName: string | null;
    name: string | null;
    image: string | null;
  } | null;
};

type RelatedListing = {
  id: string;
  cardNo: string;
  price: number;
  createdAt: string | Date;
  status: string;
  sellerId: string;
  seller: {
    id: string;
    displayName: string | null;
    name: string | null;
    image: string | null;
  } | null;
};

type OfferRow = {
  id: string;
  createdAt: string | Date;
  sellerId: string;
  buyerId: string;
  cardId: string;
  status: string;
  offeredPrice: number;
  buyer: {
    id: string;
    displayName: string | null;
    name: string | null;
    image: string | null;
  } | null;
};

type CompletedDealSnapshot = {
  offeredPrice: number;
  createdAt: string | Date;
};

function getLocalCardImage(cardNo: string) {
  return `/cards/${String(cardNo || "").trim().padStart(3, "0")}.jpg`;
}

function toDate(value?: string | Date | null) {
  if (value instanceof Date) return value;
  return new Date(String(value || "1970-01-01T00:00:00.000Z"));
}

function formatCurrency(value: number, locale: Locale) {
  return `฿${Number(value || 0).toLocaleString(getLocaleTag(locale))}`;
}

function formatDateTime(date: Date, locale: Locale) {
  return formatThaiDateTime(date, getLocaleTag(locale));
}

function formatRelativeDays(date: Date, locale: Locale) {
  const diff = Date.now() - date.getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));

  if (days === 0) return translate(locale, "market.card.listedToday");
  if (days === 1) return translate(locale, "market.card.listedOneDay");
  return translate(locale, "market.card.listedDays", { count: days });
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function getMedian(values: number[]) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function getDisplayName(
  locale: Locale,
  user?: { displayName?: string | null; name?: string | null } | null
) {
  return (
    user?.displayName ||
    user?.name ||
    translate(locale, "market.card.unknownUser")
  );
}

function getRarityStyle(rarity?: string) {
  const text = String(rarity || "").toLowerCase();

  if (text.includes("diamond")) {
    return {
      badge:
        "border-cyan-300/30 bg-cyan-400/15 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.18)]",
    };
  }

  if (text.includes("gold")) {
    return {
      badge:
        "border-amber-300/30 bg-amber-400/15 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.18)]",
    };
  }

  if (text.includes("bronze")) {
    return {
      badge:
        "border-orange-300/30 bg-orange-400/15 text-orange-200 shadow-[0_0_30px_rgba(251,146,60,0.16)]",
    };
  }

  return {
    badge:
      "border-violet-300/30 bg-violet-400/15 text-violet-200 shadow-[0_0_30px_rgba(168,85,247,0.16)]",
  };
}

function buildPricePath(values: number[]) {
  if (!values.length) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 300;
  const step = values.length === 1 ? 0 : width / (values.length - 1);

  return values
    .map((value, index) => {
      const normalized = max === min ? 0.5 : (value - min) / (max - min);
      const x = 20 + index * Math.min(step, 65);
      const y = 100 - normalized * 70;
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

function describeHistoryAction(
  action: string,
  sellerName: string,
  locale: Locale,
  price?: number | null
) {
  const formattedPrice = price ? formatCurrency(price, locale) : "";

  if (action === "sold") {
    return translate(locale, "market.card.completedSale", {
      seller: sellerName,
      price: formattedPrice,
    });
  }

  if (action === "deal_accepted") {
    return translate(locale, "market.card.acceptedOffer", {
      seller: sellerName,
      price: formattedPrice,
    });
  }

  return translate(locale, "market.card.updatedListing", {
    seller: sellerName,
  });
}

export default async function MarketCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("nexora_locale")?.value);
  const [baseListing, allListings] = await Promise.all([
    getMarketListingById(id),
    getMarketListings(),
  ]);

  const listing: DetailListing | null = baseListing
    ? {
        ...baseListing,
        seller: {
          id: baseListing.sellerId,
          displayName: baseListing.sellerName,
          name: baseListing.sellerName,
          image: baseListing.sellerImage,
        },
      }
    : null;

  if (!listing) {
    return (
      <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-6 text-white">
        {translate(locale, "market.card.unavailable")}
      </div>
    );
  }

  const relatedListings: RelatedListing[] = allListings
    .filter((item) => item.cardNo === String(listing.cardNo))
    .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
    .map((item) => ({
      id: item.id,
      cardNo: item.cardNo,
      price: Number(item.price || 0),
      createdAt: item.createdAt,
      status: item.status,
      sellerId: item.sellerId,
      seller: {
        id: item.sellerId,
        displayName: item.sellerName,
        name: item.sellerName,
        image: item.sellerImage,
      },
    }));

  const relatedListingIds = relatedListings.map((item) => item.id);
  const allDeals = relatedListingIds.length
    ? await prisma.dealRequest.findMany({
        where: {
          cardId: {
            in: relatedListingIds,
          },
        },
        include: {
          buyer: {
            select: {
              id: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
          seller: {
            select: {
              id: true,
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : [];

  const offerRows: OfferRow[] = allDeals
    .filter(
      (item) =>
        item.cardId === listing.id &&
        ["pending", "accepted", "completed"].includes(item.status)
    )
    .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      sellerId: item.sellerId,
      buyerId: item.buyerId,
      cardId: item.cardId,
      status: item.status,
      offeredPrice: Number(item.offeredPrice || 0),
      buyer: {
        id: item.buyerId,
        displayName: item.buyer.displayName,
        name: item.buyer.name,
        image: item.buyer.image,
      },
    }));

  const activeListings = allListings.filter(
    (item) => String(item.status || "").toLowerCase() !== "sold"
  );
  const sameRarityActiveCount = activeListings.filter(
    (item) => String(item.rarity || "") === String(listing.rarity || "")
  ).length;
  const totalActiveListings = activeListings.length;
  const latestCompletedDeal: OfferRow | null =
    allDeals
      .filter((item) => item.cardId === listing.id && item.status === "completed")
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      .map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        sellerId: item.sellerId,
        buyerId: item.buyerId,
        cardId: item.cardId,
        status: item.status,
        offeredPrice: Number(item.offeredPrice || 0),
        buyer: {
          id: item.buyerId,
          displayName: item.buyer.displayName,
          name: item.buyer.name,
          image: item.buyer.image,
        },
      }))[0] || null;

  const completedDealsForCard: CompletedDealSnapshot[] = allDeals
    .filter(
      (item) =>
        relatedListingIds.includes(item.cardId) && item.status === "completed"
    )
    .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
    .map((item) => ({
      offeredPrice: Number(item.offeredPrice || 0),
      createdAt: item.createdAt,
    }));

  const openOffers = offerRows.filter(
    (item) => item.status === "pending" || item.status === "accepted"
  ).length;

  const currentProfileUser = latestCompletedDeal?.buyer || listing.seller;
  const sellerProfileName = getDisplayName(locale, listing.seller);
  const currentProfileName = getDisplayName(locale, currentProfileUser);
  const currentProfileHref = currentProfileUser?.id
    ? `/profile/${currentProfileUser.id}`
    : `/profile/${listing.sellerId}`;
  const currentOwnerLabel = latestCompletedDeal
    ? translate(locale, "market.card.currentOwner")
    : translate(locale, "market.card.currentSeller");
  const rarityStyle = getRarityStyle(listing.rarity || undefined);

  const badgeItems = [
    listing.serialNo ? "Serial" : null,
    formatRelativeDays(toDate(listing.createdAt), locale),
  ].filter(Boolean) as string[];

  const marketSnapshots = [...relatedListings]
    .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
    .map((item) => ({
      price: Number(item.price || 0),
      createdAt: toDate(item.createdAt),
    }))
    .filter((item) => item.price > 0);

  const settledSnapshots = completedDealsForCard
    .map((item) => ({
      price: Number(item.offeredPrice || 0),
      createdAt: item.createdAt,
    }))
    .filter((item) => item.price > 0);

  const pricingReference =
    settledSnapshots.length >= 2 ? settledSnapshots : marketSnapshots;
  const pricePoints = pricingReference.map((item) => item.price).slice(-6);
  const pricePath = buildPricePath(pricePoints);
  const priceMedian = pricePoints.length ? getMedian(pricePoints) : 0;
  const priceLow = pricePoints.length ? Math.min(...pricePoints) : 0;
  const priceHigh = pricePoints.length ? Math.max(...pricePoints) : 0;

  const timelineEvents = [
    ...relatedListings.map((item) => {
      const sellerName = getDisplayName(locale, item.seller);
      return {
        time: toDate(item.createdAt),
        label: formatDateTime(toDate(item.createdAt), locale),
        text: `${sellerName} listed this card for ${formatCurrency(
          Number(item.price || 0),
          locale
        )}`,
      };
    }),
    ...allDeals
      .filter(
        (item) =>
          relatedListingIds.includes(item.cardId) &&
          ["accepted", "completed"].includes(item.status)
      )
      .map((item) => {
        const eventTime = toDate(item.createdAt);
        const sellerName = getDisplayName(locale, item.seller);
        const detail =
          item.status === "completed"
            ? describeHistoryAction(
                "sold",
                sellerName,
                locale,
                Number(item.offeredPrice || 0)
              )
            : describeHistoryAction(
                "deal_accepted",
                sellerName,
                locale,
                Number(item.offeredPrice || 0)
              );

        return {
          time: eventTime,
          label: formatDateTime(eventTime, locale),
          text: detail,
        };
      }),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8);

  const rarityMarketShare = totalActiveListings
    ? (sameRarityActiveCount / totalActiveListings) * 100
    : 0;

  const recentOffers = offerRows.map((deal) => {
    const buyerName = getDisplayName(locale, deal.buyer);
    const statusLabel =
      deal.status === "completed"
        ? "Completed"
        : deal.status === "accepted"
          ? "Accepted"
          : "Pending";

    return {
      id: deal.id,
      buyerName,
      text: `${buyerName} offered ${formatCurrency(
        Number(deal.offeredPrice || 0),
        locale
      )}`,
      time: formatDateTime(toDate(deal.createdAt), locale),
      image: deal.buyer?.image || "/avatar.png",
      statusLabel,
    };
  });

  const card = {
    name: `${listing.cardName || "Unknown"} #No.${String(listing.cardNo).padStart(3, "0")}`,
    cardNo: String(listing.cardNo).padStart(3, "0"),
    price: formatCurrency(Number(listing.price || 0), locale),
    rarity: listing.rarity || "Unspecified",
    views: Number(listing.views || 0),
    image: listing.imageUrl || getLocalCardImage(String(listing.cardNo)),
    remoteImageUrl: listing.imageUrl || "",
    owner: currentProfileName,
    rewardBadges: badgeItems,
  };

  const statusTone =
    String(listing.status || "").toLowerCase() === "sold"
      ? "border-rose-400/25 bg-rose-400/12 text-rose-200"
      : "border-emerald-400/25 bg-emerald-400/12 text-emerald-200";
  const latestCompletedPrice = latestCompletedDeal
    ? formatCurrency(Number(latestCompletedDeal.offeredPrice || 0), locale)
    : null;
  const floorPriceDisplay = priceLow ? formatCurrency(priceLow, locale) : "-";
  const medianPriceDisplay = priceMedian ? formatCurrency(priceMedian, locale) : "-";
  const topPriceDisplay = priceHigh ? formatCurrency(priceHigh, locale) : "-";

  return (
    <div className="space-y-4 text-white md:space-y-6">
      <section className="relative overflow-hidden rounded-[22px] border border-white/5 bg-[#050507] px-4 py-3 shadow-[0_20px_80px_rgba(0,0,0,0.6)] md:px-6 md:py-4">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,215,0,0.04),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
        <div className="absolute right-[-10%] top-[-15%] h-40 w-40 rounded-full bg-amber-300/10 blur-xl md:h-72 md:w-72" />
        <div className="absolute bottom-[-15%] left-[-5%] h-32 w-32 rounded-full bg-violet-400/10 blur-xl md:h-56 md:w-56" />
        <div className="relative space-y-4">
        <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,215,0,0.15),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_100%,rgba(168,85,247,0.15),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.04),transparent)] motion-safe:motion-safe:animate-pulse" />
        </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-200/15 bg-white/[0.03] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.32em] text-amber-100/88 md:px-4 md:text-[10px]">
              {translate(locale, "market.card.header")}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] md:px-4 md:text-[10px] ${statusTone}`}
            >
              {String(listing.status || "active")}
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px] xl:items-end">
            <div className="space-y-3">
              <h1 className="max-w-4xl text-[2.4rem] font-black leading-[0.9] tracking-[-0.08em] 
              sm:text-[3.6rem] lg:text-[4.2rem] xl:text-[5rem]
              bg-gradient-to-b from-white via-white to-white/40 
              bg-clip-text text-transparent
              drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                {card.name}
              </h1>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-4 py-2 text-[11px] font-semibold md:text-sm ${rarityStyle.badge}`}
                >
                  {card.rarity}
                </span>

                {card.rewardBadges.slice(0, 2).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] text-white/62 backdrop-blur"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.008))] p-4 backdrop-blur md:rounded-[28px] md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-white/38">
                    Live Price
                  </div>
                  <div className="mt-2 text-[2.2rem] md:text-[3rem] font-black tracking-[-0.05em] 
                 text-amber-300 
                 drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]
                 motion-safe:animate-pulse">
                   {card.price}
                </div>
                
                </div>
                <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/55">
                  #{card.cardNo}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <HeroMetric
                  label="Median"
                  value={medianPriceDisplay}
                  tone="text-cyan-300"
                />
                <HeroMetric
                  label="Last Sale"
                  value={latestCompletedPrice || "-"}
                  tone="text-emerald-300"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:gap-6">
        <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.06),transparent_32%),linear-gradient(180deg,rgba(18,18,24,0.76)_0%,rgba(8,9,11,0.42)_100%)] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.34)] md:rounded-[36px] md:p-5">
          <CardStaticPreview image={card.image} name={card.name} />
        </div>

        <div className="space-y-4 md:space-y-6">
          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,24,0.62)_0%,rgba(9,10,12,0.22)_100%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur md:rounded-[34px] md:p-6">
            <div className="flex items-start gap-4">
              <Image
                src={listing.seller?.image || "/avatar.png"}
                alt={card.owner}
                width={56}
                height={56}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
              />

              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/40 md:text-[11px]">
                  {currentOwnerLabel}
                </div>
                <Link
                  href={currentProfileHref}
                  className="mt-1 block truncate text-2xl font-black tracking-[-0.03em] transition hover:text-violet-300 md:text-3xl"
                >
                  {card.owner}
                </Link>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/65 md:text-xs">
                  <span className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5">
                    Card #{card.cardNo}
                  </span>
                  {listing.serialNo ? (
                    <span className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5">
                      Serial {listing.serialNo}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5">
                    {formatRelativeDays(toDate(listing.createdAt), locale)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-3">
              <StatCard
                label={translate(locale, "market.card.openOffers")}
                value={String(openOffers)}
                color="text-emerald-300"
              />

              <CardStatsClient
                cardNo={card.cardNo}
                listingId={listing.id}
                initialViews={card.views}
                initialLikes={Number(listing.likes || 0)}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-6">
              {String(listing.status || "").toLowerCase() !== "sold" && (
                <RequestDealButton
                  cardId={listing.id}
                  sellerId={listing.sellerId}
                  sellerName={sellerProfileName}
                  sellerImage={listing.seller?.image || "/avatar.png"}
                  cardName={card.name}
                  cardNo={card.cardNo}
                  cardImage={card.image}
                  listedPrice={Number(listing.price || 0)}
                  serialNo={listing.serialNo}
                />
              )}

              <WishlistButton
                listingId={listing.id}
                cardNo={card.cardNo}
                cardName={card.name}
                sellerName={sellerProfileName}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <InsightCard
              eyebrow={translate(locale, "market.card.low")}
              value={floorPriceDisplay}
              hint="Market floor"
            />
            <InsightCard
              eyebrow={translate(locale, "market.card.fairPrice")}
              value={medianPriceDisplay}
              hint="Balanced zone"
              accent="text-cyan-300"
            />
            <InsightCard
              eyebrow="Last sale"
              value={latestCompletedPrice || "-"}
              hint={latestCompletedPrice ? "Most recent completed deal" : "No completed sale yet"}
              accent="text-emerald-300"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 md:hidden">
        <MobileAccordionPanel
          title={translate(locale, "market.card.marketSignal")}
          subtitle="Pricing and position"
          defaultOpen
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric
                label={translate(locale, "market.card.low")}
                value={floorPriceDisplay}
              />
              <MiniMetric
                label={translate(locale, "market.card.fairPrice")}
                value={medianPriceDisplay}
              />
            </div>
            <div className="rounded-[18px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                  Price Wave
                </div>
                <div className="text-[10px] text-white/42">{pricePoints.length} pts</div>
              </div>
              <div className="relative h-28 overflow-hidden rounded-[16px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),transparent_48%),linear-gradient(180deg,#0a0c13_0%,#07090e_100%)]">
                {pricePoints.length > 1 ? (
                  <svg viewBox="0 0 320 120" className="h-full w-full">
                    <defs>
                      <linearGradient id="priceWaveMobile" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="55%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <path
                      d={pricePath}
                      fill="none"
                      stroke="url(#priceWaveMobile)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/45">
                    {translate(locale, "market.card.notEnoughHistory")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </MobileAccordionPanel>

        <MobileAccordionPanel
          title={translate(locale, "market.card.timeline")}
          subtitle="Ownership trail"
        >
          <div className="space-y-3">
            {timelineEvents.slice(0, 3).map((item, index) => (
              <div
                key={`${item.label}-${item.text}`}
                className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10 text-[10px] font-black text-violet-200">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white/90">{item.label}</div>
                    <div className="mt-1 text-xs leading-5 text-white/62">{item.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MobileAccordionPanel>

        <MobileAccordionPanel
          title={translate(locale, "market.card.recentOffers")}
          subtitle="Buyer pressure"
        >
          <div className="space-y-3">
            {recentOffers.length > 0 ? (
              recentOffers.slice(0, 3).map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center gap-3 rounded-[18px] border border-emerald-400/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(255,255,255,0.02))] px-4 py-3"
                >
                  <Image
                    src={offer.image}
                    alt={offer.buyerName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-2xl object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white/92">
                      {offer.text}
                    </div>
                    <div className="mt-1 text-[11px] text-white/50">{offer.time}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
                {translate(locale, "market.card.noOffers")}
              </div>
            )}
          </div>
        </MobileAccordionPanel>
      </section>

      <section className="hidden gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] md:grid md:gap-6">
        <Panel
          title={translate(locale, "market.card.marketSignal")}
          subtitle="Clean market readout for pricing and positioning"
        >
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[22px] border border-white/8 bg-[#090b12] p-4 md:rounded-[26px] md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.24em] text-white/38">
                    Price Wave
                  </div>
                  <div className="text-xs text-white/45">
                    {pricePoints.length} point{pricePoints.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="relative h-40 overflow-hidden rounded-[18px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),transparent_48%),linear-gradient(180deg,#0a0c13_0%,#07090e_100%)] md:h-48">
                  {pricePoints.length > 1 ? (
                    <svg viewBox="0 0 320 120" className="h-full w-full">
                      <defs>
                        <linearGradient id="priceWave" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="55%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                      </defs>
                      <path
                        d={pricePath}
                        fill="none"
                        stroke="url(#priceWave)"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/45">
                      {translate(locale, "market.card.notEnoughHistory")}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <MiniMetric
                  label={translate(locale, "market.card.low")}
                  value={floorPriceDisplay}
                />
                <MiniMetric
                  label={translate(locale, "market.card.fairPrice")}
                  value={medianPriceDisplay}
                />
                <MiniMetric
                  label={translate(locale, "market.card.high")}
                  value={topPriceDisplay}
                />
              </div>
            </div>

            <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 md:rounded-[24px]">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Rarity Position
                  </div>
                  <div className="mt-2 text-2xl font-black text-violet-300 md:text-3xl">
                    {formatPercent(rarityMarketShare)}
                  </div>
                </div>

                <div className="text-sm leading-6 text-white/68">
                  {translate(locale, "market.card.rarityDesc", {
                    rarity: listing.rarity || "-",
                    same: sameRarityActiveCount,
                    total: totalActiveListings,
                  })}
                </div>
              </div>

              {pricingReference.length > 0 ? (
                <div className="mt-4 text-xs text-white/45 md:text-sm">
                  {settledSnapshots.length >= 2
                    ? translate(locale, "market.card.completedDeals", {
                        count: pricingReference.length,
                        cardNo: card.cardNo,
                      })
                    : translate(locale, "market.card.askingPrices", {
                        count: pricingReference.length,
                        cardNo: card.cardNo,
                      })}{" "}
                  {translate(locale, "market.card.medianHint")}
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel
          title={translate(locale, "market.card.timeline")}
          subtitle="Ownership and pricing trail"
        >
          <div className="space-y-3">
            {timelineEvents.length > 0 ? (
              timelineEvents.map((item, index) => (
                <div
                  key={`${item.label}-${item.text}`}
                  className="relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10 text-[11px] font-black text-violet-200">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white/92 md:text-sm">
                        {item.label}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-white/65 md:text-sm">
                        {item.text}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 text-xs text-white/55 md:rounded-[20px] md:text-sm">
                {translate(locale, "market.card.noHistory")}
              </div>
            )}
          </div>
        </Panel>
      </section>

      <section className="hidden gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:grid md:gap-6">
        <Panel
          title={translate(locale, "market.card.recentOffers")}
          subtitle="Live buyer pressure around this card"
        >
          <div className="space-y-3">
            {recentOffers.length > 0 ? (
              recentOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center gap-3 rounded-[20px] border border-emerald-400/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(255,255,255,0.02))] px-4 py-3 md:py-4"
                >
                  <Image
                    src={offer.image}
                    alt={offer.buyerName}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white/92">
                      {offer.text}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                      <span>{offer.time}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/65">
                        {offer.statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 text-xs text-white/55 md:rounded-[20px] md:text-sm">
                {translate(locale, "market.card.noOffers")}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Listing Snapshot"
          subtitle="Everything critical at a glance"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <SnapshotRow label="Card Number" value={card.cardNo} />
            <SnapshotRow label="Rarity" value={card.rarity} />
            <SnapshotRow label="Highest reference" value={topPriceDisplay} />
            <SnapshotRow
              label="Owner profile"
              value={card.owner}
              href={currentProfileHref}
            />
            <SnapshotRow
              label="Seller profile"
              value={sellerProfileName}
              href={`/profile/${listing.sellerId}`}
            />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.008))] p-3 backdrop-blur md:rounded-[20px] md:p-4">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/42 md:text-[11px]">
        {label}
      </div>
      <div className={`mt-2 text-base font-black tracking-[-0.03em] md:text-xl ${tone}`}>
        {value}
      </div>
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
    <div className="rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.008))] p-3 md:rounded-[20px] md:p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 md:text-xs">
        {label}
      </div>
      <div className={`mt-2 text-sm font-black tracking-[-0.02em] md:mt-3 md:text-lg ${color}`}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.008))] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-black tracking-[-0.02em] text-white md:text-base">
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/7 bg-[linear-gradient(180deg,rgba(18,18,24,0.46)_0%,rgba(9,10,12,0.16)_100%)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur md:rounded-[28px] md:p-6">
      
      <div className="mb-4 md:mb-5">
        <h3 className="text-lg font-black tracking-[-0.03em] text-white md:text-2xl">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-xs text-white/45 md:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function InsightCard({
  eyebrow,
  value,
  hint,
  accent = "text-white",
}: {
  eyebrow: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/7 bg-[linear-gradient(180deg,rgba(18,18,24,0.4)_0%,rgba(8,9,11,0.14)_100%)] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.26)] backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">
        {eyebrow}
      </div>
      <div className={`mt-2 text-2xl font-black tracking-[-0.04em] ${accent}`}>
        {value}
      </div>
      <div className="mt-2 text-xs text-white/45">{hint}</div>
    </div>
  );
}

function MobileAccordionPanel({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,rgba(18,18,24,0.44)_0%,rgba(9,10,12,0.16)_100%)] shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur"
    >
      <summary className="cursor-pointer list-none px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-black tracking-[-0.03em] text-white">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-xs text-white/42">{subtitle}</div>
            ) : null}
          </div>
          <div className="text-lg text-white/36 transition group-open:rotate-45">+</div>
        </div>
      </summary>
      <div className="border-t border-white/6 px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

function SnapshotRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white/88 md:text-base">
        {value}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-[18px] border border-white/7 bg-white/[0.02] px-4 py-4 transition hover:border-amber-300/20 hover:bg-white/[0.04]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-[18px] border border-white/7 bg-white/[0.02] px-4 py-4">
      {content}
    </div>
  );
}

function CardStaticPreview({
  image,
  name,
}: {
  image: string;
  name: string;
}) {
  return (
    <div className="group relative mx-auto w-full max-w-[500px] [perspective:2200px]">
      <div className="absolute inset-0 scale-[1.08] rounded-[52px] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_34%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.05),transparent_30%)] blur-xl" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 blur-md hidden md:block animate-[shine_3s_linear_infinite]" />
    </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[52px]">
        <div className="absolute left-10 top-10 h-2 w-2 motion-safe:animate-pulse rounded-full bg-yellow-300/70" />
        <div className="absolute right-12 top-24 h-1.5 w-1.5 animate-ping rounded-full bg-cyan-300/60" />
        <div className="absolute bottom-20 left-16 h-2 w-2 motion-safe:animate-pulse rounded-full bg-violet-300/60" />
      </div>

      <div className="relative rounded-[52px] bg-[linear-gradient(145deg,rgba(250,204,21,0.92)_0%,rgba(251,146,60,0.55)_26%,rgba(255,255,255,0.22)_100%)] p-[1px] shadow-[0_0_80px_rgba(245,158,11,0.16)] transition duration-500 ease-out group-hover:-translate-y-1 group-hover:rotate-[0.6deg]">
        <div className="rounded-[49px] bg-[linear-gradient(180deg,rgba(6,8,13,0.92)_0%,rgba(10,13,18,0.72)_100%)] p-3 md:p-4">
          <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-[36px] border border-white/10">
            <Image
              src={image}
              alt={name}
              fill
              priority
              sizes="(max-width: 768px) 92vw, 500px"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
            />

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/12 via-transparent to-amber-300/12 mix-blend-screen opacity-90" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/18 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
