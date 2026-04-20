import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");

  if (!roomId) {
    return NextResponse.json({ error: "no roomId" }, { status: 400 });
  }

  const myId = String(session.user.id || "").trim();

  const { data: room, error } = await supabase
    .from("dm_room")
    .select("*")
    .eq("roomid", roomId)
    .maybeSingle();

  if (error || !room) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const roomUserAIsMe = room.usera === myId;
  const otherUserId = String(roomUserAIsMe ? room.userb : room.usera || "").trim();
  const otherProfile = otherUserId ? await getLocalProfileByUserId(otherUserId) : null;

  return NextResponse.json({
    otherUser: {
      id: otherUserId,
      name:
        otherProfile?.displayName ||
        (roomUserAIsMe ? room.userbname : room.useraname) ||
        "User",
      image:
        otherProfile?.image ||
        (roomUserAIsMe ? room.userbimage : room.useraimage) ||
        "/avatar.png",
    },
  });
}
