import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  BadgeCheck,
  Gem,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import DeleteListingButton from "@/components/DeleteListingButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildRankLabel,
  buildSellerScore,
  buildTopPercent,
  buildTrustScore,
} from "@/lib/seller-rank";

function formatCurrency(value: number) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id;
  const isOwner = currentUserId === id;

  const seller = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      displayName: true,
      image: true,
      coverImage: true,
      coverPosition: true,
      bio: true,
      facebookUrl: true,
      lineUrl: true,
      createdAt: true,
    },
  });

  if (!seller) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-white">
        Seller not found
      </div>
    );
  }

  const [
    listings,
    soldHistory,
    reviewAggregate,
    sellerListingStats,
    sellerSoldStats,
    sellerReviewStats,
    nowRow,
  ] = await Promise.all([
    prisma.marketListing.findMany({
      where: {
        sellerId: id,
        status: {
          in: ["active", "ACTIVE"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.marketHistory.findMany({
      where: {
        action: "sold",
        OR: [{ sellerId: id }, { listing: { sellerId: id } }],
      },
      include: {
        listing: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 24,
    }),
    prisma.sellerReview.aggregate({
      where: {
        sellerId: id,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    }),
    prisma.marketListing.groupBy({
      by: ["sellerId"],
      _count: {
        id: true,
      },
      _sum: {
        likes: true,
      },
    }),
    prisma.marketHistory.groupBy({
      by: ["sellerId"],
      where: {
        action: "sold",
        sellerId: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        price: true,
      },
    }),
    prisma.sellerReview.groupBy({
      by: ["sellerId"],
      _count: {
        id: true,
      },
      _avg: {
        rating: true,
      },
    }),
    prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`,
  ]);

  const listingStatMap = new Map(
    sellerListingStats.map((item) => [
      item.sellerId,
      {
        activeListings: item._count.id,
        totalLikes: Number(item._sum.likes || 0),
      },
    ])
  );

  const soldStatMap = new Map(
    sellerSoldStats
      .filter((item) => item.sellerId)
      .map((item) => [
        String(item.sellerId),
        {
          soldCount: item._count.id,
          totalVolume: Number(item._sum.price || 0),
        },
      ])
  );

  const reviewStatMap = new Map(
    sellerReviewStats.map((item) => [
      item.sellerId,
      {
        avgRating: Number(item._avg.rating || 0),
        reviewCount: item._count.id,
      },
    ])
  );

  const sellerIds = new Set<string>([
    ...listingStatMap.keys(),
    ...soldStatMap.keys(),
    ...reviewStatMap.keys(),
    seller.id,
  ]);

  const usersForRanking = await prisma.user.findMany({
    where: {
      id: {
        in: [...sellerIds],
      },
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  const now = nowRow[0]?.now?.getTime() || seller.createdAt.getTime();
  const ranking = usersForRanking
    .map((user) => {
      const listingStats = listingStatMap.get(user.id);
      const soldStats = soldStatMap.get(user.id);
      const reviewStats = reviewStatMap.get(user.id);

      const metrics = {
        soldCount: soldStats?.soldCount || 0,
        totalVolume: soldStats?.totalVolume || 0,
        activeListings: listingStats?.activeListings || 0,
        totalLikes: listingStats?.totalLikes || 0,
        avgRating: reviewStats?.avgRating || 0,
        reviewCount: reviewStats?.reviewCount || 0,
        accountAgeDays: Math.max(
          1,
          Math.floor((now - user.createdAt.getTime()) / 86400000)
        ),
      };

      return {
        userId: user.id,
        score: buildSellerScore(metrics),
      };
    })
    .filter(
      (item) =>
        item.score > 0 || item.userId === seller.id
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.userId.localeCompare(b.userId);
    });

  const sellerListingMetrics = listingStatMap.get(seller.id);
  const sellerSoldMetrics = soldStatMap.get(seller.id);
  const sellerReviewMetrics = reviewStatMap.get(seller.id);

  const metrics = {
    soldCount: sellerSoldMetrics?.soldCount || 0,
    totalVolume: sellerSoldMetrics?.totalVolume || 0,
    activeListings: sellerListingMetrics?.activeListings || listings.length,
    totalLikes: sellerListingMetrics?.totalLikes || 0,
    avgRating: Number(reviewAggregate._avg.rating || sellerReviewMetrics?.avgRating || 0),
    reviewCount: reviewAggregate._count.rating || sellerReviewMetrics?.reviewCount || 0,
    accountAgeDays: Math.max(
      1,
      Math.floor((now - seller.createdAt.getTime()) / 86400000)
    ),
  };

  const completedDeals = metrics.soldCount;
  const totalVolume = metrics.totalVolume;
  const trustScore = buildTrustScore(metrics);
  const sellerScore = buildSellerScore(metrics);
  const sellerRank = buildRankLabel(sellerScore);

  const sellerRankIndex = ranking.findIndex((item) => item.userId === seller.id);
  const topPercent = buildTopPercent(
    sellerRankIndex >= 0 ? sellerRankIndex + 1 : ranking.length || 1,
    Math.max(ranking.length, 1)
  );

  const isVerifiedSeller = trustScore >= 78 || completedDeals >= 3;
  const reputationLabel =
    topPercent <= 1
      ? "Top 1% Seller"
      : topPercent <= 3
        ? `Top ${topPercent}% Seller`
        : `Top ${topPercent}% Marketplace Seller`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#23124d_0%,#0a0b10_40%,#05070d_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[10%] top-[10%] h-[240px] w-[240px] rounded-full bg-violet-500/10 blur-3xl sm:h-[420px] sm:w-[420px]" />
        <div className="absolute bottom-[10%] right-[8%] h-[220px] w-[220px] rounded-full bg-amber-400/10 blur-3xl sm:h-[360px] sm:w-[360px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-5 p-3 sm:space-y-6 sm:p-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_25px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[42px]">
          <div className="relative h-[220px] overflow-hidden sm:h-[340px]">
            <img
              src={seller.coverImage || "/seller-cover.jpg"}
              alt="Seller Cover"
              className="h-full w-full object-cover"
              style={{
                objectPosition: `center ${seller.coverPosition ?? 50}%`,
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#090b12] via-black/25 to-transparent" />

            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-xl sm:left-6 sm:top-6">
              <ShieldCheck className="h-4 w-4" />
              {isVerifiedSeller ? "Verified Seller" : "Growing Seller"}
            </div>

            <div className="absolute right-4 top-4 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300 backdrop-blur-xl sm:right-6 sm:top-6">
              TOP {topPercent}%
            </div>
          </div>

          <div className="relative px-4 pb-5 sm:px-8 sm:pb-8">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-20 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative">
                  <img
                    src={seller.image || "/avatar.png"}
                    alt={seller.name || "seller"}
                    className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-[0_0_50px_rgba(139,92,246,0.25)] sm:h-32 sm:w-32"
                  />
                  <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-[#090b12] bg-emerald-400" />
                </div>

                <div className="pb-1 sm:pb-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                      {seller.displayName || seller.name || "Unknown Seller"}
                    </h1>
                    <BadgeCheck className="h-6 w-6 text-emerald-300 sm:h-7 sm:w-7" />
                  </div>

                  <p className="mt-2 max-w-xl text-sm text-zinc-300 sm:text-base">
                    {seller.bio ||
                      "Genesis-tier NEXORA trader with elite collectible market presence."}
                  </p>

                  {(seller.lineUrl || seller.facebookUrl) && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {seller.lineUrl && (
                        <a
                          href={seller.lineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-full border border-green-400/20 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-300 transition hover:bg-green-500/20 hover:scale-[1.03]"
                        >
                          LINE
                        </a>
                      )}

                      {seller.facebookUrl && (
                        <a
                          href={seller.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/20 hover:scale-[1.03]"
                        >
                          Facebook
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-violet-400/20 bg-violet-500/10 px-5 py-4 text-left shadow-[0_0_40px_rgba(139,92,246,0.12)] sm:px-6 sm:text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-xs">
                  Seller Rank
                </div>
                <div className="mt-1 text-2xl font-black text-violet-300 sm:text-3xl">
                  {sellerRank}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-4 sm:gap-4">
              {[
                {
                  label: "Deals",
                  value: completedDeals,
                  color: "text-emerald-300",
                },
                {
                  label: "Listings",
                  value: listings.length,
                  color: "text-violet-300",
                },
                {
                  label: "Volume",
                  value: formatCurrency(totalVolume),
                  color: "text-amber-300",
                },
                {
                  label: "Trust",
                  value: `${trustScore}%`,
                  color: "text-cyan-300",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[22px] border border-white/5 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-3xl sm:p-5"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-400 sm:text-xs">
                    {stat.label}
                  </div>
                  <div
                    className={`mt-2 text-2xl font-black sm:text-3xl ${stat.color}`}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:rounded-[40px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black sm:text-4xl">
                Active Listings
              </h2>
              <p className="mt-1 text-xs text-white/45 sm:text-sm">
                Premium collectible cards currently on market
              </p>
            </div>

            <div className="w-fit rounded-full bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-300 sm:text-sm">
              {listings.length} ACTIVE
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 xl:grid-cols-3">
            {listings.length > 0 ? (
              listings.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_70px_rgba(139,92,246,0.15)]"
                >
                  <Link href={`/market/card/${item.id}`}>
                    <div className="relative overflow-hidden">
                      <img
                        src={
                          item.imageUrl ||
                          `/cards/${String(item.cardNo).padStart(3, "0")}.jpg`
                        }
                        alt={String(item.cardNo)}
                        className="aspect-[2.5/3.5] w-full object-cover transition duration-700 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

                      <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs font-bold backdrop-blur-md">
                        #{item.cardNo}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="text-2xl font-black leading-tight">
                          {item.cardName ||
                            `Card #${String(item.cardNo).padStart(3, "0")}`}
                        </div>

                        <div className="mt-1 text-sm text-white/55">
                          Serial
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-xl font-black text-amber-300">
                          <Gem className="h-4 w-4" />
                          {formatCurrency(Number(item.price))}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div
                    className={`grid gap-3 p-4 ${
                      isOwner ? "grid-cols-3" : "grid-cols-1"
                    }`}
                  >
                    {isOwner && (
                      <>
                        <Link
                          href={`/market/edit/${item.id}`}
                          className="rounded-2xl bg-violet-500/10 px-4 py-3 text-center text-sm font-bold text-violet-300 transition hover:bg-violet-500/20"
                        >
                          Edit
                        </Link>

                        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-1 transition hover:bg-red-500/20">
                          <DeleteListingButton id={item.id} />
                        </div>
                      </>
                    )}

                    <Link
                      href={`/market/card/${item.id}`}
                      className="rounded-2xl bg-white/[0.04] px-4 py-3 text-center text-sm font-bold text-white/80 transition hover:bg-white/[0.08]"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400 sm:rounded-3xl">
                No active listings yet
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:rounded-[40px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-amber-300 sm:text-4xl">
                Sold Cards
              </h2>
              <p className="mt-1 text-xs text-white/45 sm:text-sm">
                Successfully completed marketplace sales
              </p>
            </div>

            <div className="w-fit rounded-full bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 sm:text-sm">
              {soldHistory.length} SOLD
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 xl:grid-cols-4">
            {soldHistory.length > 0 ? (
              soldHistory.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition duration-500 hover:-translate-y-1 hover:border-amber-400/30 hover:shadow-[0_0_70px_rgba(251,191,36,0.12)]"
                >
                  <div className="relative overflow-hidden">
                    <img
                      src={
                        item.listing?.imageUrl ||
                        `/cards/${String(item.listing?.cardNo || "001").padStart(3, "0")}.jpg`
                      }
                      alt={item.listing?.cardName || "Sold Card"}
                      className="aspect-[2.5/3.5] w-full object-cover transition duration-700 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

                    <div className="absolute left-4 top-4 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 backdrop-blur-md">
                      SOLD
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="text-xl font-black leading-tight">
                        {item.listing?.cardName || "Unknown Card"}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-lg font-black text-amber-300">
                        <Gem className="h-4 w-4" />
                        {formatCurrency(Number(item.price || item.listing?.price || 0))}
                      </div>

                      <div className="mt-2 text-xs text-white/55">
                        {new Date(item.createdAt).toLocaleDateString("th-TH")}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400 sm:rounded-3xl">
                No completed sales yet
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-gradient-to-r from-violet-500/10 to-amber-400/10 p-5 shadow-[0_0_50px_rgba(251,191,36,0.08)] sm:rounded-[36px] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 sm:text-xs">
                Reputation Score
              </div>
              <div className="mt-2 text-3xl font-black sm:text-5xl">
                {reputationLabel}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-emerald-300 sm:text-base">
              <TrendingUp className="h-5 w-5" />
              Ranked from live marketplace performance
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
