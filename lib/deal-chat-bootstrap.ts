import { prisma } from "@/lib/prisma";
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

export type DealChatCard = {
  id: string;
  no: string;
  name: string;
  image: string;
  listedPrice: number;
};

export type DealChatDeal = {
  id: string;
  offeredPrice: number;
};

export type DealChatBootstrap =
  | {
      ok: true;
      roomId: string;
      me: ChatUser;
      other: ChatUser;
      card: DealChatCard;
      deal: DealChatDeal;
      messages: ChatMessage[];
      hasMore: boolean;
      nextCursor: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

async function ensureDealRoomMetadata(input: {
  roomId: string;
  buyerId: string;
  buyerName?: string | null;
  buyerImage?: string | null;
  sellerId: string;
  sellerName?: string | null;
  sellerImage?: string | null;
}) {
  const { getServerSupabaseClient } = await import("@/lib/supabase-server");
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return;
  }

  await supabase.from("dm_room").upsert({
    roomid: input.roomId,
    usera: input.buyerId,
    userb: input.sellerId,
    useraname: safeDealChatName(input.buyerName, "Buyer"),
    useraimage: safeDealChatImage(input.buyerImage),
    userbname: safeDealChatName(input.sellerName, "Seller"),
    userbimage: safeDealChatImage(input.sellerImage),
    updatedat: new Date().toISOString(),
  });
}

export async function getDealChatBootstrap(input: {
  dealId: string;
  userId: string;
  limit?: number;
  before?: string | null;
}): Promise<DealChatBootstrap> {
  const dealId = String(input.dealId || "").trim();
  const userId = String(input.userId || "").trim();

  if (!dealId || !userId) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
    };
  }

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
    return {
      ok: false,
      status: 404,
      error: "not found",
    };
  }

  if (deal.buyerId !== userId && deal.sellerId !== userId) {
    return {
      ok: false,
      status: 403,
      error: "forbidden",
    };
  }

  if (deal.status !== "accepted") {
    return {
      ok: false,
      status: 409,
      error: "deal chat unavailable",
    };
  }

  const listing = await prisma.marketListing.findUnique({
    where: {
      id: deal.cardId,
    },
    select: {
      id: true,
      cardNo: true,
      cardName: true,
      imageUrl: true,
      price: true,
    },
  });

  const roomId = getDealChatRoomId(deal.id);

  await ensureDealRoomMetadata({
    roomId,
    buyerId: deal.buyer.id,
    buyerName: deal.buyer.displayName || deal.buyer.name,
    buyerImage: deal.buyer.image,
    sellerId: deal.seller.id,
    sellerName: deal.seller.displayName || deal.seller.name,
    sellerImage: deal.seller.image,
  }).catch(() => undefined);

  const isBuyer = deal.buyerId === userId;
  const me = isBuyer ? deal.buyer : deal.seller;
  const other = isBuyer ? deal.seller : deal.buyer;

  const page = await getChatMessagesPage({
    roomId,
    limit: input.limit || CHAT_HISTORY_PAGE_SIZE,
    before: input.before,
  });

  return {
    ok: true,
    roomId,
    me: buildChatUser(
      me.id,
      safeDealChatName(me.displayName || me.name, isBuyer ? "Buyer" : "Seller"),
      safeDealChatImage(me.image)
    ),
    other: buildChatUser(
      other.id,
      safeDealChatName(other.displayName || other.name),
      safeDealChatImage(other.image)
    ),
    deal: {
      id: deal.id,
      offeredPrice: Number(deal.offeredPrice || 0),
    },
    card: {
      id: deal.cardId,
      no: String(listing?.cardNo || "001").padStart(3, "0"),
      name: safeDealChatName(
        listing?.cardName || `Card #${String(listing?.cardNo || "001").padStart(3, "0")}`,
        "Unknown Card"
      ),
      image: safeDealChatImage(
        resolveCardDisplayImage(listing?.cardNo || "001", listing?.imageUrl),
        "/cards/001.jpg"
      ),
      listedPrice: Number(listing?.price || 0),
    },
    messages: page.messages,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}
