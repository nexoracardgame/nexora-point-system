import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleRoomIds } from "@/lib/dm-access";
import {
  getDmConversationClearedAtMap,
  getDmRoomClearedAtMap,
  getLatestClearTimestamp,
  isRoomActivityVisibleAfterClear,
} from "@/lib/dm-room-clear-state";
import { getServerSupabaseClient } from "@/lib/supabase-server";

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

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

  const [roomResult, unreadResult] = await Promise.all([
    directRoomIds.length
      ? supabase
          .from("dm_room")
          .select("roomid,usera,userb")
          .in("roomid", directRoomIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("dmMessage")
      .select("roomId,createdAt")
      .in("roomId", myRoomIds)
      .neq("senderId", userId)
      .neq("senderId", lineId || "__never__")
      .is("seenAt", null),
  ]);

  if (roomResult.error) {
    console.error("UNREAD ROOM ERROR:", roomResult.error);
  }

  if (unreadResult.error) {
    console.error("UNREAD MESSAGE ERROR:", unreadResult.error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  const currentAliases = uniqueStrings([String(userId), String(lineId || "")]);
  const peerAliasByRoomId = new Map(
    (roomResult.data || []).map((room) => {
      const roomId = String(room.roomid || "").trim();
      const userA = String(room.usera || "").trim();
      const userB = String(room.userb || "").trim();
      const peer = currentAliases.includes(userA) ? userB : userA;
      return [roomId, uniqueStrings([peer])] as const;
    })
  );
  const conversationClearAtByPeerAlias = await getDmConversationClearedAtMap(
    String(userId),
    Array.from(peerAliasByRoomId.values()).flat()
  );

  const count = (unreadResult.data || []).filter((row) => {
    const roomId = String(row.roomId || "").trim();
    if (!roomId || roomId.startsWith("deal:")) {
      return true;
    }
    const clearedAt = getLatestClearTimestamp(
      directRoomClearAtByRoomId.get(roomId) || null,
      ...(peerAliasByRoomId.get(roomId) || []).map(
        (alias) => conversationClearAtByPeerAlias.get(alias) || null
      )
    );

    return isRoomActivityVisibleAfterClear(
      String(row.createdAt || "").trim(),
      clearedAt
    );
  }).length;

  return NextResponse.json({ count });
}
