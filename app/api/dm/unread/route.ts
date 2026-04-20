import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleRoomIds } from "@/lib/dm-access";
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

  const { count, error: unreadErr } = await supabase
    .from("dmMessage")
    .select("*", { count: "exact", head: true })
    .in("roomId", myRoomIds)
    .neq("senderId", userId)
    .neq("senderId", lineId || "__never__")
    .is("seenAt", null);

  if (unreadErr) {
    console.error("UNREAD MESSAGE ERROR:", unreadErr);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  return NextResponse.json({ count: count || 0 });
}
