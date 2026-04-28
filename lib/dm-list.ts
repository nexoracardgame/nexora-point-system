import { getDealChatRoomId } from "@/lib/deal-chat";
import { resolveCardDisplayImage } from "@/lib/card-image";
import {
  getDmRoomClearedAtMap,
  isRoomActivityVisibleAfterClear,
} from "@/lib/dm-room-clear-state";
import { getLocalProfileByUserId } from "@/lib/local-profile-store";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export type DMRoomListItem = {
  kind: "direct" | "deal";
  roomId: string;
  otherUserId?: string;
  dealId?: string;
  lastMessage: string;
  createdAt: string;
  lastMessageAt?: string;
  otherName: string;
  otherImage: string;
  unread: number;
  dealCardName?: string;
  dealCardImage?: string;
  dealCardNo?: string;
  dealPrice?: number;
  sellerName?: string;
  sellerImage?: string;
};

function safeImage(image?: string | null) {
  return String(image || "").trim() || "/avatar.png";
}

function buildPreview(content?: string | null, imageUrl?: string | null) {
  const text = String(content || "").trim();
  if (text) return text;
  if (imageUrl) return "รูปภาพ";
  return "เริ่มแชท";
}

function latestTime(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function compareRoomsByLatest(
  a: { lastMessageAt?: string | null; createdAt?: string | null },
  b: { lastMessageAt?: string | null; createdAt?: string | null }
) {
  const aLastMessageTime = latestTime(a.lastMessageAt);
  const bLastMessageTime = latestTime(b.lastMessageAt);

  if (aLastMessageTime !== bLastMessageTime) {
    return bLastMessageTime - aLastMessageTime;
  }

  return latestTime(b.createdAt) - latestTime(a.createdAt);
}

async function resolveCanonicalUserId(rawUserId: string) {
  const value = String(rawUserId || "").trim();

  if (!value) return "";

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: value }, { lineId: value }],
    },
    select: {
      id: true,
    },
  });

  return String(user?.id || value).trim();
}

export async function getDmRoomsForUser(
  myId: string,
  myLineId?: string | null
): Promise<DMRoomListItem[]> {
  if (!myId) return [];

  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return [];
  }

  const roomOrFilters = [`usera.eq.${myId}`, `userb.eq.${myId}`];
  if (myLineId) {
    roomOrFilters.push(`usera.eq.${myLineId}`, `userb.eq.${myLineId}`);
  }

  const [directRoomsResult, deals] = await Promise.all([
    supabase
      .from("dm_room")
      .select(
        "roomid,usera,userb,useraname,useraimage,userbname,userbimage,updatedat"
      )
      .or(roomOrFilters.join(","))
      .order("updatedat", { ascending: false }),
    prisma.dealRequest.findMany({
      where: {
        status: "accepted",
        OR: [{ buyerId: myId }, { sellerId: myId }],
      },
      include: {
        buyer: {
          select: {
            id: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
        seller: {
          select: {
            id: true,
            displayName: true,
            name: true,
            image: true,
          },
        },
      },
    }),
  ]);

  if (directRoomsResult.error) {
    console.error("LOAD DM ROOM ERROR:", directRoomsResult.error);
    return [];
  }

  const dedupedRooms = Array.from(
    new Map(
      (directRoomsResult.data || []).map((room) => [room.roomid, room])
    ).values()
  );

  const directRoomIds = dedupedRooms.map((room) => String(room.roomid));
  const dealRoomIds = deals.map((deal) => getDealChatRoomId(deal.id));
  const roomIds = Array.from(new Set([...directRoomIds, ...dealRoomIds]));
  const directRoomClearAtByRoomId = await getDmRoomClearedAtMap(myId, directRoomIds);

  if (roomIds.length === 0) {
    return [];
  }

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
        .select("roomId,senderId,seenAt,createdAt")
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

  const latestMessageByRoom = new Map<
    string,
    NonNullable<typeof messages>[number]
  >();
  for (const message of messages || []) {
    const roomId = String(message.roomId || "");
    if (!roomId || latestMessageByRoom.has(roomId)) continue;
    if (
      directRoomClearAtByRoomId.has(roomId) &&
      !isRoomActivityVisibleAfterClear(
        String(message.createdAt || "").trim(),
        directRoomClearAtByRoomId.get(roomId) || null
      )
    ) {
      continue;
    }
    latestMessageByRoom.set(roomId, message);
  }

  const unreadCountByRoom = new Map<string, number>();
  for (const row of unreadRows || []) {
    const roomId = String(row.roomId || "");
    if (!roomId) continue;
    if (
      directRoomClearAtByRoomId.has(roomId) &&
      !isRoomActivityVisibleAfterClear(
        String(row.createdAt || "").trim(),
        directRoomClearAtByRoomId.get(roomId) || null
      )
    ) {
      continue;
    }
    unreadCountByRoom.set(roomId, (unreadCountByRoom.get(roomId) || 0) + 1);
  }

  const profileRows = await Promise.all(
    dedupedRooms.map(async (room) => {
      const roomUserAIsMe =
        room.usera === myId || (myLineId ? room.usera === myLineId : false);
      const rawOtherUserId = String(
        roomUserAIsMe ? room.userb : room.usera || ""
      ).trim();
      const otherUserId = await resolveCanonicalUserId(rawOtherUserId);
      const profile = otherUserId
        ? await getLocalProfileByUserId(otherUserId)
        : null;

      return {
        roomId: String(room.roomid),
        otherUserId: otherUserId || rawOtherUserId,
        profile,
      };
    })
  );

  const profileMap = new Map(
    profileRows.map((item) => [item.roomId, item.profile])
  );
  const otherUserIdMap = new Map(
    profileRows.map((item) => [item.roomId, item.otherUserId])
  );

  const dealCardIds = Array.from(
    new Set(deals.map((deal) => String(deal.cardId || "")).filter(Boolean))
  );
  const dealCards = dealCardIds.length
    ? await prisma.marketListing.findMany({
        where: {
          id: {
            in: dealCardIds,
          },
        },
      select: {
        id: true,
        cardName: true,
        cardNo: true,
        imageUrl: true,
        price: true,
      },
    })
    : [];
  const dealCardById = new Map(dealCards.map((card) => [card.id, card]));

  const directItems = dedupedRooms.map((room) => {
    const roomId = String(room.roomid);
    const latestMessage = latestMessageByRoom.get(roomId);
    const roomUserAIsMe =
      room.usera === myId || (myLineId ? room.usera === myLineId : false);
    const profile = profileMap.get(roomId);
    const otherUserId =
      otherUserIdMap.get(roomId) ||
      String(roomUserAIsMe ? room.userb : room.usera || "").trim();
    const lastMessageAt = String(latestMessage?.createdAt || "").trim();
    const createdAt = lastMessageAt || String(room.updatedat || "").trim();

    return {
      kind: "direct" as const,
      roomId,
      otherUserId,
      createdAt,
      lastMessageAt,
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
      unread: unreadCountByRoom.get(roomId) || 0,
    };
  }).filter((item) => {
    const clearedAt = directRoomClearAtByRoomId.get(item.roomId) || null;
    if (!clearedAt) {
      return true;
    }

    return isRoomActivityVisibleAfterClear(item.lastMessageAt, clearedAt);
  });

  const directByOther = new Map<
    string,
    (DMRoomListItem & { otherUserId?: string })
  >();

  for (const item of directItems.sort(compareRoomsByLatest)) {
    const key = item.otherUserId || item.roomId;
    const existing = directByOther.get(key);

    if (!existing) {
      directByOther.set(key, item);
      continue;
    }

    directByOther.set(key, {
      ...existing,
      unread: existing.unread + item.unread,
    });
  }

  const dealItems: Array<DMRoomListItem & { otherUserId?: string }> = deals.map((deal) => {
    const roomId = getDealChatRoomId(deal.id);
    const latestMessage = latestMessageByRoom.get(roomId);
    const isBuyer = deal.buyerId === myId;
    const other = isBuyer ? deal.seller : deal.buyer;
    const seller = deal.seller;
    const card = dealCardById.get(deal.cardId);
    const cardName =
      String(card?.cardName || "").trim() ||
      `Card #${String(card?.cardNo || "").padStart(3, "0")}`;
    const lastMessageAt = String(latestMessage?.createdAt || "").trim();
    const createdAt = lastMessageAt || String(deal.createdAt || "").trim();

    return {
      kind: "deal",
      roomId,
      dealId: deal.id,
      createdAt,
      lastMessageAt,
      lastMessage: latestMessage
        ? buildPreview(latestMessage.content, latestMessage.imageUrl)
        : "เริ่มคุยห้องดีล",
      otherName: other.displayName || other.name || "User",
      otherImage: safeImage(other.image),
      unread: unreadCountByRoom.get(roomId) || 0,
      dealCardName: cardName,
      dealCardImage: resolveCardDisplayImage(card?.cardNo || "001", card?.imageUrl),
      dealCardNo: String(card?.cardNo || "001").padStart(3, "0"),
      dealPrice: Number(deal.offeredPrice || card?.price || 0),
      sellerName: seller.displayName || seller.name || "Seller",
      sellerImage: safeImage(seller.image),
    };
  });

  return [...Array.from(directByOther.values()), ...dealItems].sort(
    compareRoomsByLatest
  );
}
