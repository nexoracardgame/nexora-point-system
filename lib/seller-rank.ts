type SellerMetrics = {
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
  trustScore = 0
) {
  if (rank <= 0 || total <= 0) return 100;

  const rankPercent = clamp(Math.ceil((rank / total) * 100), 1, 100);
  const qualityGate =
    score >= 880 && trustScore >= 94
      ? 1
      : score >= 780 && trustScore >= 90
        ? 2
        : score >= 680 && trustScore >= 86
          ? 5
          : score >= 560 && trustScore >= 80
            ? 10
            : score >= 430 && trustScore >= 73
              ? 20
              : score >= 310 && trustScore >= 65
                ? 35
                : score >= 210 && trustScore >= 56
                  ? 55
                  : score >= 120 && trustScore >= 45
                    ? 75
                    : 100;

  return Math.max(rankPercent, qualityGate);
}
