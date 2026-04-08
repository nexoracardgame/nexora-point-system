import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ไม่พบ reward id" },
        { status: 400 }
      );
    }

    await prisma.reward.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE REWARD ERROR:", error);

    return NextResponse.json(
      { error: "ลบรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}