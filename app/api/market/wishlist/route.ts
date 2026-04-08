import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { cardNo, userId } = await req.json();

    if (!cardNo || !userId) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    const listing = await prisma.marketListing.findFirst({
      where: {
        cardNo,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "ไม่พบ listing" },
        { status: 404 }
      );
    }

    const existing = await prisma.wishlist.findFirst({
      where: {
        userId,
        listingId: listing.id,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "มีอยู่ใน Wishlist แล้ว",
      });
    }

    await prisma.wishlist.create({
      data: {
        userId,
        listingId: listing.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "เพิ่ม Wishlist สำเร็จ ❤️",
    });
  } catch (error) {
    console.error("WISHLIST ERROR:", error);

    return NextResponse.json(
      { error: "เพิ่ม Wishlist ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}