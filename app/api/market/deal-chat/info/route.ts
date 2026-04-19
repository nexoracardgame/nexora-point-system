import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDealChatRoomId } from "@/lib/deal-chat";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function safeName(name?: string | null) {
  return String(name || "").trim() || "User";
}

function safeImage(image?: string | null, fallback = "/avatar.png") {
  return String(image || "").trim() || fallback;
}

export async function GET(req: Request) {
  try {
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
      where: { id: dealId },
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
      return NextResponse.json(
        { error: "deal chat unavailable" },
        { status: 409 }
      );
    }

    const listing = await prisma.marketListing.findUnique({
      where: { id: deal.cardId },
      select: {
        id: true,
        cardNo: true,
        cardName: true,
        imageUrl: true,
        price: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "listing not found" }, { status: 404 });
    }

    const me = deal.buyerId === currentUserId ? deal.buyer : deal.seller;
    const other = deal.buyerId === currentUserId ? deal.seller : deal.buyer;

    return NextResponse.json({
      roomId: getDealChatRoomId(dealId),
      me: {
        id: me.id,
        name: safeName(me.displayName || me.name),
        image: safeImage(me.image),
      },
      other: {
        id: other.id,
        name: safeName(other.displayName || other.name),
        image: safeImage(other.image),
      },
      deal: {
        id: deal.id,
        offeredPrice: Number(deal.offeredPrice),
      },
      card: {
        id: listing.id,
        no: String(listing.cardNo || "").padStart(3, "0"),
        name: safeName(listing.cardName || "Unknown Card"),
        image: safeImage(
          listing.imageUrl,
          `/cards/${String(listing.cardNo || "001").padStart(3, "0")}.jpg`
        ),
        listedPrice: Number(listing.price || 0),
      },
    });
  } catch (error) {
    console.error("DEAL CHAT INFO ERROR:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
