import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleRoomIds } from "@/lib/dm-access";
import {
  getDmRoomClearedAtMap,
  isRoomActivityVisibleAfterClear,
} from "@/lib/dm-room-clear-state";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const lineId = (session?.user as { lineId?: string } | undefined)?.lineId;

  if (!userId) {
    return NextResponse.json({ count: 0 });
  }

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  const myRoomIds = await getAccessibleRoomIds(String(userId), String(lineId || ""));

  if (myRoomIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const directRoomIds = myRoomIds.filter((roomId) => !roomId.startsWith("deal:"));
  const directRoomClearAtByRoomId = await getDmRoomClearedAtMap(
    String(userId),
    directRoomIds
  );

  const { data, error: unreadErr } = await supabase
    .from("dmMessage")
    .select("roomId,createdAt")
    .in("roomId", myRoomIds)
    .neq("senderId", userId)
    .neq("senderId", lineId || "__never__")
    .is("seenAt", null);

  if (unreadErr) {
    console.error("UNREAD MESSAGE ERROR:", unreadErr);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  const count = (data || []).filter((row) => {
    const roomId = String(row.roomId || "").trim();
    if (!roomId || roomId.startsWith("deal:")) {
      return true;
    }

    return isRoomActivityVisibleAfterClear(
      String(row.createdAt || "").trim(),
      directRoomClearAtByRoomId.get(roomId) || null
    );
  }).length;

  return NextResponse.json({ count });
}
