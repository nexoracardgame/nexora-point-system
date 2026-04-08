import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawLineId = body.lineId;
    const rawType = body.type;
    const rawAmount = body.amount;

    const lineId = String(rawLineId || "").trim();
    const type = String(rawType || "").toLowerCase().trim();
    const qty = Number(rawAmount);

    if (!lineId || !type || !qty) {
      return NextResponse.json(
        { success: false, message: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, message: "จำนวนไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!["bronze", "silver", "gold"].includes(type)) {
      return NextResponse.json(
        { success: false, message: "ประเภทการ์ดไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const foundUser = await prisma.user.findUnique({
      where: { lineId },
    });

    if (!foundUser) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผู้ใช้" },
        { status: 404 }
      );
    }

    let point = 0;
    if (type === "bronze") point = 0.5 * qty;
    if (type === "silver") point = 1 * qty;
    if (type === "gold") point = 2 * qty;

    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.update({
        where: { lineId },
        data: {
          nexPoint: {
            increment: point,
          },
        },
      });

      await tx.pointLog.create({
        data: {
          lineId,
          type,
          amount: qty,
          point,
        },
      });

      return user;
    });

    return NextResponse.json({
      success: true,
      message: "เพิ่มแต้มสำเร็จ",
      newPoint: result.nexPoint,
    });
  } catch (error) {
    console.error("ADD POINT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      },
      { status: 500 }
    );
  }
}