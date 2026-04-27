import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { upsertLocalProfile } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import { syncUserIdentityEverywhere } from "@/lib/user-identity-sync";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();
    const lineId = String(
      (session?.user as { lineId?: string } | undefined)?.lineId || ""
    ).trim();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      coverUrl,
      coverPosition,
      displayName,
      username,
      bio,
      lineLink,
      facebookLink,
      profileImage,
    } = body;

    const safePosition =
      typeof coverPosition === "number"
        ? Math.max(0, Math.min(100, coverPosition))
        : 50;

    const fallbackUser = {
      userId,
      displayName: String(displayName || "").trim() || null,
      username: String(username || "").trim().replace(/^@+/, "") || null,
      image: String(profileImage || "").trim() || null,
      coverImage: String(coverUrl || "").trim() || null,
      coverPosition: safePosition,
      bio: String(bio || "").trim() || null,
      lineUrl: String(lineLink || "").trim() || null,
      facebookUrl: String(facebookLink || "").trim() || null,
    };

    if (lineId) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT'
      ).catch(() => undefined);
      await prisma.user
        .upsert({
          where: {
            lineId,
          },
          update: {
            name: fallbackUser.displayName,
            displayName: fallbackUser.displayName,
            image: fallbackUser.image,
            coverImage: fallbackUser.coverImage,
            coverPosition: fallbackUser.coverPosition,
            bio: fallbackUser.bio,
            lineUrl: fallbackUser.lineUrl,
            facebookUrl: fallbackUser.facebookUrl,
          },
          create: {
            lineId,
            name: fallbackUser.displayName,
            displayName: fallbackUser.displayName,
            image: fallbackUser.image,
            coverImage: fallbackUser.coverImage,
            coverPosition: fallbackUser.coverPosition,
            bio: fallbackUser.bio,
            lineUrl: fallbackUser.lineUrl,
            facebookUrl: fallbackUser.facebookUrl,
            role: "USER",
          },
        })
        .catch(() => undefined);
      await prisma.$executeRawUnsafe(
        'UPDATE "User" SET "username" = $2 WHERE "lineId" = $1',
        lineId,
        fallbackUser.username
      ).catch(() => undefined);
    }

    const updatedUser = await upsertLocalProfile(userId, fallbackUser).catch(
      (error) => {
        console.error("UPSERT PROFILE ERROR:", error);
        return {
          ...fallbackUser,
          updatedAt: new Date().toISOString(),
        };
      }
    );

    const syncedName =
      updatedUser.displayName || session?.user?.name || "NEXORA User";
    const syncedImage =
      updatedUser.image || session?.user?.image || "/avatar.png";

    await syncUserIdentityEverywhere({
      userId,
      lineId,
      name: syncedName,
      image: syncedImage,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: syncedName,
        displayName: updatedUser.displayName,
        image: syncedImage,
        coverImage: updatedUser.coverImage,
        coverPosition: updatedUser.coverPosition,
        bio: updatedUser.bio,
        lineUrl: updatedUser.lineUrl,
        facebookUrl: updatedUser.facebookUrl,
        updatedAt: updatedUser.updatedAt,
        username: updatedUser.username,
      },
    });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    );
  }
}
