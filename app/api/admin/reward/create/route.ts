import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateRewardSurfaces } from "@/lib/reward-cache";
import { stampRewardImageUrl } from "@/lib/reward-image";
import {
  requireAdminApi,
  sanitizeNullableUrl,
  toNonNegativeInt,
  toNullableNonNegativeNumber,
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const adminError = await requireAdminApi();
    if (adminError) return adminError;

    const body = await req.json();
    const { name, imageUrl, nexCost, coinCost, stock } = body;
    const safeName = String(name || "").trim();
    const sanitizedImageUrl = sanitizeNullableUrl(imageUrl);

    if (!safeName) {
      return NextResponse.json({ error: "กรุณากรอกชื่อรางวัล" }, { status: 400 });
    }

    const reward = await prisma.reward.create({
      data: {
        name: safeName,
        imageUrl: sanitizedImageUrl
          ? stampRewardImageUrl(sanitizedImageUrl)
          : null,
        nexCost: toNullableNonNegativeNumber(nexCost),
        coinCost: toNullableNonNegativeNumber(coinCost),
        stock: toNonNegativeInt(stock),
      },
    });

    revalidateRewardSurfaces();

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error("CREATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "สร้างของรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
