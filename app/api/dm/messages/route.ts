import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChatMessagesPage } from "@/lib/chat-room-server";
import { getDmRoomAccess } from "@/lib/dm-access";
import {
  getDmConversationClearedAtForUserAliases,
  getDmRoomClearedAtForUser,
  getLatestClearTimestamp,
} from "@/lib/dm-room-clear-state";
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
  const before = String(req.nextUrl.searchParams.get("before") || "").trim() || null;
  const after = String(req.nextUrl.searchParams.get("after") || "").trim() || null;
  const limit = Number(req.nextUrl.searchParams.get("limit") || 0) || 0;

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
  const rawOtherUserId =
    access.kind === "direct"
      ? String(
          access.room.usera === userId ||
            (lineId ? access.room.usera === lineId : false)
            ? access.room.userb
            : access.room.usera || ""
        ).trim()
      : "";
  const clearedAt =
    access.kind === "direct"
      ? getLatestClearTimestamp(
          await getDmRoomClearedAtForUser(userId, access.roomId),
          await getDmConversationClearedAtForUserAliases(userId, [
            access.otherUserId,
            rawOtherUserId,
          ])
        )
      : null;

  if (!supabase) {
    return NextResponse.json({ error: "system unavailable" }, { status: 500 });
  }

  const effectiveAfter =
    after && clearedAt
      ? new Date(after).getTime() > new Date(clearedAt).getTime()
        ? after
        : clearedAt
      : after || clearedAt || null;

  if (limit > 0 || before || after) {
    try {
      const page = await getChatMessagesPage({
        roomId: access.roomId,
        before,
        limit: limit || undefined,
        after: effectiveAfter,
        supabase,
      });

      return NextResponse.json(page, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("LOAD DM API MESSAGE PAGE ERROR:", error);
      return NextResponse.json({ error: "load failed" }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("dmMessage")
    .select("*")
    .eq("roomId", access.roomId)
    .gt("createdAt", effectiveAfter || "1970-01-01T00:00:00.000Z")
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

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = String(session?.user?.id || "").trim();
  const lineId = getSessionLineId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const roomId = String(body?.roomId || "").trim();
  const messageId = String(body?.messageId || "").trim();

  if (!roomId || !messageId) {
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

  const { data: message, error: loadError } = await supabase
    .from("dmMessage")
    .select("id,roomId,senderId")
    .eq("id", messageId)
    .eq("roomId", access.roomId)
    .maybeSingle();

  if (loadError) {
    console.error("LOAD DELETE DM MESSAGE ERROR:", loadError);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }

  if (!message) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isMine =
    message.senderId === userId || (lineId ? message.senderId === lineId : false);

  if (!isMine) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("dmMessage")
    .delete()
    .eq("id", messageId)
    .eq("roomId", access.roomId);

  if (error) {
    console.error("DELETE DM MESSAGE ERROR:", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    roomId: access.roomId,
    messageId,
  });
}
