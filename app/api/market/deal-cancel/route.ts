import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String((session?.user as any)?.id || "");

    const { dealId } = await req.json();

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "ไม่พบดีล" },
        { status: 404 }
      );
    }

    if (deal.buyerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะผู้ขอดีลเท่านั้น" },
        { status: 403 }
      );
    }

    await prisma.dealRequest.delete({
      where: { id: dealId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DEAL CANCEL ERROR:", error);

    return NextResponse.json(
      { error: "ยกเลิกไม่สำเร็จ" },
      { status: 500 }
    );
  }
}