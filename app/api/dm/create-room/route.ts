import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function safeName(name?: string | null, fallback = "User") {
  const value = String(name || "").trim();
  return value || fallback;
}

function safeImage(image?: string | null) {
  const value = String(image || "").trim();
  return value || "/avatar.png";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user1 = String(session?.user?.id || "").trim();

    if (!user1) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await req.json();
    const user2 = String(body?.user2 || "").trim();

    if (!user2) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้ปลายทาง" }, { status: 400 });
    }

    if (user1 === user2) {
      return NextResponse.json(
        { error: "ไม่สามารถแชทกับตัวเองได้" },
        { status: 400 }
      );
    }

    const [currentUser, targetUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user1 },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: user2 },
        select: {
          id: true,
          name: true,
          displayName: true,
          image: true,
        },
      }),
    ]);

    if (!currentUser || !targetUser) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลผู้ใช้" },
        { status: 404 }
      );
    }

    const existingRoom = await prisma.dmRoom.findFirst({
      where: {
        OR: [{ user1, user2 }, { user1: user2, user2: user1 }],
      },
      select: { id: true },
    });

    const roomId =
      existingRoom?.id ||
      (
        await prisma.dmRoom.create({
          data: { user1, user2 },
          select: { id: true },
        })
      ).id;

    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabase.from("dm_room").upsert({
      roomid: roomId,
      usera: currentUser.id,
      userb: targetUser.id,
      useraname: safeName(currentUser.displayName || currentUser.name, "You"),
      useraimage: safeImage(currentUser.image),
      userbname: safeName(targetUser.displayName || targetUser.name),
      userbimage: safeImage(targetUser.image),
      updatedat: nowIso,
    });

    if (upsertError) {
      console.error("UPSERT DM ROOM ERROR:", upsertError);

      return NextResponse.json(
        { error: "ไม่สามารถสร้างห้องแชทได้" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      roomId,
    });
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);

    return NextResponse.json(
      { error: "ระบบเกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
