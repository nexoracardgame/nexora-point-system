import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // 🔐 เช็ค login
    const session = await getServerSession(authOptions);
    const user1 = String((session?.user as any)?.id || "");

    if (!user1) {
      return NextResponse.json(
        { error: "ยังไม่ได้ล็อกอิน" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const user2 = String(body?.user2 || "").trim();

    if (!user2) {
      return NextResponse.json(
        { error: "user2 ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (user1 === user2) {
      return NextResponse.json(
        { error: "ไม่สามารถแชทกับตัวเองได้" },
        { status: 400 }
      );
    }

    // 🔍 ตรวจว่ามี user จริงไหม
    const targetUser = await prisma.user.findUnique({
      where: { id: user2 },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้งานปลายทาง" },
        { status: 404 }
      );
    }

    // 🔥 หา room เดิม (กันซ้ำ)
    const existing = await prisma.dmRoom.findFirst({
      where: {
        OR: [
          { user1, user2 },
          { user1: user2, user2: user1 },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        roomId: existing.id,
      });
    }

    // 🔥 สร้างใหม่
    const room = await prisma.dmRoom.create({
      data: {
        user1,
        user2,
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      roomId: room.id,
    });
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);

    return NextResponse.json(
      { error: "ระบบผิดพลาด" },
      { status: 500 }
    );
  }
}