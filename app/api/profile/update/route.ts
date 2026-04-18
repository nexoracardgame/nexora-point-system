import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as any)?.id || "");

    if (!userId) {
      return NextResponse.json({ error: "ยังไม่ได้ล็อกอิน" }, { status: 401 });
    }

    const body = await req.json();

    const {
      coverUrl,
      coverPosition,
      displayName,
      bio,
      lineLink,
      facebookLink,
      profileImage,
    } = body;

    // 🔥 กันค่าหลุด
    const safePosition =
      typeof coverPosition === "number"
        ? Math.max(0, Math.min(100, coverPosition))
        : 50;

    await prisma.user.update({
      where: { id: userId },
      data: {
        coverImage: coverUrl || null,
        coverPosition: safePosition, // 🔥 ตัวสำคัญ
        displayName: displayName || null,
        bio: bio || null,
        lineUrl: lineLink || null,
        facebookUrl: facebookLink || null,
        image: profileImage || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "ระบบผิดพลาด" },
      { status: 500 }
    );
  }
}