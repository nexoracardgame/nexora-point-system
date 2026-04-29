export type SellerRankTier = {
  label: string;
  minScore: number;
  tone: string;
  aura: string;
  badge: string;
  summary: string;
  requirement: string;
};

export const SELLER_RANK_TIERS: SellerRankTier[] = [
  {
    label: "Genesis Elite",
    minScore: 340,
    tone: "text-yellow-100",
    aura:
      "border-yellow-200/40 bg-[radial-gradient(circle_at_top,rgba(253,224,71,0.28),transparent_46%),linear-gradient(150deg,rgba(120,53,15,0.86),rgba(5,5,7,0.96))] shadow-[0_0_70px_rgba(250,204,21,0.28)]",
    badge:
      "border-yellow-200/46 bg-[linear-gradient(135deg,rgba(253,224,71,0.30),rgba(120,53,15,0.74))] text-yellow-50 shadow-[0_0_40px_rgba(250,204,21,0.24)]",
    summary: "The top legendary tier for sellers with exceptional market power.",
    requirement:
      "Score 340+ from completed deals, high sales volume, strong reviews, active listings, likes, and account history.",
  },
  {
    label: "Sovereign Apex",
    minScore: 265,
    tone: "text-amber-100",
    aura:
      "border-amber-200/36 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.24),transparent_46%),linear-gradient(150deg,rgba(92,45,9,0.84),rgba(5,5,7,0.96))] shadow-[0_0_64px_rgba(245,158,11,0.25)]",
    badge:
      "border-amber-200/40 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(92,45,9,0.72))] text-amber-50 shadow-[0_0_34px_rgba(245,158,11,0.22)]",
    summary: "Elite seller with consistent deal flow and premium volume.",
    requirement:
      "Score 265+ with strong completed deals, total volume, trust, and active marketplace presence.",
  },
  {
    label: "Diamond Vanguard",
    minScore: 205,
    tone: "text-cyan-100",
    aura:
      "border-cyan-200/34 bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.22),transparent_46%),linear-gradient(150deg,rgba(12,74,110,0.74),rgba(5,5,7,0.96))] shadow-[0_0_62px_rgba(34,211,238,0.22)]",
    badge:
      "border-cyan-200/38 bg-[linear-gradient(135deg,rgba(103,232,249,0.24),rgba(12,74,110,0.70))] text-cyan-50 shadow-[0_0_32px_rgba(34,211,238,0.20)]",
    summary: "High-performing seller with proven marketplace strength.",
    requirement:
      "Score 205+ from repeated successful deals, meaningful volume, and positive seller signals.",
  },
  {
    label: "Platinum Broker",
    minScore: 145,
    tone: "text-violet-100",
    aura:
      "border-violet-200/30 bg-[radial-gradient(circle_at_top,rgba(196,181,253,0.20),transparent_46%),linear-gradient(150deg,rgba(59,7,100,0.72),rgba(5,5,7,0.96))] shadow-[0_0_58px_rgba(167,139,250,0.20)]",
    badge:
      "border-violet-200/34 bg-[linear-gradient(135deg,rgba(196,181,253,0.22),rgba(59,7,100,0.70))] text-violet-50 shadow-[0_0_30px_rgba(167,139,250,0.18)]",
    summary: "Reliable seller with solid activity and growing credibility.",
    requirement:
      "Score 145+ through completed deals, listings, likes, trust, and account activity.",
  },
  {
    label: "Gold Trader",
    minScore: 95,
    tone: "text-amber-100",
    aura:
      "border-amber-200/26 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_46%),linear-gradient(150deg,rgba(69,26,3,0.68),rgba(5,5,7,0.96))] shadow-[0_0_48px_rgba(245,158,11,0.18)]",
    badge:
      "border-amber-200/32 bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(69,26,3,0.68))] text-amber-50 shadow-[0_0_26px_rgba(245,158,11,0.16)]",
    summary: "Active seller with healthy early marketplace momentum.",
    requirement:
      "Score 95+ from sales activity, listing quality, likes, and growing trust.",
  },
  {
    label: "Silver Seller",
    minScore: 55,
    tone: "text-slate-100",
    aura:
      "border-slate-200/24 bg-[radial-gradient(circle_at_top,rgba(226,232,240,0.14),transparent_46%),linear-gradient(150deg,rgba(30,41,59,0.68),rgba(5,5,7,0.96))] shadow-[0_0_42px_rgba(226,232,240,0.12)]",
    badge:
      "border-slate-200/30 bg-[linear-gradient(135deg,rgba(226,232,240,0.16),rgba(30,41,59,0.70))] text-slate-50 shadow-[0_0_24px_rgba(226,232,240,0.12)]",
    summary: "Developing seller with visible marketplace activity.",
    requirement:
      "Score 55+ from listings, early completed deals, account age, and likes.",
  },
  {
    label: "Rising Seller",
    minScore: 0,
    tone: "text-emerald-100",
    aura:
      "border-emerald-200/24 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),transparent_46%),linear-gradient(150deg,rgba(6,78,59,0.58),rgba(5,5,7,0.96))] shadow-[0_0_42px_rgba(52,211,153,0.14)]",
    badge:
      "border-emerald-200/28 bg-[linear-gradient(135deg,rgba(52,211,153,0.16),rgba(6,78,59,0.68))] text-emerald-50 shadow-[0_0_22px_rgba(52,211,153,0.12)]",
    summary: "Starter rank for sellers building their first market record.",
    requirement:
      "Start here, then rank up as completed deals, volume, reviews, listings, and likes grow.",
  },
];

export function getSellerRankPresentation(score: number) {
  return (
    SELLER_RANK_TIERS.find((tier) => score >= tier.minScore) ||
    SELLER_RANK_TIERS[SELLER_RANK_TIERS.length - 1]
  );
}
