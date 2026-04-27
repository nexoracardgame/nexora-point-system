import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchCommunityUsers } from "@/lib/friend-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as
    | { id?: string; lineId?: string }
    | undefined;
  const userId = String(sessionUser?.id || "").trim();
  const lineId = String(sessionUser?.lineId || "").trim();
  if (!userId) {
    return NextResponse.json({ users: [] }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") || "";
  const users = await searchCommunityUsers(userId, q, lineId ? [lineId] : []);
  return NextResponse.json({ users });
}
