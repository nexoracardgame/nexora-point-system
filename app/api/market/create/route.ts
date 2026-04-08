import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sellerId = (session?.user as any)?.id;

    if (!sellerId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const {
      cardNo,
      serialNo,
      price,
      cardName,
      imageUrl,
      rarity,
    } = await req.json();

    const listing = await prisma.marketListing.create({
      data: {
        cardNo,
        serialNo,
        price: Number(price),
        sellerId,
        cardName,
        imageUrl,
        rarity,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      listing,
    });
  } catch (error: any) {
    console.error("MARKET CREATE ERROR =", error);

    return NextResponse.json(
      {
        error: error?.message || "ลงขายไม่สำเร็จ",
      },
      { status: 500 }
    );
  }
}