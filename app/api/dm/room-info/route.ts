import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";

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

  const myId = session.user.id;
  const myLineId = (session.user as { lineId?: string }).lineId;

  const prismaRoom = await prisma.dmRoom.findUnique({
    where: { id: roomId },
  });

  let otherLookupKey: string | null = null;

  if (prismaRoom) {
    otherLookupKey = prismaRoom.user1 === myId ? prismaRoom.user2 : prismaRoom.user1;
  } else {
    const { data: legacyRoom, error } = await supabase
      .from("dm_room")
      .select("*")
      .eq("roomid", roomId)
      .maybeSingle();

    if (error || !legacyRoom) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const roomUserAIsMe =
      legacyRoom.usera === myId ||
      (myLineId ? legacyRoom.usera === myLineId : false);

    otherLookupKey = roomUserAIsMe ? legacyRoom.userb : legacyRoom.usera;
  }

  const otherUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: otherLookupKey || "" },
        { lineId: otherLookupKey || "" },
      ],
    },
    select: {
      id: true,
      lineId: true,
      name: true,
      displayName: true,
      image: true,
    },
  });

  if (!otherUser) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  return NextResponse.json({
    otherUser: {
      id: otherUser.id,
      name: otherUser.displayName || otherUser.name || "User",
      image: otherUser.image || "/avatar.png",
    },
  });
}
