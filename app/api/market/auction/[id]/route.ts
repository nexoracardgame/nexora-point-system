import { NextResponse } from "next/server";
import { getAuctionRoomWithBids } from "@/lib/auction-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getAuctionRoomWithBids(String(id || "").trim());

    if (!data) {
      return NextResponse.json(
        { success: false, error: "ไม่พบห้องประมูลนี้" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        ...data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("AUCTION ROOM ERROR:", error);
    return NextResponse.json(
      { success: false, error: "โหลดห้องประมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

