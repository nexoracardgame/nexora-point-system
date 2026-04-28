import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDealChatBootstrap } from "@/lib/deal-chat-bootstrap";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const dealId = String(req.nextUrl.searchParams.get("dealId") || "").trim();
  const before = String(req.nextUrl.searchParams.get("before") || "").trim() || null;
  const limit = Number(req.nextUrl.searchParams.get("limit") || 0) || undefined;

  const result = await getDealChatBootstrap({
    dealId,
    userId,
    before,
    limit,
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
