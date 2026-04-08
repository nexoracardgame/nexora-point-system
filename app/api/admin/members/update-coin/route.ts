import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { lineId, amount } = await req.json();

    if (!lineId || amount === undefined) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { lineId },
      data: {
        coin: {
          increment: Number(amount),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPDATE COIN ERROR:", error);

    return NextResponse.json(
      { error: "เพิ่ม COIN ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}