import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await prisma.marketListing.findMany({
      where: {
        status: {
          not: "sold",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 24,
    });

    const fixed = listings.map((item) => ({
      ...item,
      cardName:
        item.cardName ||
        `Card #${String(item.cardNo || item.id).padStart(3, "0")}`,
      imageUrl:
        item.imageUrl ||
        `/cards/${String(item.cardNo || item.id).padStart(3, "0")}.jpg`,
      rarity: item.rarity || "Legendary",
      sellerName: item.sellerName || "Unknown Seller",
      sellerImage: item.sellerImage || "/default-avatar.png",
    }));

    return NextResponse.json(fixed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MARKET LIST ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}