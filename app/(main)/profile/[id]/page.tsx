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
import ProfileChatButton from "@/components/ProfileChatButton";
import ProfileFriendButton from "@/components/ProfileFriendButton";
import ProfileShareButton from "@/components/ProfileShareButton";
import { authOptions } from "@/lib/auth";
import { getMarketListings } from "@/lib/market-listings";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/thai-time";
import {
  buildRankLabel,
  buildSellerScore,
  buildTopPercent,
  buildTrustScore,
} from "@/lib/seller-rank";

function formatCurrency(value: number) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

type ActiveListing = {
  id: string;
  cardNo: number | string | null;
  cardName: string | null;
  serialNo: string | null;
  imageUrl: string | null;
  price: number | null;
};

type SoldHistoryItem = {
  id: string;
  createdAt: string | Date;
  price: number | null;
  listing: {
    cardNo: number | string | null;
    cardName: string | null;
    imageUrl: string | null;
    price: number | null;
  } | null;
};

type ReviewAggregate = {
  _avg: { rating: number | null };
  _count: { rating: number };
};

type SellerProfileFallback = {
  id: string;
  name: string | null;
  displayName: string | null;
  image: string | null;
  coverImage: string | null;
  coverPosition: number | null;
  bio: string | null;
  facebookUrl: string | null;
  lineUrl: string | null;
  createdAt: Date;
};

function getSnapshotSellerName(
  snapshot:
    | {
        seller?: {
          displayName?: string | null;
          name?: string | null;
        } | null;
        sellerName?: string | null;
      }
    | null
) {
  return (
    snapshot?.seller?.displayName ||
    snapshot?.seller?.name ||
    snapshot?.sellerName ||
    "NEXORA User"
  );
}

function getSnapshotSellerImage(
  snapshot:
    | {
        seller?: {
          image?: string | null;
        } | null;
        sellerImage?: string | null;
      }
    | null
) {
  return snapshot?.seller?.image || snapshot?.sellerImage || "/avatar.png";
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
  const sessionUser = (session?.user || {}) as {
    id?: string;
    name?: string | null;
    image?: string | null;
  };

  const [allListings, allDeals] = await Promise.all([
    getMarketListings(),
    prisma.dealRequest.findMany({
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
    }),
  ]);
  const localProfile = await getLocalProfileByUserId(id);

  const activeMarketListings = allListings.filter(
    (item) => String(item.status || "").toLowerCase() !== "sold"
  );

  const sellerListings = activeMarketListings
    .filter((item) => item.sellerId === id)
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

  const completedSales = allDeals
    .filter((item) => item.sellerId === id && item.status === "completed")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const sellerSnapshot =
    sellerListings[0] ||
    completedSales[0] ||
    allDeals.find((item) => item.sellerId === id) ||
    null;

  let seller: SellerProfileFallback | null = null;

  if (!seller && isOwner && currentUserId) {
    seller = {
      id: currentUserId,
      name: localProfile?.displayName || sessionUser.name || "NEXORA User",
      displayName:
        localProfile?.displayName || sessionUser.name || "NEXORA User",
      image: localProfile?.image || sessionUser.image || "/avatar.png",
      coverImage: localProfile?.coverImage || null,
      coverPosition: localProfile?.coverPosition ?? 50,
      bio: localProfile?.bio || null,
      facebookUrl: localProfile?.facebookUrl || null,
      lineUrl: localProfile?.lineUrl || null,
      createdAt: new Date(),
    };
  }

  if (!seller && localProfile) {
    seller = {
      id,
      name: localProfile.displayName || "NEXORA User",
      displayName: localProfile.displayName || "NEXORA User",
      image: localProfile.image || "/avatar.png",
      coverImage: localProfile.coverImage || null,
      coverPosition: localProfile.coverPosition ?? 50,
      bio: localProfile.bio || null,
      facebookUrl: localProfile.facebookUrl || null,
      lineUrl: localProfile.lineUrl || null,
      createdAt: new Date(localProfile.updatedAt),
    };
  }

  if (!seller && sellerSnapshot) {
    seller = {
      id,
      name: localProfile?.displayName || getSnapshotSellerName(sellerSnapshot),
      displayName:
        localProfile?.displayName || getSnapshotSellerName(sellerSnapshot),
      image: localProfile?.image || getSnapshotSellerImage(sellerSnapshot),
      coverImage: localProfile?.coverImage || null,
      coverPosition: localProfile?.coverPosition ?? 50,
      bio: localProfile?.bio || null,
      facebookUrl: localProfile?.facebookUrl || null,
      lineUrl: localProfile?.lineUrl || null,
      createdAt: new Date(String(sellerSnapshot.createdAt)),
    };
  }

  if (!seller) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-white">
        Seller not found
      </div>
    );
  }

  const listings: ActiveListing[] = sellerListings.map((item) => ({
    id: item.id,
    cardNo: item.cardNo,
    cardName: item.cardName,
    serialNo: item.serialNo,
    imageUrl: item.imageUrl,
    price: Number(item.price || 0),
  }));

  const listingById = new Map(allListings.map((item) => [item.id, item]));

  const soldHistory: SoldHistoryItem[] = completedSales.slice(0, 24).map(
    (item) => ({
      id: item.id,
      createdAt: item.createdAt,
      price: Number(item.offeredPrice || 0),
      listing: {
        cardNo: listingById.get(item.cardId)?.cardNo || null,
        cardName: listingById.get(item.cardId)?.cardName || null,
        imageUrl: listingById.get(item.cardId)?.imageUrl || null,
        price: Number(item.offeredPrice || 0),
      },
    })
  );

  const reviewAggregate: ReviewAggregate = {
    _avg: { rating: null as number | null },
    _count: { rating: 0 },
  };

  const listingStatMap = new Map<
    string,
    { activeListings: number; totalLikes: number }
  >();

  activeMarketListings.forEach((item) => {
    const current = listingStatMap.get(item.sellerId) || {
      activeListings: 0,
      totalLikes: 0,
    };

    listingStatMap.set(item.sellerId, {
      activeListings: current.activeListings + 1,
      totalLikes: current.totalLikes + Number(item.likes || 0),
    });
  });

  const soldStatMap = new Map<string, { soldCount: number; totalVolume: number }>();

  allDeals
    .filter((item) => item.status === "completed")
    .forEach((item) => {
      const current = soldStatMap.get(item.sellerId) || {
        soldCount: 0,
        totalVolume: 0,
      };

      soldStatMap.set(item.sellerId, {
        soldCount: current.soldCount + 1,
        totalVolume: current.totalVolume + Number(item.offeredPrice || 0),
      });
    });

  const firstSeenMap = new Map<string, Date>();

  [...allListings, ...allDeals].forEach((item) => {
    const actorId = item.sellerId;
    if (!actorId) return;

    const createdAt = new Date(
      String(item.createdAt || seller.createdAt.toISOString())
    );
    const current = firstSeenMap.get(actorId);

    if (!current || createdAt.getTime() < current.getTime()) {
      firstSeenMap.set(actorId, createdAt);
    }
  });

  const sellerIds = new Set<string>([
    ...listingStatMap.keys(),
    ...soldStatMap.keys(),
    seller.id,
  ]);

  const listingTimes = allListings.map((item) =>
    new Date(String(item.createdAt)).getTime()
  );
  const dealTimes = allDeals.map((item) =>
    new Date(String(item.createdAt)).getTime()
  );

  const now = Math.max(
    seller.createdAt.getTime(),
    ...(listingTimes.length ? listingTimes : [seller.createdAt.getTime()]),
    ...(dealTimes.length ? dealTimes : [seller.createdAt.getTime()])
  );

  const ranking = [...sellerIds]
    .map((userId) => {
      const listingStats = listingStatMap.get(userId);
      const soldStats = soldStatMap.get(userId);
      const startedAt =
        firstSeenMap.get(userId) ||
        (userId === seller.id ? seller.createdAt : new Date(now));

      const metrics = {
        soldCount: soldStats?.soldCount || 0,
        totalVolume: soldStats?.totalVolume || 0,
        activeListings: listingStats?.activeListings || 0,
        totalLikes: listingStats?.totalLikes || 0,
        avgRating: 0,
        reviewCount: 0,
        accountAgeDays: Math.max(
          1,
          Math.floor((now - startedAt.getTime()) / 86400000)
        ),
      };

      return {
        userId,
        score: buildSellerScore(metrics),
      };
    })
    .filter((item) => item.score > 0 || item.userId === seller.id)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.userId.localeCompare(b.userId);
    });

  const sellerListingMetrics = listingStatMap.get(seller.id);
  const sellerSoldMetrics = soldStatMap.get(seller.id);
  const metrics = {
    soldCount: sellerSoldMetrics?.soldCount || 0,
    totalVolume: sellerSoldMetrics?.totalVolume || 0,
    activeListings: sellerListingMetrics?.activeListings || listings.length,
    totalLikes: sellerListingMetrics?.totalLikes || 0,
    avgRating: Number(reviewAggregate._avg.rating || 0),
    reviewCount: reviewAggregate._count.rating || 0,
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
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[42px]">
          <div className="relative h-[250px] overflow-hidden sm:h-[360px] xl:h-[430px]">
            <img
              src={seller.coverImage || "/seller-cover.jpg"}
              alt="Seller Cover"
              className="h-full w-full object-cover"
              style={{
                objectPosition: `center ${seller.coverPosition ?? 50}%`,
              }}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,217,102,0.22),transparent_26%),linear-gradient(180deg,rgba(8,8,12,0.04)_0%,rgba(8,8,12,0.26)_42%,rgba(10,10,18,0.92)_100%)]" />

            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/82 shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:left-6 sm:top-6">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Profile Studio
            </div>

            <div className="absolute left-4 top-16 flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-xl sm:left-6 sm:top-20">
              <ShieldCheck className="h-4 w-4" />
              {isVerifiedSeller ? "Verified Seller" : "Growing Seller"}
            </div>

            <div className="absolute right-4 top-4 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300 backdrop-blur-xl sm:right-6 sm:top-6">
              TOP {topPercent}%
            </div>
          </div>

          <div className="relative px-4 pb-5 sm:px-8 sm:pb-8 xl:px-10">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-20 xl:-mt-24">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="relative">
                    <div className="absolute inset-[-12px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.14)_0%,transparent_72%)]" />
                    <img
                      src={seller.image || "/avatar.png"}
                      alt={seller.name || "seller"}
                      className="relative h-24 w-24 rounded-full border-[4px] border-white/14 object-cover shadow-[0_22px_54px_rgba(0,0,0,0.44)] sm:h-32 sm:w-32 sm:border-[5px]"
                    />
                    <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-[#090b12] bg-emerald-400 sm:bottom-2 sm:right-2" />
                  </div>

                  <div className="min-w-0 pb-1 sm:pb-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/45">
                      โปรไฟล์นักขาย
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <h1 className="break-words text-[30px] font-black leading-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)] sm:text-5xl">
                        {seller.displayName || seller.name || "Unknown Seller"}
                      </h1>
                      <BadgeCheck className="h-6 w-6 text-emerald-300 sm:h-7 sm:w-7" />
                    </div>

                    {localProfile?.username ? (
                      <div className="mt-2 text-sm font-semibold text-violet-200/88 sm:text-base">
                        @{localProfile.username}
                      </div>
                    ) : null}

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68 sm:mt-3 sm:text-base">
                      {seller.bio ||
                        "Genesis-tier NEXORA trader with elite collectible market presence."}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <ProfileShareButton
                        userId={seller.id}
                        displayName={
                          seller.displayName || seller.name || "NEXORA User"
                        }
                      />

                      {seller.lineUrl && (
                        <a
                          href={seller.lineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-emerald-400/24 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200 transition hover:scale-[1.03] hover:bg-emerald-400/18"
                        >
                          LINE
                        </a>
                      )}

                      {seller.facebookUrl && (
                        <a
                          href={seller.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-sky-400/24 bg-sky-400/10 px-4 text-sm font-black text-sky-200 transition hover:scale-[1.03] hover:bg-sky-400/18"
                        >
                          Facebook
                        </a>
                      )}

                      {isOwner ? (
                        <Link
                          href="/dm"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-white/16 bg-[linear-gradient(180deg,rgba(245,243,255,0.88)_0%,rgba(226,232,240,0.74)_100%)] px-4 text-sm font-black text-black shadow-[0_18px_35px_rgba(255,255,255,0.12)] transition hover:scale-[1.03] hover:brightness-110"
                        >
                          แชท
                        </Link>
                      ) : (
                        <ProfileChatButton
                          targetUserId={seller.id}
                          targetUserName={
                            seller.displayName || seller.name || "User"
                          }
                          targetUserImage={seller.image || "/avatar.png"}
                          className="min-w-[132px]"
                        />
                      )}

                      {!isOwner ? (
                        <ProfileFriendButton
                          targetUserId={seller.id}
                          className="min-w-[132px]"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,24,0.78)_0%,rgba(8,8,13,0.88)_100%)] px-5 py-4 shadow-[0_30px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:min-w-[260px] sm:px-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/42">
                    Seller Rank
                  </div>
                  <div className="mt-2 text-2xl font-black text-violet-300 sm:text-4xl">
                    {sellerRank}
                  </div>
                  <div className="mt-2 text-sm text-white/52">
                    Ranked from live marketplace performance
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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
                    className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] p-4 backdrop-blur-xl sm:rounded-3xl sm:p-5"
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/42 sm:text-xs">
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

                        <div className="mt-1 text-sm text-white/55">Serial</div>

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
                          แก้ไข
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
                      ดูการ์ด
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
                        `/cards/${String(
                          item.listing?.cardNo || "001"
                        ).padStart(3, "0")}.jpg`
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
                        {formatCurrency(
                          Number(item.price || item.listing?.price || 0)
                        )}
                      </div>

                      <div className="mt-2 text-xs text-white/55">{formatThaiDate(item.createdAt)}</div>
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
