export type SellerMetrics = {
  soldCount: number;
  totalVolume: number;
  activeListings: number;
  totalLikes: number;
  avgRating: number;
  reviewCount: number;
  accountAgeDays: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function logScale(value: number, target: number) {
  const safeValue = Math.max(0, Number(value || 0));
  const safeTarget = Math.max(1, Number(target || 1));

  if (safeValue <= 0) {
    return 0;
  }

  return clamp(Math.log1p(safeValue) / Math.log1p(safeTarget), 0, 1);
}

function reviewConfidence(reviewCount: number) {
  return clamp(1 - Math.exp(-Math.max(0, reviewCount) / 12), 0, 1);
}

function ratingQuality(avgRating: number, reviewCount: number) {
  if (reviewCount <= 0) {
    return 0.45;
  }

  return clamp((Number(avgRating || 0) - 3) / 2, 0, 1);
}

export function buildSellerScore(metrics: SellerMetrics) {
  const trustScore = buildTrustScore(metrics);
  const soldScore = logScale(metrics.soldCount, 160) * 310;
  const volumeScore = logScale(metrics.totalVolume, 250_000) * 180;
  const trustWeightedScore = Math.pow(trustScore / 100, 1.35) * 240;
  const reviewDepthScore = logScale(metrics.reviewCount, 60) * 95;
  const listingScore = logScale(metrics.activeListings, 45) * 70;
  const likesScore = logScale(metrics.totalLikes, 600) * 45;
  const ageScore = logScale(metrics.accountAgeDays, 730) * 60;

  let score = Math.round(
    soldScore +
      volumeScore +
      trustWeightedScore +
      reviewDepthScore +
      listingScore +
      likesScore +
      ageScore
  );

  if (trustScore < 45) {
    score = Math.min(score, 260);
  } else if (trustScore < 60) {
    score = Math.min(score, 380);
  } else if (trustScore < 72) {
    score = Math.min(score, 520);
  } else if (trustScore < 84) {
    score = Math.min(score, 660);
  } else if (trustScore < 92) {
    score = Math.min(score, 810);
  }

  return score;
}

export function buildTrustScore(metrics: SellerMetrics) {
  const reviews = Math.max(0, metrics.reviewCount);
  const sold = Math.max(0, metrics.soldCount);
  const reviewDepth = reviewConfidence(reviews);
  const quality = ratingQuality(metrics.avgRating, reviews);
  const reviewComponent = reviewDepth * (18 + quality * 24);
  const soldComponent = logScale(sold, 80) * 28;
  const volumeComponent = logScale(metrics.totalVolume, 180_000) * 10;
  const activityComponent =
    Math.sqrt(clamp((sold + metrics.activeListings) / 36, 0, 1)) * 8;
  const ageComponent = logScale(metrics.accountAgeDays, 365) * 7;

  let score =
    10 +
    reviewComponent +
    soldComponent +
    volumeComponent +
    activityComponent +
    ageComponent;

  if (reviews === 0) {
    score = Math.min(score, 64);
  }

  if (sold < 5) {
    score = Math.min(score, 72);
  }

  return clamp(Math.round(score), 10, 99);
}

export function buildRankLabel(score: number) {
  if (score >= 820) return "Genesis Elite";
  if (score >= 670) return "Sovereign Apex";
  if (score >= 530) return "Diamond Vanguard";
  if (score >= 390) return "Platinum Broker";
  if (score >= 270) return "Gold Trader";
  if (score >= 150) return "Silver Seller";
  return "Rising Seller";
}

export function buildTopPercent(
  rank: number,
  total: number,
  score = 0,
  trustScore = 0,
  metrics?: Partial<SellerMetrics>
) {
  if (rank <= 0 || total <= 0) return 100;

  const soldCount = Math.max(0, Number(metrics?.soldCount || 0));
  const totalVolume = Math.max(0, Number(metrics?.totalVolume || 0));
  const activeListings = Math.max(0, Number(metrics?.activeListings || 0));
  const totalLikes = Math.max(0, Number(metrics?.totalLikes || 0));
  const avgRating = Math.max(0, Number(metrics?.avgRating || 0));
  const reviewCount = Math.max(0, Number(metrics?.reviewCount || 0));
  const accountAgeDays = Math.max(0, Number(metrics?.accountAgeDays || 0));
  const marketBase = Math.max(total, 100);
  const rankPercent = clamp(Math.ceil((rank / marketBase) * 100), 1, 100);

  const reviewQuality = ratingQuality(avgRating, reviewCount) * reviewConfidence(reviewCount);
  const marketDepth =
    logScale(soldCount, 220) * 30 +
    logScale(totalVolume, 420_000) * 23 +
    Math.pow(Math.max(0, trustScore) / 100, 1.55) * 18 +
    reviewQuality * 12 +
    logScale(reviewCount, 90) * 6 +
    logScale(activeListings, 80) * 5 +
    logScale(totalLikes, 1200) * 3 +
    logScale(score, 950) * 3 +
    logScale(accountAgeDays, 1095) * 3;
  const continuousGate = clamp(Math.ceil(100 - marketDepth * 0.88), 1, 100);

  const hardGate =
    soldCount >= 220 &&
    totalVolume >= 420_000 &&
    trustScore >= 96 &&
    reviewCount >= 45 &&
    avgRating >= 4.85
      ? 1
      : soldCount >= 150 &&
          totalVolume >= 300_000 &&
          trustScore >= 94 &&
          reviewCount >= 32 &&
          avgRating >= 4.75
        ? 2
        : soldCount >= 95 &&
            totalVolume >= 200_000 &&
            trustScore >= 91 &&
            reviewCount >= 22 &&
            avgRating >= 4.65
          ? 5
          : soldCount >= 55 &&
              totalVolume >= 120_000 &&
              trustScore >= 86 &&
              reviewCount >= 14
            ? 10
            : soldCount >= 28 &&
                totalVolume >= 60_000 &&
                trustScore >= 80 &&
                reviewCount >= 8
              ? 20
              : soldCount >= 12 && totalVolume >= 25_000 && trustScore >= 72
                ? 35
                : soldCount >= 5 && trustScore >= 62
                  ? 55
                  : soldCount >= 1 || activeListings >= 3 || reviewCount >= 1
                    ? 82
                    : 98;

  return Math.max(rankPercent, continuousGate, hardGate);
}
