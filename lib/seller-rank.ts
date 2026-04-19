type SellerMetrics = {
  soldCount: number;
  totalVolume: number;
  activeListings: number;
  totalLikes: number;
  avgRating: number;
  reviewCount: number;
  accountAgeDays: number;
};

export function buildSellerScore(metrics: SellerMetrics) {
  const volumeScore = Math.min(metrics.totalVolume / 120, 120);
  const soldScore = Math.min(metrics.soldCount * 18, 160);
  const listingScore = Math.min(metrics.activeListings * 6, 36);
  const likesScore = Math.min(metrics.totalLikes * 2.2, 70);
  const ageScore = Math.min(metrics.accountAgeDays / 18, 28);

  const reviewScore =
    metrics.reviewCount > 0
      ? Math.min((metrics.avgRating / 5) * 110 + metrics.reviewCount * 6, 145)
      : Math.min(metrics.soldCount * 4, 18);

  return (
    soldScore +
    volumeScore +
    listingScore +
    likesScore +
    ageScore +
    reviewScore
  );
}

export function buildTrustScore(metrics: SellerMetrics) {
  const ratingComponent =
    metrics.reviewCount > 0 ? (metrics.avgRating / 5) * 52 : 24;
  const soldComponent = Math.min(metrics.soldCount * 4.5, 24);
  const volumeComponent = Math.min(metrics.totalVolume / 850, 12);
  const listingComponent = Math.min(metrics.activeListings * 2.5, 6);
  const ageComponent = Math.min(metrics.accountAgeDays / 45, 6);

  return Math.max(
    32,
    Math.min(
      99,
      Math.round(
        ratingComponent +
          soldComponent +
          volumeComponent +
          listingComponent +
          ageComponent
      )
    )
  );
}

export function buildRankLabel(score: number) {
  if (score >= 340) return "Genesis Elite";
  if (score >= 265) return "Sovereign Apex";
  if (score >= 205) return "Diamond Vanguard";
  if (score >= 145) return "Platinum Broker";
  if (score >= 95) return "Gold Trader";
  if (score >= 55) return "Silver Seller";
  return "Rising Seller";
}

export function buildTopPercent(rank: number, total: number) {
  if (rank <= 0 || total <= 0) return 100;
  return Math.max(1, Math.ceil((rank / total) * 100));
}
