import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDealChatRoomId,
  safeDealChatImage,
  safeDealChatName,
} from "@/lib/deal-chat";
import { prisma } from "@/lib/prisma";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function ensureDealRoomMetadata(input: {
  roomId: string;
  buyerId: string;
  buyerName?: string | null;
  buyerImage?: string | null;
  sellerId: string;
  sellerName?: string | null;
  sellerImage?: string | null;
}) {
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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const currentUserId = String(session?.user?.id || "").trim();

  if (!currentUserId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dealId = String(searchParams.get("dealId") || "").trim();

  if (!dealId) {
    return NextResponse.json({ error: "missing dealId" }, { status: 400 });
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
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isParticipant =
    deal.buyerId === currentUserId || deal.sellerId === currentUserId;

  if (!isParticipant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (deal.status !== "accepted") {
    return NextResponse.json({ error: "deal chat unavailable" }, { status: 409 });
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

  const isBuyer = deal.buyerId === currentUserId;

  return NextResponse.json({
    roomId,
    me: {
      id: isBuyer ? deal.buyer.id : deal.seller.id,
      name: safeDealChatName(
        isBuyer
          ? deal.buyer.displayName || deal.buyer.name
          : deal.seller.displayName || deal.seller.name,
        isBuyer ? "Buyer" : "Seller"
      ),
      image: safeDealChatImage(isBuyer ? deal.buyer.image : deal.seller.image),
    },
    other: {
      id: isBuyer ? deal.seller.id : deal.buyer.id,
      name: safeDealChatName(
        isBuyer
          ? deal.seller.displayName || deal.seller.name
          : deal.buyer.displayName || deal.buyer.name
      ),
      image: safeDealChatImage(isBuyer ? deal.seller.image : deal.buyer.image),
    },
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
        listing?.imageUrl,
        `/cards/${String(listing?.cardNo || "001").padStart(3, "0")}.jpg`
      ),
      listedPrice: Number(listing?.price || 0),
    },
  });
}
