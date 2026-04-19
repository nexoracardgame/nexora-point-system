import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String((session?.user as { id?: string } | undefined)?.id || "");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const safePosition =
      typeof coverPosition === "number"
        ? Math.max(0, Math.min(100, coverPosition))
        : 50;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        coverImage: coverUrl || null,
        coverPosition: safePosition,
        displayName: displayName || null,
        bio: bio || null,
        lineUrl: lineLink || null,
        facebookUrl: facebookLink || null,
        image: profileImage || null,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        image: true,
        coverImage: true,
        coverPosition: true,
        bio: true,
        lineUrl: true,
        facebookUrl: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    );
  }
}
