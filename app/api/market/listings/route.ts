import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const listings = await prisma.marketListing.findMany({
    where: {
      NOT: {
        status: "sold",
      },
    },
    orderBy: { createdAt: "desc" },
    take: 24,

    // ✅ สำคัญ: ดึงข้อมูลคนขายมาด้วย
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      },
    },
  });

  const fixed = listings.map((item) => ({
    ...item,

    // 🧠 fallback ข้อมูลการ์ด
    cardName:
      item.cardName ||
      `Card #${String(item.cardNo).padStart(3, "0")}`,

    imageUrl:
      item.imageUrl ||
      `/cards/${String(item.cardNo).padStart(3, "0")}.jpg`,

    rarity: item.rarity || "Legendary",

    // 👤 seller mapping (ตัวนี้ทำให้หาย Unknown)
    sellerId: item.seller?.id || item.sellerId,

    sellerName:
      item.seller?.displayName ||
      item.seller?.name ||
      "Unknown Seller",

    sellerImage:
      item.seller?.image ||
      "/default-avatar.png",
  }));

  return NextResponse.json(fixed);
}
