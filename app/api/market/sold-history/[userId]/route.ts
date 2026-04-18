import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params; // 🔥 ต้อง await

  try {
    const history = await prisma.marketHistory.findMany({
      where: {
        OR: [
          { sellerId: userId },
          { buyerId: userId },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error("SOLD HISTORY ERROR:", error);

    return NextResponse.json(
      { error: "โหลดข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}