import { safeRewardImageUrl } from "@/lib/reward-image";

type CouponValueMeta = {
  currency: "NEX" | "COIN" | null;
  amount: number | null;
};

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function buildCouponCode(currency: "NEX" | "COIN", amount: number) {
  const safeAmount = Math.max(0, Math.round(Number(amount || 0)));
  return `NXR-${currency}-${safeAmount}-${Date.now()}-${randomSuffix()}`;
}

export function parseCouponValueMeta(code?: string | null): CouponValueMeta {
  const raw = String(code || "").trim().toUpperCase();
  const parts = raw.split("-");

  if (parts.length < 5 || parts[0] !== "NXR") {
    return { currency: null, amount: null };
  }

  const currency = parts[1] === "NEX" || parts[1] === "COIN" ? parts[1] : null;
  const amount = Number(parts[2]);

  return {
    currency,
    amount: Number.isFinite(amount) && amount >= 0 ? amount : null,
  };
}

export function formatCouponValue(
  code: string,
  reward: { nexCost?: number | null; coinCost?: number | null }
) {
  const meta = parseCouponValueMeta(code);

  if (meta.currency && meta.amount != null) {
    return {
      currency: meta.currency,
      amount: meta.amount,
      label: `${meta.amount.toLocaleString("th-TH")} ${meta.currency}`,
    };
  }

  if (reward.nexCost != null) {
    return {
      currency: "NEX" as const,
      amount: Number(reward.nexCost),
      label: `${Number(reward.nexCost).toLocaleString("th-TH")} NEX`,
    };
  }

  if (reward.coinCost != null) {
    return {
      currency: "COIN" as const,
      amount: Number(reward.coinCost),
      label: `${Number(reward.coinCost).toLocaleString("th-TH")} COIN`,
    };
  }

  return {
    currency: null,
    amount: null,
    label: "ไม่ระบุมูลค่า",
  };
}

export function safeRewardImage(image?: string | null) {
  return safeRewardImageUrl(image);
}

export function serializeCouponRecord(coupon: {
  id: string;
  code: string;
  used: boolean;
  createdAt: Date;
  usedAt: Date | null;
  reward: {
    id: string;
    name: string;
    imageUrl: string | null;
    nexCost: number | null;
    coinCost: number | null;
  };
  user: {
    id: string;
    lineId: string;
    name: string | null;
    displayName?: string | null;
    image?: string | null;
  };
}) {
  const value = formatCouponValue(coupon.code, coupon.reward);

  return {
    id: coupon.id,
    code: coupon.code,
    used: coupon.used,
    createdAt: coupon.createdAt.toISOString(),
    usedAt: coupon.usedAt ? coupon.usedAt.toISOString() : null,
    expiresAt: null,
    rewardId: coupon.reward.id,
    rewardName: coupon.reward.name,
    rewardImageUrl: safeRewardImage(coupon.reward.imageUrl),
    valueCurrency: value.currency,
    valueAmount: value.amount,
    valueLabel: value.label,
    userId: coupon.user.id,
    lineId: coupon.user.lineId,
    userName:
      String(coupon.user.displayName || coupon.user.name || "").trim() ||
      "NEXORA User",
    userImage: safeRewardImage(coupon.user.image),
    detailUrl: `/coupon/${encodeURIComponent(coupon.code)}`,
    statusLabel: coupon.used ? "ใช้งานแล้ว" : "พร้อมใช้งาน",
    expiryLabel: "ไม่มีวันหมดอายุ",
  };
}
