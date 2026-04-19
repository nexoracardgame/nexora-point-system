import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function safeImage(image?: string | null) {
  return image || "/avatar.png";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const myId = session?.user?.id;
  const myLineId = (session?.user as { lineId?: string } | undefined)?.lineId;

  if (!myId) {
    return NextResponse.json({ rooms: [] }, { status: 200 });
  }

  const [{ data: roomsData, error: roomErr }, { data: messages, error: msgErr }] =
    await Promise.all([
      supabase.from("dm_room").select("*").order("updatedat", { ascending: false }),
      supabase.from("dmMessage").select("*").order("createdAt", { ascending: false }),
    ]);

  if (roomErr) {
    console.error("LOAD DM ROOM ERROR:", roomErr);
    return NextResponse.json({ rooms: [] }, { status: 500 });
  }

  if (msgErr) {
    console.error("LOAD DM MESSAGE ERROR:", msgErr);
    return NextResponse.json({ rooms: [] }, { status: 500 });
  }

  const myRooms = (roomsData || []).filter(
    (room) =>
      room.usera === myId ||
      room.userb === myId ||
      (myLineId ? room.usera === myLineId || room.userb === myLineId : false)
  );

  if (myRooms.length === 0) {
    return NextResponse.json({ rooms: [] });
  }

  const dedupedRooms = Array.from(
    new Map(
      myRooms.map((room) => [room.roomid, room])
    ).values()
  );

  const otherUserIds = dedupedRooms.map((room) =>
    room.usera === myId || (myLineId ? room.usera === myLineId : false)
      ? room.userb
      : room.usera
  );

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: otherUserIds } },
        { lineId: { in: otherUserIds } },
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

  const userMap = new Map(
    users.flatMap((user) => {
      const value = {
        name: user.displayName || user.name || "User",
        image: safeImage(user.image),
      };

      return [user.id, user.lineId]
        .filter(Boolean)
        .map((key) => [key, value] as const);
    })
  );

  const result = dedupedRooms
    .map((room) => {
      const roomMessages = (messages || []).filter(
        (message) => message.roomId === room.roomid
      );
      const latestMessage = roomMessages[0];

      if (!latestMessage) {
        return null;
      }

      const roomUserAIsMe =
        room.usera === myId ||
        (myLineId ? room.usera === myLineId : false);
      const otherUserId = roomUserAIsMe ? room.userb : room.usera;
      const otherUser = userMap.get(otherUserId);
      const latestOtherMessage = roomMessages.find(
        (message) =>
          message.senderId !== myId &&
          (myLineId ? message.senderId !== myLineId : true)
      );
      const unread = roomMessages.filter(
        (message) =>
          message.senderId !== myId &&
          (myLineId ? message.senderId !== myLineId : true) &&
          !message.seenAt
      ).length;

      return {
        roomId: room.roomid,
        createdAt: latestMessage.createdAt || room.updatedat || "",
        lastMessage:
          latestMessage.content?.trim() ||
          (latestMessage.imageUrl ? "Photo" : "Start chatting"),
        otherName:
          otherUser?.name ||
          latestOtherMessage?.senderName ||
          (roomUserAIsMe ? room.userbname : room.useraname) ||
          latestMessage.senderName ||
          "User",
        otherImage:
          otherUser?.image ||
          safeImage(latestOtherMessage?.senderImage) ||
          safeImage(roomUserAIsMe ? room.userbimage : room.useraimage) ||
          safeImage(latestMessage.senderImage),
        unread,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return NextResponse.json({ rooms: result });
}
