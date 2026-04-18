import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    if (!userId) {
      return NextResponse.json([]);
    }

    const history = await prisma.marketHistory.findMany({
      where: {
        action: "sold",
        sellerId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("SOLD HISTORY ERROR:", error);
    return NextResponse.json([]);
  }
}