import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String((session?.user as any)?.id || "");

    const { dealId, action } = await req.json();

    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "ไม่พบดีล" },
        { status: 404 }
      );
    }

    if (deal.sellerId !== currentUserId) {
      return NextResponse.json(
        { error: "เฉพาะเจ้าของการ์ดเท่านั้น" },
        { status: 403 }
      );
    }

    if (action === "accept") {
      await prisma.dealRequest.update({
        where: { id: dealId },
        data: { status: "accepted" },
      });
    }

    if (action === "reject") {
      await prisma.dealRequest.delete({
        where: { id: dealId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DEAL ACTION ERROR:", error);
    return NextResponse.json(
      { error: "ทำรายการไม่สำเร็จ" },
      { status: 500 }
    );
  }
}