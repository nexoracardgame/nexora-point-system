import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { upsertLocalProfile } from "@/lib/local-profile-store";
import { syncUserIdentityEverywhere } from "@/lib/user-identity-sync";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = String(
      (session?.user as { id?: string } | undefined)?.id || ""
    ).trim();

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

    const updatedUser = await upsertLocalProfile(userId, {
      coverImage: String(coverUrl || "").trim() || null,
      coverPosition: safePosition,
      displayName: String(displayName || "").trim() || null,
      bio: String(bio || "").trim() || null,
      lineUrl: String(lineLink || "").trim() || null,
      facebookUrl: String(facebookLink || "").trim() || null,
      image: String(profileImage || "").trim() || null,
    });

    const syncedName =
      updatedUser.displayName || session?.user?.name || "NEXORA User";
    const syncedImage =
      updatedUser.image || session?.user?.image || "/avatar.png";

    await syncUserIdentityEverywhere({
      userId,
      name: syncedName,
      image: syncedImage,
    });

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
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    );
  }
}
