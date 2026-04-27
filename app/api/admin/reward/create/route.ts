import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    if (!safeName) {
      return NextResponse.json({ error: "กรุณากรอกชื่อรางวัล" }, { status: 400 });
    }

    const reward = await prisma.reward.create({
      data: {
        name: safeName,
        imageUrl: sanitizeNullableUrl(imageUrl),
        nexCost: toNullableNonNegativeNumber(nexCost),
        coinCost: toNullableNonNegativeNumber(coinCost),
        stock: toNonNegativeInt(stock),
      },
    });

    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error("CREATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "สร้างของรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
