import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type DMRoomListItem = {
  roomId: string;
  lastMessage: string;
  createdAt: string;
  otherName: string;
  otherImage: string;
  unread: number;
};

function safeImage(image?: string | null) {
  return image || "/avatar.png";
}

function buildPreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "Photo";
  return "Start chatting";
}

export async function getDmRoomsForUser(
  myId: string,
  myLineId?: string | null
): Promise<DMRoomListItem[]> {
  if (!myId) return [];

  const roomOrFilters = [`usera.eq.${myId}`, `userb.eq.${myId}`];
  if (myLineId) {
    roomOrFilters.push(`usera.eq.${myLineId}`, `userb.eq.${myLineId}`);
  }

  const { data: roomsData, error: roomErr } = await supabase
    .from("dm_room")
    .select(
      "roomid,usera,userb,useraname,useraimage,userbname,userbimage,updatedat"
    )
    .or(roomOrFilters.join(","))
    .order("updatedat", { ascending: false });

  if (roomErr) {
    console.error("LOAD DM ROOM ERROR:", roomErr);
    return [];
  }

  const dedupedRooms = Array.from(
    new Map((roomsData || []).map((room) => [room.roomid, room])).values()
  );

  if (dedupedRooms.length === 0) {
    return [];
  }

  const roomIds = dedupedRooms.map((room) => String(room.roomid));
  const otherUserIds = dedupedRooms.map((room) =>
    room.usera === myId || (myLineId ? room.usera === myLineId : false)
      ? room.userb
      : room.usera
  );

  const [
    { data: messages, error: msgErr },
    { data: unreadRows, error: unreadErr },
    users,
  ] = await Promise.all([
    supabase
      .from("dmMessage")
      .select(
        "roomId,senderId,senderName,senderImage,content,imageUrl,createdAt"
      )
      .in("roomId", roomIds)
      .order("createdAt", { ascending: false }),
    supabase
      .from("dmMessage")
      .select("roomId,senderId,seenAt")
      .in("roomId", roomIds)
      .neq("senderId", myId)
      .neq("senderId", myLineId || "__never__")
      .is("seenAt", null),
    prisma.user.findMany({
      where: {
        OR: [{ id: { in: otherUserIds } }, { lineId: { in: otherUserIds } }],
      },
      select: {
        id: true,
        lineId: true,
        name: true,
        displayName: true,
        image: true,
      },
    }),
  ]);

  if (msgErr) {
    console.error("LOAD DM MESSAGE ERROR:", msgErr);
    return [];
  }

  if (unreadErr) {
    console.error("LOAD DM UNREAD ERROR:", unreadErr);
    return [];
  }

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

  const latestMessageByRoom = new Map<string, (typeof messages)[number]>();
  for (const message of messages || []) {
    const roomId = String(message.roomId || "");
    if (!roomId || latestMessageByRoom.has(roomId)) continue;
    latestMessageByRoom.set(roomId, message);
  }

  const unreadCountByRoom = new Map<string, number>();
  for (const row of unreadRows || []) {
    const roomId = String(row.roomId || "");
    if (!roomId) continue;
    unreadCountByRoom.set(roomId, (unreadCountByRoom.get(roomId) || 0) + 1);
  }

  return dedupedRooms
    .map((room) => {
      const latestMessage = latestMessageByRoom.get(String(room.roomid));
      if (!latestMessage) return null;

      const roomUserAIsMe =
        room.usera === myId || (myLineId ? room.usera === myLineId : false);
      const otherUserId = roomUserAIsMe ? room.userb : room.usera;
      const otherUser = userMap.get(otherUserId);

      return {
        roomId: String(room.roomid),
        createdAt:
          String(latestMessage.createdAt || "").trim() ||
          String(room.updatedat || "").trim(),
        lastMessage: buildPreview(latestMessage.content, latestMessage.imageUrl),
        otherName:
          otherUser?.name ||
          (roomUserAIsMe ? room.userbname : room.useraname) ||
          latestMessage.senderName ||
          "User",
        otherImage:
          otherUser?.image ||
          safeImage(roomUserAIsMe ? room.userbimage : room.useraimage) ||
          safeImage(latestMessage.senderImage),
        unread: unreadCountByRoom.get(String(room.roomid)) || 0,
      } satisfies DMRoomListItem;
    })
    .filter((room): room is DMRoomListItem => room !== null)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
}
