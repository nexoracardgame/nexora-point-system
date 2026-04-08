import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CouponQRClient from "./CouponQRClient";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function CouponPage({ params }: PageProps) {
  const { code } = await params;

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: {
      reward: true,
      user: true,
    },
  });

  if (!coupon) {
    notFound();
  }

  return (
    <CouponQRClient
      coupon={{
        code: coupon.code,
        used: coupon.used,
        createdAt: coupon.createdAt.toISOString(),
        rewardName: coupon.reward.name,
        rewardType:
          coupon.reward.nexCost != null
            ? "NEX Reward"
            : "COIN Reward",
        userName: coupon.user.name || coupon.user.lineId,
      }}
    />
  );
}