import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDirectChatBootstrap } from "@/lib/dm-bootstrap";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const roomId = String(req.nextUrl.searchParams.get("roomId") || "").trim();
  const before = String(req.nextUrl.searchParams.get("before") || "").trim() || null;
  const limit = Number(req.nextUrl.searchParams.get("limit") || 0) || undefined;

  const result = await getDirectChatBootstrap({
    roomId,
    before,
    limit,
    sessionUser: session?.user,
    lineId: String(session?.user?.lineId || "").trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
