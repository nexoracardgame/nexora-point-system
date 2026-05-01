export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMarketListingsBySeller } from "@/lib/market-listings";
import { getLocalMarketListingsBySeller } from "@/lib/local-market-store";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  id?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = ((session?.user || {}) as SessionUser).id;

  if (!userId) {
    return NextResponse.json({ items: [] });
  }

  if (String(process.env.DATABASE_URL || "").trim()) {
    try {
      const items = await prisma.marketListing.findMany({
        where: {
          sellerId: userId,
          NOT: {
            status: {
              equals: "sold",
              mode: "insensitive",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          imageUrl: true,
          cardNo: true,
          cardName: true,
          serialNo: true,
          price: true,
        },
      });

      return NextResponse.json({
        items: items.map((item) => ({
          id: item.id,
          imageUrl: item.imageUrl,
          cardNo: String(item.cardNo || ""),
          cardName: item.cardName,
          serialNo: item.serialNo,
          price: Number(item.price || 0),
        })),
      });
    } catch {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ items: [] });
      }
    }
  }

  const items =
    process.env.NODE_ENV === "production"
      ? await getMarketListingsBySeller(userId)
      : await getLocalMarketListingsBySeller(userId);

  return NextResponse.json({ items });
}
