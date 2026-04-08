import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const updated = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: body.displayName || null,
        displayName: body.displayName || null,
        bio: body.bio || null,
        lineUrl: body.lineLink || null,
        facebookUrl: body.facebookLink || null,
        image: body.profileImage || null,
        coverImage: body.coverUrl || null,
      },
    });

    return Response.json({
      success: true,
      user: updated,
    });
  } catch (error: any) {
    console.error("PROFILE SAVE ERROR:", error);

    return Response.json(
      {
        error: error?.message || "Save failed",
      },
      { status: 500 }
    );
  }
}