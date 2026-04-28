import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomAccess } from "@/lib/dm-access";
import { clearDmRoomForUser } from "@/lib/dm-room-clear-state";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function buildCanonicalDirectRoomId(userA: string, userB: string) {
  return [String(userA || "").trim(), String(userB || "").trim()]
    .filter(Boolean)
    .sort()
    .join("__");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = String(
    (((session?.user as { lineId?: string } | undefined) || {}).lineId || "")
  ).trim();

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const roomId = String(body?.roomId || "").trim();

  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }

  const access = await getDmRoomAccess({
    roomId,
    userId,
    lineId,
  });

  if (!access.ok || access.kind !== "direct") {
    const status =
      !access.ok && access.reason === "not-found"
        ? 404
        : !access.ok && access.reason === "closed"
          ? 409
          : 403;

    return NextResponse.json({ error: access.ok ? "forbidden" : access.reason }, { status });
  }

  const clearedAt = new Date().toISOString();
  const roomIdsToClear = Array.from(
    new Set([
      access.roomId,
      buildCanonicalDirectRoomId(userId, access.otherUserId),
    ].filter(Boolean))
  );

  const results = await Promise.all(
    roomIdsToClear.map((targetRoomId) =>
      clearDmRoomForUser(userId, targetRoomId, clearedAt)
    )
  );

  if (results.some((value) => !value)) {
    return NextResponse.json({ error: "clear failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      roomId: access.roomId,
      clearedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
