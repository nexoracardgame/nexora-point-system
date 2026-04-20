import { createClient } from "@supabase/supabase-js";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";

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
  if (imageUrl) return "รูปภาพ";
  return "เริ่มแชท";
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

  const [{ data: messages, error: msgErr }, { data: unreadRows, error: unreadErr }] =
    await Promise.all([
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
    ]);

  if (msgErr) {
    console.error("LOAD DM MESSAGE ERROR:", msgErr);
    return [];
  }

  if (unreadErr) {
    console.error("LOAD DM UNREAD ERROR:", unreadErr);
    return [];
  }

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

  const profiles = await Promise.all(
    dedupedRooms.map(async (room) => {
      const roomUserAIsMe =
        room.usera === myId || (myLineId ? room.usera === myLineId : false);
      const otherUserId = String(roomUserAIsMe ? room.userb : room.usera || "").trim();
      const profile = otherUserId ? await getLocalProfileByUserId(otherUserId) : null;

      return {
        roomId: String(room.roomid),
        otherUserId,
        profile,
      };
    })
  );

  const profileMap = new Map(
    profiles.map((item) => [item.roomId, item.profile])
  );

  return dedupedRooms
    .map((room) => {
      const latestMessage = latestMessageByRoom.get(String(room.roomid));
      const roomUserAIsMe =
        room.usera === myId || (myLineId ? room.usera === myLineId : false);
      const profile = profileMap.get(String(room.roomid));
      const createdAt =
        String(latestMessage?.createdAt || "").trim() ||
        String(room.updatedat || "").trim();

      return {
        roomId: String(room.roomid),
        createdAt,
        lastMessage: latestMessage
          ? buildPreview(latestMessage.content, latestMessage.imageUrl)
          : "เริ่มแชท",
        otherName:
          profile?.displayName ||
          (roomUserAIsMe ? room.userbname : room.useraname) ||
          latestMessage?.senderName ||
          "User",
        otherImage:
          profile?.image ||
          safeImage(roomUserAIsMe ? room.userbimage : room.useraimage) ||
          safeImage(latestMessage?.senderImage),
        unread: unreadCountByRoom.get(String(room.roomid)) || 0,
      } satisfies DMRoomListItem;
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
}
