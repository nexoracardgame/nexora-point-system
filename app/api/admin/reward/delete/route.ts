import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { revalidateRewardSurfaces } from "@/lib/reward-cache";

export async function POST(req: Request) {
  try {
    const adminError = await requireAdminApi();
    if (adminError) return adminError;

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ reward id" },
        { status: 400 }
      );
    }

    const affectedCoupons = await prisma.coupon
      .findMany({
        where: { rewardId: id },
        select: { code: true },
      })
      .catch(() => []);

    await prisma.reward.delete({
      where: { id },
    });

    revalidateRewardSurfaces(affectedCoupons.map((coupon) => coupon.code));

    return NextResponse.json({
      success: true,
      affectedCoupons: affectedCoupons.length,
    });
  } catch (error) {
    console.error("DELETE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "ลบรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
