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
    const { id, name, imageUrl, nexCost, coinCost, stock } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ reward id" },
        { status: 400 }
      );
    }

    const reward = await prisma.reward.update({
      where: { id },
      data: {
        ...(String(name || "").trim()
          ? { name: String(name || "").trim() }
          : {}),
        imageUrl: sanitizeNullableUrl(imageUrl),
        nexCost: toNullableNonNegativeNumber(nexCost),
        coinCost: toNullableNonNegativeNumber(coinCost),
        stock: toNonNegativeInt(stock),
      },
    });

    return NextResponse.json({
      success: true,
      reward,
    });
  } catch (error) {
    console.error("UPDATE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "อัปเดตรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
