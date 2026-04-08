import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { sellerId, buyerId, rating, comment } = await req.json();

    await prisma.sellerReview.create({
      data: {
        sellerId,
        buyerId,
        rating: Number(rating),
        comment,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("REVIEW ERROR:", error);

    return NextResponse.json(
      { error: "รีวิวไม่สำเร็จ" },
      { status: 500 }
    );
  }
}