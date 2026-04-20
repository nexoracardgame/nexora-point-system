import { NextRequest, NextResponse } from "next/server";
import { getAllLocalDeals } from "@/lib/local-deal-store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;

  try {
    const history = (await getAllLocalDeals())
      .filter(
        (item) =>
          item.status === "completed" &&
          (item.sellerId === userId || item.buyerId === userId)
      )
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

    return NextResponse.json(history);
  } catch {
    return NextResponse.json(
      { error: "โหลดข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
