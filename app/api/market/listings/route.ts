import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const listings = await prisma.marketListing.findMany({
    where: {
      status: {
        in: ["active", "ACTIVE"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  const fixed = listings.map((item) => ({
    ...item,
    cardName:
      item.cardName || `Card #${String(item.cardNo).padStart(3, "0")}`,
    imageUrl:
      item.imageUrl ||
      `/cards/${String(item.cardNo).padStart(3, "0")}.jpg`,
    rarity: item.rarity || "Legendary",
  }));

  return NextResponse.json(fixed);
}