import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const lineId = (session?.user as { lineId?: string } | undefined)?.lineId;

  if (!userId) {
    return NextResponse.json({ count: 0 });
  }

  const { data: rooms, error: roomErr } = await supabase
    .from("dm_room")
    .select("roomid,usera,userb");

  if (roomErr) {
    console.error("UNREAD ROOM ERROR:", roomErr);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  const myRoomIds = (rooms || [])
    .filter(
      (room) =>
        room.usera === userId ||
        room.userb === userId ||
        (lineId ? room.usera === lineId || room.userb === lineId : false)
    )
    .map((room) => room.roomid);

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
