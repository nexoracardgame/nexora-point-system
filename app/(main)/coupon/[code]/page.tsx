import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import CouponQRClient from "./CouponQRClient";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import { isStaffRole } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function CouponPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();
  const role = String(
    (session?.user as { role?: string } | undefined)?.role || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  const { code } = await params;
  const safeCode = decodeURIComponent(String(code || "").trim());

  const coupon = await prisma.coupon.findUnique({
    where: { code: safeCode },
    include: {
      user: {
        select: {
          id: true,
          lineId: true,
          name: true,
          displayName: true,
          image: true,
        },
      },
      reward: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          nexCost: true,
          coinCost: true,
        },
      },
    },
  });

  if (!coupon) {
    notFound();
  }

  if (coupon.userId !== userId && !isStaffRole(role)) {
    redirect("/redeem");
  }

  return <CouponQRClient coupon={serializeCouponRecord(coupon)} />;
}
