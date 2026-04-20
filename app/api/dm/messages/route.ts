import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmRoomAccess } from "@/lib/dm-access";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function getSessionLineId(session: Awaited<ReturnType<typeof getServerSession>>) {
  return String(
    (((session || {}) as { user?: { lineId?: string } }).user?.lineId || "")
  ).trim();
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = getSessionLineId(session);
  const roomId = req.nextUrl.searchParams.get("roomId");

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!roomId) {
    return NextResponse.json({ error: "missing roomId" }, { status: 400 });
  }

  const access = await getDmRoomAccess({
    roomId,
    userId,
    lineId,
  });

  if (!access.ok) {
    const status =
      access.reason === "not-found"
        ? 404
        : access.reason === "closed"
          ? 409
          : 403;

    return NextResponse.json({ error: access.reason }, { status });
  }

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "system unavailable" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("dmMessage")
    .select("*")
    .eq("roomId", access.roomId)
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("LOAD DM API MESSAGE ERROR:", error);
    return NextResponse.json({ error: "load failed" }, { status: 500 });
  }

  return NextResponse.json(data || [], {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = getSessionLineId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const roomId = String(body?.roomId || "").trim();
  const action = String(body?.action || "").trim();

  if (!roomId || action !== "markSeen") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const access = await getDmRoomAccess({
    roomId,
    userId,
    lineId,
  });

  if (!access.ok) {
    const status =
      access.reason === "not-found"
        ? 404
        : access.reason === "closed"
          ? 409
          : 403;

    return NextResponse.json({ error: access.reason }, { status });
  }

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "system unavailable" }, { status: 500 });
  }

  const seenAt = new Date().toISOString();

  const { error } = await supabase
    .from("dmMessage")
    .update({ seenAt })
    .eq("roomId", access.roomId)
    .neq("senderId", userId)
    .neq("senderId", lineId || "__never__")
    .is("seenAt", null);

  if (error) {
    console.error("MARK DM SEEN ERROR:", error);
    return NextResponse.json({ error: "mark seen failed" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    roomId: access.roomId,
    seenAt,
  });
}
