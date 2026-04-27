import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeCouponRecord } from "@/lib/coupon-utils";
import RedeemCouponsClient from "@/components/RedeemCouponsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    open?: string;
  }>;
};

export default async function RedeemPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = String(
    (session?.user as { id?: string } | undefined)?.id || ""
  ).trim();

  if (!userId) {
    redirect("/login");
  }

  const { open } = await searchParams;

  const coupons = await prisma.coupon.findMany({
    where: { userId },
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
    orderBy: [{ used: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#16243f_0%,#0b0d13_42%,#05070d_100%)] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-5%,rgba(34,211,238,0.18),transparent_22%),radial-gradient(circle_at_0%_100%,rgba(168,85,247,0.12),transparent_25%),radial-gradient(circle_at_100%_100%,rgba(251,191,36,0.1),transparent_24%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 xl:px-6">
        <RedeemCouponsClient
          initialCoupons={coupons.map(serializeCouponRecord)}
          initialOpenCode={String(open || "").trim()}
        />
      </div>
    </div>
  );
}
