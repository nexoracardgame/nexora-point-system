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
import { prisma } from "@/lib/prisma";
import CardStatsClient from "./CardStatsClient";
import RequestDealButton from "./RequestDealButton";
import WishlistButton from "./WishlistButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getLocalCardImage(cardNo: string) {
  return `/cards/${String(cardNo || "").trim().padStart(3, "0")}.jpg`;
}

function formatCurrency(value: number, locale: Locale) {
  return `฿${Number(value || 0).toLocaleString(getLocaleTag(locale))}`;
}

function formatDateTime(date: Date, locale: Locale) {
  return date.toLocaleString(getLocaleTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  user?: { displayName?: string | null; name?: string | null }
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

  const listing = await prisma.marketListing.findUnique({
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

  if (!listing) {
    return (
      <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-6 text-white">
        Card listing not found
      </div>
    );
  }

  const relatedListings = await prisma.marketListing.findMany({
    where: {
      cardNo: listing.cardNo,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      cardNo: true,
      price: true,
      createdAt: true,
      status: true,
      sellerId: true,
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

  const relatedListingIds = relatedListings.map((item) => item.id);

  const [
    historyRows,
    offerRows,
    sameRarityActiveCount,
    totalActiveListings,
    latestCompletedDeal,
    completedDealsForCard,
  ] = await Promise.all([
    relatedListingIds.length
      ? prisma.marketHistory.findMany({
          where: {
            listingId: {
              in: relatedListingIds,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 18,
          include: {
            listing: {
              select: {
                id: true,
                price: true,
                seller: {
                  select: {
                    displayName: true,
                    name: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.dealRequest.findMany({
      where: {
        cardId: listing.id,
        status: {
          in: ["pending", "accepted", "completed"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      include: {
        buyer: {
          select: {
            id: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    }),
    prisma.marketListing.count({
      where: {
        NOT: {
          status: "sold",
        },
        rarity: listing.rarity || null,
      },
    }),
    prisma.marketListing.count({
      where: {
        NOT: {
          status: "sold",
        },
      },
    }),
    listing.status === "sold"
      ? prisma.dealRequest.findFirst({
          where: {
            cardId: listing.id,
            status: "completed",
          },
          orderBy: {
            createdAt: "desc",
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
          },
        })
      : Promise.resolve(null),
    relatedListingIds.length
      ? prisma.dealRequest.findMany({
          where: {
            cardId: {
              in: relatedListingIds,
            },
            status: "completed",
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            offeredPrice: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const openOffers = offerRows.filter(
    (item) => item.status === "pending" || item.status === "accepted"
  ).length;

  const currentProfileUser = latestCompletedDeal?.buyer || listing.seller;
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
    `${openOffers} open offer${openOffers === 1 ? "" : "s"}`,
    `${listing.likes} likes`,
    `${listing.views} views`,
    formatRelativeDays(listing.createdAt, locale),
    String(listing.status || "active").toUpperCase(),
  ].filter(Boolean) as string[];

  const marketSnapshots = [...relatedListings]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((item) => ({
      price: Number(item.price || 0),
      createdAt: item.createdAt,
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
        time: item.createdAt,
        label: formatDateTime(item.createdAt, locale),
        text: `${sellerName} listed this card for ${formatCurrency(
          Number(item.price || 0),
          locale
        )}`,
      };
    }),
    ...historyRows.map((item) => {
      const sellerName = getDisplayName(locale, item.listing?.seller);
      const detail = String(item.detail || "").trim();

      return {
        time: item.createdAt,
        label: formatDateTime(item.createdAt, locale),
        text:
          detail ||
          describeHistoryAction(
            String(item.action || ""),
            sellerName,
            locale,
            item.price ?? item.listing?.price ?? null
          ),
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
      time: formatDateTime(deal.createdAt, locale),
      image: deal.buyer.image || "/avatar.png",
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

  return (
    <div className="space-y-4 text-white md:space-y-6">
      <section className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-4 md:rounded-[36px] md:p-6">
        <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300 md:text-[11px] md:tracking-[0.35em]">
          {translate(locale, "market.card.header")}
        </p>

        <h1 className="mt-3 text-2xl font-black leading-[0.95] tracking-[-0.04em] sm:text-4xl md:mt-4 md:text-6xl xl:text-7xl">
          {card.name}
        </h1>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr] md:gap-6">
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-3 md:rounded-[34px] md:p-5">
          <CardStaticPreview image={card.image} name={card.name} />
        </div>

        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#171726_0%,#101119_100%)] p-4 md:rounded-[34px] md:p-6">
          <div className="mb-4 flex flex-wrap gap-2 md:mb-5">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold md:px-4 md:text-sm ${rarityStyle.badge}`}
            >
              {card.rarity}
            </span>

            {card.rewardBadges.slice(0, 5).map((badge) => (
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
              {currentOwnerLabel}
            </div>

            <Link
              href={currentProfileHref}
              className="mt-2 block text-xl font-black transition hover:text-violet-300 sm:text-2xl md:mt-3 md:text-3xl"
            >
              {card.owner}
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:mt-5 md:gap-4">
            <StatCard label="Price" value={card.price} color="text-orange-400" />

            <CardStatsClient
              cardNo={card.cardNo}
              listingId={listing.id}
              initialViews={card.views}
              initialLikes={Number(listing.likes || 0)}
            />

            <StatCard
              label={translate(locale, "market.card.openOffers")}
              value={String(openOffers)}
              color="text-emerald-300"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-6">
            <RequestDealButton cardId={listing.id} sellerId={listing.sellerId} />

            <WishlistButton
              listingId={listing.id}
              cardNo={card.cardNo}
              cardName={card.name}
              sellerName={card.owner}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 md:gap-6">
        <Panel title={translate(locale, "market.card.marketSignal")}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs text-white/60 md:text-sm">
              <MiniMetric
                label={translate(locale, "market.card.low")}
                value={formatCurrency(priceLow, locale)}
              />
              <MiniMetric
                label={translate(locale, "market.card.fairPrice")}
                value={formatCurrency(priceMedian, locale)}
              />
              <MiniMetric
                label={translate(locale, "market.card.high")}
                value={formatCurrency(priceHigh, locale)}
              />
            </div>

            <div className="relative h-36 rounded-[20px] border border-white/6 bg-[#090b12] md:h-44 md:rounded-[24px]">
              {pricePoints.length > 1 ? (
                <svg viewBox="0 0 320 120" className="h-full w-full">
                  <path
                    d={pricePath}
                    fill="none"
                    stroke="#8b5cf6"
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

            {pricingReference.length > 0 ? (
              <div className="space-y-1 text-xs text-white/45 md:text-sm">
                <div>
                  {settledSnapshots.length >= 2
                    ? translate(locale, "market.card.completedDeals", {
                        count: pricingReference.length,
                        cardNo: card.cardNo,
                      })
                    : translate(locale, "market.card.askingPrices", {
                        count: pricingReference.length,
                        cardNo: card.cardNo,
                      })}
                </div>
                <div>{translate(locale, "market.card.medianHint")}</div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title={translate(locale, "market.card.timeline")}>
          <div className="space-y-3">
            {timelineEvents.length > 0 ? (
              timelineEvents.map((item) => (
                <div
                  key={`${item.label}-${item.text}`}
                  className="rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 md:rounded-[20px] md:py-4"
                >
                  <div className="text-xs font-semibold md:text-sm">{item.label}</div>
                  <div className="mt-1 text-xs text-white/70 md:text-sm">
                    {item.text}
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

        <Panel title={translate(locale, "market.card.recentOffers")}>
          <div className="space-y-3">
            {recentOffers.length > 0 ? (
              recentOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center gap-3 rounded-[18px] border border-emerald-400/10 bg-emerald-500/10 px-4 py-3 text-xs md:rounded-[20px] md:text-sm"
                >
                  <Image
                    src={offer.image}
                    alt={offer.buyerName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white/90">
                      {offer.text}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55">
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

        <Panel title={translate(locale, "market.card.rarityShare")}>
          <div className="flex items-center gap-3 rounded-[20px] border border-white/6 bg-white/[0.03] p-4 md:gap-4 md:rounded-[24px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-violet-400/30 text-xs font-black text-violet-300 md:h-16 md:w-16 md:text-sm">
              {formatPercent(rarityMarketShare)}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-white/70 md:text-sm">
                {translate(locale, "market.card.rarityDesc", {
                  rarity: listing.rarity || "-",
                  same: sameRarityActiveCount,
                  total: totalActiveListings,
                })}
              </p>
              <p className="text-[11px] text-white/45 md:text-xs">
                {translate(locale, "market.card.rarityHint")}
              </p>
            </div>
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

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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

function CardStaticPreview({
  image,
  name,
}: {
  image: string;
  name: string;
}) {
  return (
    <div className="group relative mx-auto w-full max-w-[460px] [perspective:1600px]">
      <div className="absolute inset-0 scale-[1.08] rounded-[44px] bg-gradient-to-br from-yellow-300/10 via-orange-400/5 to-amber-500/10 blur-2xl" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[44px]">
        <div className="absolute left-10 top-10 h-2 w-2 animate-pulse rounded-full bg-yellow-300/70" />
        <div className="absolute right-12 top-24 h-1.5 w-1.5 animate-ping rounded-full bg-orange-300/60" />
        <div className="absolute bottom-20 left-16 h-2 w-2 animate-pulse rounded-full bg-amber-200/60" />
      </div>

      <div className="relative rounded-[44px] bg-gradient-to-br from-[#ffe082] via-[#ffca28] to-[#ff9800] p-[2px] shadow-[0_0_65px_rgba(255,180,0,0.22)] transition duration-300 ease-out group-hover:scale-[1.01]">
        <div className="rounded-[41px] bg-[#07090c] p-3">
          <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-[32px] border border-yellow-300/20">
            <Image
              src={image}
              alt={name}
              fill
              priority
              sizes="(max-width: 768px) 88vw, 460px"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/10 via-pink-300/10 to-yellow-300/10 mix-blend-screen opacity-80" />
            <div className="absolute inset-x-0 top-0 h-24 animate-pulse bg-gradient-to-b from-white/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
