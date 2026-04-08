import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lineId, amount, action } = body;

    if (!lineId || typeof amount !== "number" || !action) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "จำนวนต้องมากกว่า 0" },
        { status: 400 }
      );
    }

    if (!["add", "subtract"].includes(action)) {
      return NextResponse.json(
        { error: "action ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { lineId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้งาน" },
        { status: 404 }
      );
    }

    if (action === "subtract" && user.coin < amount) {
      return NextResponse.json(
        { error: "coin ไม่พอให้หัก" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { lineId },
      data: {
        coin: action === "add" ? user.coin + amount : user.coin - amount,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "อัปเดต coin ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}