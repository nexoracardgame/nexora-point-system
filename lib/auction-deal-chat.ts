import { resolveCardDisplayImage } from "@/lib/card-image";
import { getChatMessagesPage } from "@/lib/chat-room-server";
import {
  buildChatUser,
  CHAT_HISTORY_PAGE_SIZE,
  type ChatMessage,
  type ChatUser,
} from "@/lib/chat-room-types";
import {
  getDealChatRoomId,
  safeDealChatImage,
  safeDealChatName,
} from "@/lib/deal-chat";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const AUCTION_DEAL_ID_PREFIX = "auction:";
const AUCTION_DEAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type AuctionDealRoomRow = {
  id: string;
  roomNumber?: number | string | null;
  cardNo: string | null;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  openingPrice: unknown;
  minBidStep: unknown;
  startsAt: Date | string;
  endsAt: Date | string;
  sellerId: string | null;
  sellerName: string | null;
  sellerImage: string | null;
  status: string | null;
  createdAt: Date | string;
  confirmedWinnerId?: string | null;
  confirmedAt?: Date | string | null;
};

type AuctionDealBidRow = {
  bidderId: string | null;
  bidderName: string | null;
  bidderImage: string | null;
  amount: unknown;
  createdAt: Date | string;
};

export type AuctionDealRank = {
  bidderId: string;
  bidderName: string;
  bidderImage: string;
  amount: number;
  createdAt: string;
};

export type AuctionDealRoomSeed = {
  kind: "deal";
  roomId: string;
  dealId: string;
  otherUserId: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessage: string;
  otherName: string;
  otherImage: string;
  unread: number;
  dealCardName: string;
  dealCardImage: string;
  dealCardNo: string;
  dealPrice: number;
  dealMode: "sell";
  auctionDeal: true;
  sellerName: string;
  sellerImage: string;
};

export type AuctionDealBootstrap =
  | {
      ok: true;
      roomId: string;
      me: ChatUser;
      other: ChatUser;
      card: {
        id: string;
        no: string;
        name: string;
        image: string;
        listedPrice: number;
      };
      deal: {
        id: string;
        offeredPrice: number;
        mode: "sell";
      };
      auctionDeal: true;
      messages: ChatMessage[];
      hasMore: boolean;
      nextCursor: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type AuctionDealAccess =
  | {
      ok: true;
      roomId: string;
      dealId: string;
      auctionId: string;
      sellerId: string;
      bidderId: string;
      otherUserId: string;
      seller: {
        id: string;
        displayName: string;
        name: string;
        image: string;
      };
      bidder: {
        id: string;
        displayName: string;
        name: string;
        image: string;
      };
      room: NormalizedAuctionDealRoom;
      rank: AuctionDealRank;
    }
  | {
      ok: false;
      reason: "unauthorized" | "not-found" | "closed";
    };

type NormalizedAuctionDealRoom = {
  id: string;
  roomNumber: number;
  cardNo: string;
  cardName: string;
  imageUrl: string;
  rarity: string;
  openingPrice: number;
  minBidStep: number;
  startsAt: string;
  endsAt: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  status: string;
  createdAt: string;
  confirmedWinnerId: string;
  confirmedAt: string | null;
};

function safeText(value: unknown) {
  return String(value || "").trim();
}

function toNumber(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toIso(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeCardNo(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : "001";
}

function normalizeRoom(row: AuctionDealRoomRow): NormalizedAuctionDealRoom {
  const cardNo = normalizeCardNo(row.cardNo);

  return {
    id: safeText(row.id),
    roomNumber: Math.max(0, Math.floor(toNumber(row.roomNumber))),
    cardNo,
    cardName: safeText(row.cardName) || `Card #${cardNo}`,
    imageUrl: resolveCardDisplayImage(cardNo, safeText(row.imageUrl)),
    rarity: safeText(row.rarity) || "Legendary",
    openingPrice: toNumber(row.openingPrice),
    minBidStep: toNumber(row.minBidStep),
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    sellerId: safeText(row.sellerId),
    sellerName: safeText(row.sellerName) || "Auction Owner",
    sellerImage: safeText(row.sellerImage) || "/avatar.png",
    status: safeText(row.status) || "active",
    createdAt: toIso(row.createdAt),
    confirmedWinnerId: safeText(row.confirmedWinnerId),
    confirmedAt: row.confirmedAt ? toIso(row.confirmedAt) : null,
  };
}

function normalizeRank(row: AuctionDealBidRow): AuctionDealRank {
  return {
    bidderId: safeText(row.bidderId),
    bidderName: safeText(row.bidderName) || "Bidder",
    bidderImage: safeText(row.bidderImage) || "/avatar.png",
    amount: toNumber(row.amount),
    createdAt: toIso(row.createdAt),
  };
}

function isExpiredAfterRetention(room: NormalizedAuctionDealRoom, nowMs = Date.now()) {
  const endsAtMs = new Date(room.endsAt).getTime();
  return Number.isFinite(endsAtMs) && nowMs - endsAtMs >= AUCTION_DEAL_RETENTION_MS;
}

function auctionWindowHours(index: number) {
  if (index === 0) return 24;
  if (index === 1) return 12;
  if (index === 2) return 6;
  return 3;
}

function getActiveRankIndex(
  room: NormalizedAuctionDealRoom,
  ranking: AuctionDealRank[],
  nowMs = Date.now()
) {
  if (room.confirmedWinnerId) {
    return ranking.findIndex((rank) => rank.bidderId === room.confirmedWinnerId);
  }

  const endsAtMs = new Date(room.endsAt).getTime();
  if (!Number.isFinite(endsAtMs) || nowMs <= endsAtMs) {
    return -1;
  }

  let elapsedMs = nowMs - endsAtMs;

  for (let index = 0; index < ranking.length; index += 1) {
    const windowMs = auctionWindowHours(index) * 60 * 60 * 1000;
    if (elapsedMs < windowMs) {
      return index;
    }
    elapsedMs -= windowMs;
  }

  return -1;
}

export function getAuctionDealId(auctionId: string, bidderId: string) {
  const safeAuctionId = safeText(auctionId);
  const safeBidderId = safeText(bidderId);
  return `${AUCTION_DEAL_ID_PREFIX}${safeAuctionId}:${safeBidderId}`;
}

export function getAuctionDealChatRoomId(auctionId: string, bidderId: string) {
  return getDealChatRoomId(getAuctionDealId(auctionId, bidderId));
}

export function parseAuctionDealId(dealId?: string | null) {
  const value = safeText(dealId);
  if (!value.startsWith(AUCTION_DEAL_ID_PREFIX)) {
    return null;
  }

  const rest = value.slice(AUCTION_DEAL_ID_PREFIX.length);
  const separatorIndex = rest.lastIndexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= rest.length - 1) {
    return null;
  }

  const auctionId = rest.slice(0, separatorIndex).trim();
  const bidderId = rest.slice(separatorIndex + 1).trim();

  if (!auctionId || !bidderId) {
    return null;
  }

  return { auctionId, bidderId };
}

export function isAuctionDealId(dealId?: string | null) {
  return Boolean(parseAuctionDealId(dealId));
}

export function isAuctionDealChatRoomId(roomId?: string | null) {
  const value = safeText(roomId);
  return value.startsWith("deal:") && isAuctionDealId(value.slice(5));
}

export function parseAuctionDealChatRoomId(roomId?: string | null) {
  const value = safeText(roomId);
  if (!value.startsWith("deal:")) {
    return null;
  }

  return parseAuctionDealId(value.slice(5));
}

async function getAuctionRoomRow(auctionId: string) {
  const rows = await prisma.$queryRawUnsafe<AuctionDealRoomRow[]>(
    `SELECT * FROM "AuctionRoom" WHERE "id" = $1 LIMIT 1`,
    auctionId
  );

  return rows[0] ? normalizeRoom(rows[0]) : null;
}

async function getAuctionLatestRanking(auctionId: string) {
  const rows = await prisma.$queryRawUnsafe<AuctionDealBidRow[]>(
    `
      SELECT DISTINCT ON ("bidderId")
        "bidderId",
        "bidderName",
        "bidderImage",
        "amount",
        "createdAt"
      FROM "AuctionBid"
      WHERE "auctionId" = $1
      ORDER BY "bidderId", "createdAt" DESC, "amount" DESC
    `,
    auctionId
  );

  return rows
    .map(normalizeRank)
    .filter((rank) => rank.bidderId)
    .sort((a, b) => {
      const amountDiff = b.amount - a.amount;
      if (amountDiff !== 0) return amountDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

async function deleteRoomsFromSupabase(roomIds: string[]) {
  const supabase = getServerSupabaseClient();
  const uniqueRoomIds = Array.from(new Set(roomIds.map(safeText).filter(Boolean)));

  if (!supabase || uniqueRoomIds.length === 0) {
    return;
  }

  await Promise.all(
    uniqueRoomIds.map(async (roomId) => {
      await supabase.from("dmMessage").delete().eq("roomId", roomId);
      await supabase.from("dm_room").delete().eq("roomid", roomId);
    })
  );
}

export async function deleteAuctionDealMessagesForAuctionIds(auctionIds: string[]) {
  const supabase = getServerSupabaseClient();
  const safeAuctionIds = Array.from(new Set(auctionIds.map(safeText).filter(Boolean)));

  if (!supabase || safeAuctionIds.length === 0) {
    return;
  }

  for (const auctionId of safeAuctionIds) {
    const prefix = `deal:${AUCTION_DEAL_ID_PREFIX}${auctionId}:`;
    const { data } = await supabase
      .from("dmMessage")
      .select("roomId")
      .like("roomId", `${prefix}%`)
      .limit(1000);
    const { data: rooms } = await supabase
      .from("dm_room")
      .select("roomid")
      .like("roomid", `${prefix}%`)
      .limit(1000);

    await deleteRoomsFromSupabase([
      ...((data || []).map((item) => safeText((item as { roomId?: string }).roomId))),
      ...((rooms || []).map((item) => safeText((item as { roomid?: string }).roomid))),
    ]);
  }
}

export async function cleanupAuctionDealMessagesForAuction(
  auctionId: string,
  activeRoomIds: string[]
) {
  const supabase = getServerSupabaseClient();
  const safeAuctionId = safeText(auctionId);
  const activeSet = new Set(activeRoomIds.map(safeText).filter(Boolean));

  if (!supabase || !safeAuctionId) {
    return;
  }

  const prefix = `deal:${AUCTION_DEAL_ID_PREFIX}${safeAuctionId}:`;
  const [{ data: messageRows }, { data: roomRows }] = await Promise.all([
    supabase
      .from("dmMessage")
      .select("roomId")
      .like("roomId", `${prefix}%`)
      .limit(1000),
    supabase
      .from("dm_room")
      .select("roomid")
      .like("roomid", `${prefix}%`)
      .limit(1000),
  ]);

  const existingRoomIds = Array.from(
    new Set([
      ...((messageRows || []).map((item) => safeText((item as { roomId?: string }).roomId))),
      ...((roomRows || []).map((item) => safeText((item as { roomid?: string }).roomid))),
    ])
  ).filter(Boolean);

  const staleRoomIds = existingRoomIds.filter((roomId) => !activeSet.has(roomId));
  await deleteRoomsFromSupabase(staleRoomIds);
}

async function ensureAuctionDealRoomMetadata(input: {
  roomId: string;
  sellerId: string;
  sellerName: string;
  sellerImage: string;
  bidderId: string;
  bidderName: string;
  bidderImage: string;
}) {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.from("dm_room").upsert({
    roomid: input.roomId,
    usera: input.sellerId,
    userb: input.bidderId,
    useraname: safeDealChatName(input.sellerName, "Auction Owner"),
    useraimage: safeDealChatImage(input.sellerImage),
    userbname: safeDealChatName(input.bidderName, "Winner"),
    userbimage: safeDealChatImage(input.bidderImage),
    updatedat: new Date().toISOString(),
  });
}

async function getAuctionDealContext(input: {
  auctionId: string;
  bidderId: string;
  userId?: string | null;
  lineId?: string | null;
  ensureMetadata?: boolean;
}) {
  const auctionId = safeText(input.auctionId);
  const bidderId = safeText(input.bidderId);
  const userAliases = new Set(
    [input.userId, input.lineId].map(safeText).filter(Boolean)
  );

  if (!auctionId || !bidderId) {
    return { ok: false as const, reason: "not-found" as const };
  }

  const room = await getAuctionRoomRow(auctionId);
  if (!room) {
    await deleteAuctionDealMessagesForAuctionIds([auctionId]).catch(() => undefined);
    return { ok: false as const, reason: "not-found" as const };
  }

  if (isExpiredAfterRetention(room)) {
    await deleteAuctionDealMessagesForAuctionIds([auctionId]).catch(() => undefined);
    return { ok: false as const, reason: "closed" as const };
  }

  const ranking = await getAuctionLatestRanking(auctionId);
  const requestedRank = ranking.find((rank) => rank.bidderId === bidderId) || null;
  if (!requestedRank) {
    return { ok: false as const, reason: "not-found" as const };
  }

  const activeIndex = getActiveRankIndex(room, ranking);
  const activeRank = activeIndex >= 0 ? ranking[activeIndex] : null;
  const validRoomId = room.confirmedWinnerId
    ? room.confirmedWinnerId === bidderId
    : activeRank?.bidderId === bidderId;
  const activeRoomIds =
    room.confirmedWinnerId && activeRank
      ? [getAuctionDealChatRoomId(auctionId, activeRank.bidderId)]
      : activeRank
        ? [getAuctionDealChatRoomId(auctionId, activeRank.bidderId)]
        : [];

  await cleanupAuctionDealMessagesForAuction(auctionId, activeRoomIds).catch(
    () => undefined
  );

  if (!validRoomId) {
    return { ok: false as const, reason: "closed" as const };
  }

  const isParticipant =
    userAliases.size === 0 ||
    userAliases.has(room.sellerId) ||
    userAliases.has(requestedRank.bidderId);

  if (!isParticipant) {
    return { ok: false as const, reason: "unauthorized" as const };
  }

  const roomId = getAuctionDealChatRoomId(auctionId, requestedRank.bidderId);
  const dealId = getAuctionDealId(auctionId, requestedRank.bidderId);

  if (input.ensureMetadata) {
    await ensureAuctionDealRoomMetadata({
      roomId,
      sellerId: room.sellerId,
      sellerName: room.sellerName,
      sellerImage: room.sellerImage,
      bidderId: requestedRank.bidderId,
      bidderName: requestedRank.bidderName,
      bidderImage: requestedRank.bidderImage,
    }).catch(() => undefined);
  }

  return {
    ok: true as const,
    room,
    rank: requestedRank,
    roomId,
    dealId,
  };
}

export async function getAuctionDealAccess(input: {
  dealId: string;
  userId: string;
  lineId?: string | null;
}): Promise<AuctionDealAccess> {
  const parsed = parseAuctionDealId(input.dealId);
  if (!parsed) {
    return { ok: false, reason: "not-found" };
  }

  const context = await getAuctionDealContext({
    auctionId: parsed.auctionId,
    bidderId: parsed.bidderId,
    userId: input.userId,
    lineId: input.lineId,
    ensureMetadata: true,
  });

  if (!context.ok) {
    return context;
  }

  const { room, rank } = context;
  const userId = safeText(input.userId);
  const isSeller = userId === room.sellerId;

  return {
    ok: true,
    roomId: context.roomId,
    dealId: context.dealId,
    auctionId: room.id,
    sellerId: room.sellerId,
    bidderId: rank.bidderId,
    otherUserId: isSeller ? rank.bidderId : room.sellerId,
    seller: {
      id: room.sellerId,
      displayName: room.sellerName,
      name: room.sellerName,
      image: room.sellerImage,
    },
    bidder: {
      id: rank.bidderId,
      displayName: rank.bidderName,
      name: rank.bidderName,
      image: rank.bidderImage,
    },
    room,
    rank,
  };
}

export async function getAuctionDealBootstrap(input: {
  dealId: string;
  userId: string;
  limit?: number;
  before?: string | null;
}): Promise<AuctionDealBootstrap> {
  const parsed = parseAuctionDealId(input.dealId);
  if (!parsed || !safeText(input.userId)) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
    };
  }

  const access = await getAuctionDealAccess({
    dealId: input.dealId,
    userId: input.userId,
  });

  if (!access.ok) {
    return {
      ok: false,
      status:
        access.reason === "not-found"
          ? 404
          : access.reason === "closed"
            ? 409
            : 403,
      error: access.reason,
    };
  }

  const isSeller = access.sellerId === input.userId;
  const me = isSeller ? access.seller : access.bidder;
  const other = isSeller ? access.bidder : access.seller;
  const page = await getChatMessagesPage({
    roomId: access.roomId,
    limit: input.limit || CHAT_HISTORY_PAGE_SIZE,
    before: input.before,
  });

  return {
    ok: true,
    roomId: access.roomId,
    me: buildChatUser(me.id, me.displayName || me.name, me.image, "You"),
    other: buildChatUser(other.id, other.displayName || other.name, other.image),
    card: {
      id: access.room.id,
      no: access.room.cardNo,
      name: access.room.cardName,
      image: access.room.imageUrl,
      listedPrice: Number(access.rank.amount || access.room.openingPrice || 0),
    },
    deal: {
      id: access.dealId,
      offeredPrice: Number(access.rank.amount || 0),
      mode: "sell",
    },
    auctionDeal: true,
    messages: page.messages,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

export async function getAuctionDealRoomSeedsForUser(userId: string) {
  const safeUserId = safeText(userId);
  if (!safeUserId) {
    return [];
  }

  const rows = await prisma.$queryRawUnsafe<AuctionDealRoomRow[]>(
    `
      SELECT *
      FROM "AuctionRoom"
      WHERE "endsAt" < NOW()
        AND "endsAt" >= NOW() - INTERVAL '7 days'
      ORDER BY "endsAt" DESC, "createdAt" DESC
      LIMIT 300
    `
  );
  const seeds: AuctionDealRoomSeed[] = [];

  for (const rawRoom of rows) {
    const room = normalizeRoom(rawRoom);
    const ranking = await getAuctionLatestRanking(room.id);
    const activeIndex = getActiveRankIndex(room, ranking);
    const rank = activeIndex >= 0 ? ranking[activeIndex] : null;

    if (!rank) {
      await cleanupAuctionDealMessagesForAuction(room.id, []).catch(() => undefined);
      continue;
    }

    const activeRoomId = getAuctionDealChatRoomId(room.id, rank.bidderId);
    await cleanupAuctionDealMessagesForAuction(room.id, [activeRoomId]).catch(
      () => undefined
    );

    if (safeUserId !== room.sellerId && safeUserId !== rank.bidderId) {
      continue;
    }

    const isSeller = safeUserId === room.sellerId;
    seeds.push({
      kind: "deal",
      roomId: activeRoomId,
      dealId: getAuctionDealId(room.id, rank.bidderId),
      otherUserId: isSeller ? rank.bidderId : room.sellerId,
      otherName: isSeller ? rank.bidderName : room.sellerName,
      otherImage: isSeller ? rank.bidderImage : room.sellerImage,
      lastMessage: "Auction winner deal chat",
      createdAt: room.confirmedAt || room.endsAt || room.createdAt,
      lastMessageAt: "",
      unread: 0,
      dealCardName: room.cardName,
      dealCardImage: room.imageUrl,
      dealCardNo: room.cardNo,
      dealPrice: rank.amount,
      dealMode: "sell",
      auctionDeal: true,
      sellerName: room.sellerName,
      sellerImage: room.sellerImage,
    });
  }

  return seeds;
}

export async function getAccessibleAuctionDealRoomIds(userId: string) {
  const seeds = await getAuctionDealRoomSeedsForUser(userId);
  return seeds.map((seed) => seed.roomId);
}
