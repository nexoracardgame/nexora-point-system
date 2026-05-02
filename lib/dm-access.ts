import { prisma } from "@/lib/prisma";
import { getDealChatRoomId, isDealChatRoomId } from "@/lib/deal-chat";
import { getServerSupabaseClient } from "@/lib/supabase-server";

type DealParticipant = {
  id: string;
  displayName?: string | null;
  name?: string | null;
  image?: string | null;
};

export type DmAccessResult =
  | {
      ok: true;
      kind: "direct";
      roomId: string;
      room: {
        roomid: string;
        usera: string;
        userb: string;
        useraname?: string | null;
        useraimage?: string | null;
        userbname?: string | null;
        userbimage?: string | null;
      };
      otherUserId: string;
    }
  | {
      ok: true;
      kind: "deal";
      roomId: string;
      dealId: string;
      buyerId: string;
      sellerId: string;
      otherUserId: string;
      buyer: DealParticipant;
      seller: DealParticipant;
    }
  | {
      ok: false;
      reason: "unauthorized" | "not-found" | "closed";
    };

export async function getAccessibleDirectRoomIds(
  userId: string,
  lineId?: string | null
) {
  const supabase = getServerSupabaseClient();
  if (!supabase || !userId) {
    return [];
  }

  const roomOrFilters = [`usera.eq.${userId}`, `userb.eq.${userId}`];
  if (lineId) {
    roomOrFilters.push(`usera.eq.${lineId}`, `userb.eq.${lineId}`);
  }

  const { data, error } = await supabase
    .from("dm_room")
    .select("roomid")
    .or(roomOrFilters.join(","));

  if (error) {
    console.error("DM ACCESS ROOM LIST ERROR:", error);
    return [];
  }

  return Array.from(
    new Set(
      (data || [])
        .map((room) => String(room.roomid || "").trim())
        .filter(Boolean)
    )
  );
}

export async function getAccessibleDealRoomIds(userId: string) {
  if (!userId) {
    return [];
  }

  const deals = await prisma.dealRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    select: {
      id: true,
    },
  });

  return deals.map((deal) => getDealChatRoomId(deal.id));
}

export async function getAccessibleRoomIds(
  userId: string,
  lineId?: string | null
) {
  const [directRoomIds, dealRoomIds] = await Promise.all([
    getAccessibleDirectRoomIds(userId, lineId),
    getAccessibleDealRoomIds(userId),
  ]);

  return Array.from(new Set([...directRoomIds, ...dealRoomIds]));
}

async function resolveCanonicalUserId(rawUserId: string) {
  const value = String(rawUserId || "").trim();

  if (!value) {
    return "";
  }

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

export async function getDmRoomAccess(input: {
  roomId: string;
  userId: string;
  lineId?: string | null;
}): Promise<DmAccessResult> {
  const roomId = String(input.roomId || "").trim();
  const userId = String(input.userId || "").trim();
  const lineId = String(input.lineId || "").trim();

  if (!roomId || !userId) {
    return { ok: false, reason: "unauthorized" };
  }

  if (isDealChatRoomId(roomId)) {
    const dealId = roomId.replace(/^deal:/, "");
    const deal = await prisma.dealRequest.findUnique({
      where: {
        id: dealId,
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
    });

    if (!deal) {
      return { ok: false, reason: "not-found" };
    }

    const isParticipant = deal.buyerId === userId || deal.sellerId === userId;
    if (!isParticipant) {
      return { ok: false, reason: "unauthorized" };
    }

    if (String(deal.status || "").toLowerCase() !== "accepted") {
      return { ok: false, reason: "closed" };
    }

    return {
      ok: true,
      kind: "deal",
      roomId,
      dealId,
      buyerId: deal.buyerId,
      sellerId: deal.sellerId,
      otherUserId: deal.buyerId === userId ? deal.sellerId : deal.buyerId,
      buyer: deal.buyer,
      seller: deal.seller,
    };
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: "not-found" };
  }

  const { data: room, error } = await supabase
    .from("dm_room")
    .select("roomid,usera,userb,useraname,useraimage,userbname,userbimage")
    .eq("roomid", roomId)
    .maybeSingle();

  if (error || !room) {
    return { ok: false, reason: "not-found" };
  }

  const allowed =
    room.usera === userId ||
    room.userb === userId ||
    (lineId ? room.usera === lineId || room.userb === lineId : false);

  const [canonicalUserA, canonicalUserB] = await Promise.all([
    resolveCanonicalUserId(String(room.usera || "")),
    resolveCanonicalUserId(String(room.userb || "")),
  ]);
  const allowedByCanonical =
    canonicalUserA === userId ||
    canonicalUserB === userId ||
    (lineId ? canonicalUserA === lineId || canonicalUserB === lineId : false);

  if (!allowed && !allowedByCanonical) {
    return { ok: false, reason: "unauthorized" };
  }

  const roomUserAIsMe =
    room.usera === userId ||
    canonicalUserA === userId ||
    (lineId ? room.usera === lineId || canonicalUserA === lineId : false);
  const otherUserId = String(roomUserAIsMe ? room.userb : room.usera || "").trim();
  const canonicalOtherUserId = await resolveCanonicalUserId(otherUserId);

  return {
    ok: true,
    kind: "direct",
    roomId,
    room,
    otherUserId: canonicalOtherUserId,
  };
}
