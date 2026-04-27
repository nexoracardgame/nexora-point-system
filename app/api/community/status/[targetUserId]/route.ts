import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFriendRelation } from "@/lib/friend-store";

export async function GET(
  _req: Request,
  context: { params: Promise<{ targetUserId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();

  if (!userId) {
    return NextResponse.json({ relation: { status: "none", requestId: null } }, { status: 401 });
  }

  const { targetUserId } = await context.params;
  const relation = await getFriendRelation(userId, String(targetUserId || "").trim());
  return NextResponse.json({ relation });
}
