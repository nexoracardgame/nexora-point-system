import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import {
  BadgeCheck,
  Gem,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import SafeCardImage from "@/components/SafeCardImage";
import DeleteListingButton from "@/components/DeleteListingButton";
import ProfileChatButton from "@/components/ProfileChatButton";
import ProfileFriendButton from "@/components/ProfileFriendButton";
import ProfilePresenceDot from "@/components/ProfilePresenceDot";
import ProfileShareButton from "@/components/ProfileShareButton";
import { authOptions } from "@/lib/auth";
import { getMarketListingsBySeller } from "@/lib/market-listings";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/thai-time";
import {
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

function getSellerRankPresentation(score: number) {
  if (score >= 340) {
    return {
      label: "Market Legend",
      tone: "text-amber-100",
      aura:
        "border-amber-200/44 bg-[radial-gradient(circle_at_22%_0%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_72%_18%,rgba(250,204,21,0.34),transparent_42%),linear-gradient(145deg,rgba(133,77,14,0.86),rgba(9,9,12,0.97)_58%,rgba(0,0,0,0.99))] shadow-[0_0_46px_rgba(250,204,21,0.22)]",
    };
  }

  if (score >= 265) {
    return {
      label: "Deal Commander",
      tone: "text-fuchsia-100",
      aura:
        "border-fuchsia-200/38 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.20),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(217,70,239,0.28),transparent_42%),linear-gradient(145deg,rgba(88,28,135,0.82),rgba(8,8,12,0.97)_60%,rgba(0,0,0,0.99))] shadow-[0_0_42px_rgba(217,70,239,0.20)]",
    };
  }

  if (score >= 205) {
    return {
      label: "Diamond Elite",
      tone: "text-cyan-100",
      aura:
        "border-cyan-100/40 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.24),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(34,211,238,0.30),transparent_42%),linear-gradient(145deg,rgba(14,116,144,0.78),rgba(8,8,12,0.97)_60%,rgba(0,0,0,0.99))] shadow-[0_0_44px_rgba(34,211,238,0.22)]",
    };
  }

  if (score >= 145) {
    return {
      label: "Platinum Seller",
      tone: "text-violet-100",
      aura:
        "border-violet-200/38 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(167,139,250,0.28),transparent_42%),linear-gradient(145deg,rgba(76,29,149,0.78),rgba(8,8,12,0.97)_60%,rgba(0,0,0,0.99))] shadow-[0_0_42px_rgba(167,139,250,0.20)]",
    };
  }

  if (score >= 95) {
    return {
      label: "Premium Trader",
      tone: "text-violet-100",
      aura:
        "border-violet-200/32 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(139,92,246,0.22),transparent_42%),linear-gradient(145deg,rgba(46,16,101,0.72),rgba(8,8,12,0.97)_60%,rgba(0,0,0,0.99))] shadow-[0_0_36px_rgba(139,92,246,0.18)]",
    };
  }

  if (score >= 55) {
    return {
      label: "Silver Seller",
      tone: "text-slate-100",
      aura:
        "border-slate-100/32 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.24),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(226,232,240,0.18),transparent_42%),linear-gradient(145deg,rgba(51,65,85,0.70),rgba(8,8,12,0.97)_60%,rgba(0,0,0,0.99))] shadow-[0_0_34px_rgba(226,232,240,0.14)]",
    };
  }

  return {
    label: "New Seller",
    tone: "text-emerald-100",
    aura:
      "border-emerald-200/32 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(52,211,153,0.20),transparent_42%),linear-gradient(145deg,rgba(6,78,59,0.70),rgba(8,8,12,0.97)_60%,rgba(0,0,0,0.99))] shadow-[0_0_34px_rgba(52,211,153,0.14)]",
  };
}

function buildThaiTopPercentLabel(topPercent: number) {
  return topPercent <= 1
    ? "อยู่ในกลุ่มท็อป 1% ของผู้ขาย"
    : `TOP ${topPercent}% ของผู้ขายในตลาด`;
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

  const [
    localProfile,
    sellerFromDb,
    sellerListings,
    completedSales,
    latestSellerDeal,
    listingStatsRows,
    soldStatsRows,
    reviewAggregate,
  ] = await Promise.all([
    getLocalProfileByUserId(id),
    prisma.user
      .findUnique({
        where: {
          id,
        },
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
      })
      .catch(() => null),
    getMarketListingsBySeller(id),
    prisma.dealRequest
      .findMany({
        where: {
          sellerId: id,
          status: {
            equals: "completed",
            mode: "insensitive",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          cardId: true,
          offeredPrice: true,
          createdAt: true,
          sellerId: true,
          seller: {
            select: {
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
      })
      .catch(() => []),
    prisma.dealRequest
      .findFirst({
        where: {
          sellerId: id,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
          sellerId: true,
          seller: {
            select: {
              displayName: true,
              name: true,
              image: true,
            },
          },
        },
      })
      .catch(() => null),
    prisma.marketListing
      .groupBy({
        by: ["sellerId"],
        where: {
          NOT: {
            status: {
              equals: "sold",
              mode: "insensitive",
            },
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          likes: true,
        },
        _min: {
          createdAt: true,
        },
      })
      .catch(() => []),
    prisma.dealRequest
      .groupBy({
        by: ["sellerId"],
        where: {
          status: {
            equals: "completed",
            mode: "insensitive",
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          offeredPrice: true,
        },
        _min: {
          createdAt: true,
        },
      })
      .catch(() => []),
    prisma.sellerReview
      .aggregate({
        where: {
          sellerId: id,
        },
        _avg: {
          rating: true,
        },
        _count: {
          rating: true,
        },
      })
      .catch(
        () =>
          ({
            _avg: { rating: null },
            _count: { rating: 0 },
          }) as ReviewAggregate
      ),
  ]);

  const sellerSnapshot =
    sellerListings[0] || latestSellerDeal || completedSales[0] || null;

  let seller: SellerProfileFallback | null = null;

  if (sellerFromDb) {
    seller = {
      id: sellerFromDb.id,
      name:
        sellerFromDb.name ||
        localProfile?.displayName ||
        sellerFromDb.displayName ||
        "NEXORA User",
      displayName:
        localProfile?.displayName ||
        sellerFromDb.displayName ||
        sellerFromDb.name ||
        "NEXORA User",
      image: localProfile?.image || sellerFromDb.image || "/avatar.png",
      coverImage: localProfile?.coverImage || sellerFromDb.coverImage || null,
      coverPosition:
        localProfile?.coverPosition ?? sellerFromDb.coverPosition ?? 50,
      bio: localProfile?.bio || sellerFromDb.bio || null,
      facebookUrl: localProfile?.facebookUrl || sellerFromDb.facebookUrl || null,
      lineUrl: localProfile?.lineUrl || sellerFromDb.lineUrl || null,
      createdAt: sellerFromDb.createdAt,
    };
  }

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
    imageUrl: item.imageUrl,
    price: Number(item.price || 0),
  }));

  const soldListingIds = [
    ...new Set(
      completedSales
        .slice(0, 24)
        .map((item) => String(item.cardId || "").trim())
        .filter(Boolean)
    ),
  ];

  const soldListingRows =
    soldListingIds.length > 0
      ? await prisma.marketListing
          .findMany({
            where: {
              id: {
                in: soldListingIds,
              },
            },
            select: {
              id: true,
              cardNo: true,
              cardName: true,
              imageUrl: true,
              price: true,
            },
          })
          .catch(() => [])
      : [];

  const soldListingById = new Map(soldListingRows.map((item) => [item.id, item]));

  const soldHistory: SoldHistoryItem[] = completedSales.slice(0, 24).map(
    (item) => ({
      id: item.id,
      createdAt: item.createdAt,
      price: Number(item.offeredPrice || 0),
      listing: {
        cardNo: soldListingById.get(item.cardId)?.cardNo || null,
        cardName: soldListingById.get(item.cardId)?.cardName || null,
        imageUrl: soldListingById.get(item.cardId)?.imageUrl || null,
        price: Number(item.offeredPrice || 0),
      },
    })
  );

  const listingStatMap = new Map<
    string,
    { activeListings: number; totalLikes: number; startedAt: Date | null }
  >(
    listingStatsRows.map((row) => [
      row.sellerId,
      {
        activeListings: row._count._all,
        totalLikes: Number(row._sum.likes || 0),
        startedAt: row._min.createdAt || null,
      },
    ])
  );

  const soldStatMap = new Map<
    string,
    { soldCount: number; totalVolume: number; startedAt: Date | null }
  >(
    soldStatsRows.map((row) => [
      row.sellerId,
      {
        soldCount: row._count._all,
        totalVolume: Number(row._sum.offeredPrice || 0),
        startedAt: row._min.createdAt || null,
      },
    ])
  );

  const sellerIds = Array.from(
    new Set([
      ...listingStatsRows.map((row) => row.sellerId),
      ...soldStatsRows.map((row) => row.sellerId),
      seller.id,
    ])
  );

  const now = new Date().getTime();

  const ranking = sellerIds
    .map((userId) => {
      const listingStats = listingStatMap.get(userId);
      const soldStats = soldStatMap.get(userId);
      const startedAt =
        listingStats?.startedAt ||
        soldStats?.startedAt ||
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
    activeListings: sellerListingMetrics?.activeListings ?? listings.length,
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
  const sellerRank = getSellerRankPresentation(sellerScore);

  const sellerRankIndex = ranking.findIndex((item) => item.userId === seller.id);
  const topPercent = buildTopPercent(
    sellerRankIndex >= 0 ? sellerRankIndex + 1 : ranking.length || 1,
    Math.max(ranking.length, 1)
  );

  const isGrowingSeller = completedDeals >= 10;
  const isVerifiedSeller = !isGrowingSeller && trustScore >= 78;
  const sellerStatusLabel = isGrowingSeller
    ? "Growing Seller"
    : isVerifiedSeller
      ? "Verified Seller"
      : "New Seller";
  const sellerStatusTone = isGrowingSeller
    ? "border-violet-300/24 bg-black/70 text-violet-200"
    : isVerifiedSeller
      ? "border-emerald-300/20 bg-black/70 text-emerald-300"
      : "border-white/16 bg-black/70 text-white/78";
  const rankExplanation =
    "แรงค์คำนวณจากดีลสำเร็จ ยอดขาย รีวิว รายการขาย และความต่อเนื่องจริงในตลาด";
  const topPercentMeaning =
    "อันดับโดยประมาณเมื่อเทียบกับผู้ขายทั้งหมดในระบบ ยิ่งเปอร์เซ็นต์น้อยยิ่งอยู่กลุ่มบน";
  const trustMeaning =
    "คำนวณจากรีวิว ดีลที่ปิดสำเร็จ ยอดขาย อายุบัญชี และรายการขายที่ยัง active";
  const reputationLabel = buildThaiTopPercentLabel(topPercent);

  return (
    <div className="min-h-screen overflow-hidden bg-[#111119] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(151,139,255,0.20),transparent_34%),radial-gradient(circle_at_12%_32%,rgba(251,113,133,0.11),transparent_24%),radial-gradient(circle_at_88%_70%,rgba(253,224,71,0.10),transparent_20%),linear-gradient(180deg,#171722_0%,#0d0d12_48%,#08080b_100%)]" />
        <div className="absolute inset-0 opacity-[0.23] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute -left-28 top-24 h-[520px] w-[520px] rounded-full border border-white/8" />
        <div className="absolute -left-20 top-32 h-[430px] w-[430px] rounded-full border border-white/6" />
        <div className="absolute -right-24 bottom-6 h-[520px] w-[520px] rounded-full border border-white/7" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-4 p-3 sm:space-y-5 sm:p-6">
        <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.02)_100%)] shadow-[0_24px_90px_rgba(0,0,0,0.58)] backdrop-blur-2xl sm:rounded-[36px]">
          <div className="relative h-[250px] overflow-hidden sm:h-[360px] xl:h-[430px]">
            <Image
              src={seller.coverImage || "/seller-cover.jpg"}
              alt="Seller Cover"
              fill
              sizes="100vw"
              unoptimized
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="object-cover"
              style={{
                objectPosition: `center ${seller.coverPosition ?? 50}%`,
              }}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_28%),linear-gradient(180deg,rgba(8,8,12,0.04)_0%,rgba(8,8,12,0.26)_42%,rgba(10,10,18,0.92)_100%)]" />

            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/82 shadow-[0_10px_24px_rgba(0,0,0,0.22)] sm:left-6 sm:top-6">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              โปรไฟล์พรีเมี่ยม
            </div>

            <div className={`absolute left-4 top-16 flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black tracking-[0.02em] backdrop-blur-xl sm:left-6 sm:top-20 ${sellerStatusTone}`}>
              <ShieldCheck className="h-4 w-4" />
              {sellerStatusLabel}
            </div>

            <div className="absolute right-4 top-4 max-w-[180px] rounded-[18px] border border-violet-300/24 bg-black/38 px-4 py-2 text-right text-[11px] font-black text-violet-200 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:right-6 sm:top-6 lg:max-w-[240px]">
              <div>TOP {topPercent}% ของตลาด</div>
              <div className="mt-1 hidden text-[10px] font-semibold text-white/54 lg:block">
                เทียบกับผู้ขายทั้งหมด
              </div>
            </div>
          </div>

          <div className="relative px-4 pb-5 sm:px-8 sm:pb-8 xl:px-10">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-20 xl:-mt-24">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="relative">
                    <div className="absolute inset-[-12px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.14)_0%,transparent_72%)]" />
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-[4px] border-white/14 shadow-[0_22px_54px_rgba(0,0,0,0.44)] sm:h-32 sm:w-32 sm:border-[5px]">
                      <Image
                        src={seller.image || "/avatar.png"}
                        alt={seller.name || "seller"}
                        fill
                        sizes="(max-width: 640px) 96px, 128px"
                        unoptimized
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="object-cover"
                      />
                    </div>
                    <ProfilePresenceDot
                      userId={seller.id}
                      className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-[#090b12] sm:bottom-2 sm:right-2"
                    />
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

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68 sm:mt-3 sm:text-base lg:text-white/72">
                      {seller.bio ||
                        "โปรไฟล์ผู้ขาย NEXORA ที่รวมผลงานการขาย ดีลสำเร็จ และความน่าเชื่อถือจากตลาดจริง"}
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

                <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 backdrop-blur-xl sm:min-w-[220px] sm:max-w-[280px] sm:px-5 ${sellerRank.aura}`}>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">
                    SELLER RANK
                  </div>
                  <div className={`mt-1 text-xl font-black sm:text-2xl ${sellerRank.tone}`}>
                    {sellerRank.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/58">
                    {rankExplanation}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                {[
                  {
                    label: "ดีลสำเร็จ",
                    value: completedDeals,
                    color: "text-emerald-300",
                    hint: "จำนวนดีลที่ปิดจบแล้ว",
                  },
                  {
                    label: "กำลังขาย",
                    value: listings.length,
                    color: "text-violet-300",
                    hint: "การ์ดที่ยังลงขายอยู่",
                  },
                  {
                    label: "ยอดขายรวม",
                    value: formatCurrency(totalVolume),
                    color: "text-violet-300",
                    hint: "รวมมูลค่าดีลสำเร็จ",
                  },
                  {
                    label: "ความน่าเชื่อถือ",
                    value: `${trustScore}%`,
                    color: "text-cyan-300",
                    hint: "รีวิว ดีล และประวัติตลาด",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.15),transparent_40%),linear-gradient(180deg,rgba(0,0,0,0.9)_0%,rgba(5,5,10,1)_100%)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-4"
                  >
                    <div className="text-[9px] uppercase tracking-[0.16em] text-white/70 sm:text-[10px]">
                      {stat.label}
                    </div>
                    <div
                      className={`mt-1 text-2xl font-black leading-none sm:text-[28px] ${stat.color}`}
                    >
                      {stat.value}
                    </div>
                    <div className="mt-2 text-[10px] leading-4 text-white/50 sm:text-[11px]">
                      {stat.hint}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/95 p-3 text-xs leading-5 text-white/58 backdrop-blur-xl sm:grid-cols-2 sm:p-4 sm:text-sm">
                <div>
                  <span className="font-black text-violet-200">TOP :</span>{" "}
                  {topPercentMeaning}
                </div>
                <div>
                  <span className="font-black text-cyan-200">
                    ความน่าเชื่อถือ :
                  </span>{" "}
                  {trustMeaning}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-black p-4 shadow-[0_22px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:rounded-[34px] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black sm:text-4xl">
                การ์ดที่กำลังขาย
              </h2>
              <p className="mt-1 text-xs text-white/45 sm:text-sm">
                การ์ดที่เจ้าของโปรไฟล์กำลังเปิดรับดีลในตลาด
              </p>
            </div>

            <div className="w-fit rounded-full bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-300 sm:text-sm">
              {listings.length} รายการ
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 xl:grid-cols-3">
            {listings.length > 0 ? (
              listings.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[24px] border border-white/10 bg-black/95 transition duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_58px_rgba(139,92,246,0.14)]"
                >
                  <Link href={`/market/card/${item.id}`}>
                    <div className="relative overflow-hidden">
                      <SafeCardImage
                        cardNo={item.cardNo}
                        imageUrl={item.imageUrl}
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
                          พร้อมรับดีลในตลาด
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-xl font-black text-violet-300">
                          <Gem className="h-4 w-4" />
                          {formatCurrency(Number(item.price))}
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div
                    className={`grid gap-2 p-3 ${
                      isOwner ? "grid-cols-3" : "grid-cols-1"
                    }`}
                  >
                    {isOwner && (
                      <>
                        <Link
                          href={`/market/edit/${item.id}`}
                          className="rounded-xl bg-violet-500/10 px-3 py-2 text-center text-xs font-black text-violet-300 transition hover:bg-violet-500/20"
                        >
                          แก้ไข
                        </Link>

                        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-0.5 transition hover:bg-red-500/20">
                          <DeleteListingButton id={item.id} size="compact" />
                        </div>
                      </>
                    )}

                    <Link
                      href={`/market/card/${item.id}`}
                      className="rounded-xl border border-white/10 bg-black px-3 py-2 text-center text-xs font-black text-white/80 transition hover:bg-white/[0.06]"
                    >
                      ดูการ์ด
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-white/10 bg-black/95 p-8 text-sm text-zinc-400 sm:rounded-2xl">
                ยังไม่มีการ์ดที่กำลังลงขาย
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-black p-4 shadow-[0_22px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl sm:rounded-[34px] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-violet-200 sm:text-4xl">
                การ์ดที่ขายสำเร็จ
              </h2>
              <p className="mt-1 text-xs text-white/45 sm:text-sm">
                ประวัติการปิดดีลสำเร็จในตลาด
              </p>
            </div>

            <div className="w-fit rounded-full bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-300 sm:text-sm">
              {soldHistory.length} ดีลสำเร็จ
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2 xl:grid-cols-4">
            {soldHistory.length > 0 ? (
              soldHistory.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[24px] border border-white/10 bg-black/95 transition duration-500 hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_0_58px_rgba(139,92,246,0.14)]"
                >
                  <div className="relative overflow-hidden">
                    <SafeCardImage
                      cardNo={item.listing?.cardNo || "001"}
                      imageUrl={item.listing?.imageUrl}
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

                      <div className="mt-3 flex items-center gap-2 text-lg font-black text-violet-300">
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
              <div className="rounded-[20px] border border-white/10 bg-black/95 p-8 text-sm text-zinc-400 sm:rounded-2xl">
                ยังไม่มีดีลที่ปิดสำเร็จ
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-black p-4 shadow-[0_20px_70px_rgba(0,0,0,0.7)] sm:rounded-[32px] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 sm:text-xs">
                สรุปอันดับผู้ขาย
              </div>
              <div className="mt-2 text-3xl font-black sm:text-5xl">
                {reputationLabel}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-emerald-300 sm:text-base">
              <TrendingUp className="h-5 w-5" />
              {rankExplanation}
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
