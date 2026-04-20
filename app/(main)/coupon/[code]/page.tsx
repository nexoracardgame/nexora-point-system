import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CouponQRClient from "./CouponQRClient";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

type CouponDetail = {
  code: string;
  used: boolean;
  createdAt: Date;
  usedAt: Date | null;
  reward: {
    name: string;
    nexCost: number | null;
    coinCost: number | null;
  };
  user: {
    displayName: string | null;
    name: string | null;
    lineId: string;
  };
} | null;

export default async function CouponPage({ params }: PageProps) {
  const { code } = await params;
  let coupon: CouponDetail = null;

  try {
    coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        reward: true,
        user: true,
      },
    });
  } catch {
    coupon = null;
  }

  if (!coupon) {
    notFound();
  }

  return (
    <CouponQRClient
      coupon={{
        code: coupon.code,
        used: coupon.used,
        createdAt: coupon.createdAt.toISOString(),
        usedAt: coupon.usedAt ? coupon.usedAt.toISOString() : null,
        rewardName: coupon.reward.name,
        rewardType:
          coupon.reward.nexCost != null
            ? "แลกด้วย NEX"
            : coupon.reward.coinCost != null
              ? "แลกด้วย COIN"
              : "คูปองรางวัล",
        userName: coupon.user.displayName || coupon.user.name || coupon.user.lineId,
      }}
    />
  );
}
