import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDealChatRoomId } from "@/lib/deal-chat";
import { getLocalDealById } from "@/lib/local-deal-store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function safeName(name?: string | null) {
  return String(name || "").trim() || "User";
}

function safeImage(image?: string | null, fallback = "/avatar.png") {
  return String(image || "").trim() || fallback;
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

  const localDeal = await getLocalDealById(dealId);

  if (!localDeal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const isParticipant =
    localDeal.buyerId === currentUserId || localDeal.sellerId === currentUserId;

  if (!isParticipant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (localDeal.status !== "accepted") {
    return NextResponse.json({ error: "deal chat unavailable" }, { status: 409 });
  }

  const isBuyer = localDeal.buyerId === currentUserId;

  return NextResponse.json({
    roomId: getDealChatRoomId(localDeal.id),
    me: {
      id: isBuyer ? localDeal.buyerId : localDeal.sellerId,
      name: safeName(isBuyer ? localDeal.buyerName : localDeal.sellerName),
      image: safeImage(isBuyer ? localDeal.buyerImage : localDeal.sellerImage),
    },
    other: {
      id: isBuyer ? localDeal.sellerId : localDeal.buyerId,
      name: safeName(isBuyer ? localDeal.sellerName : localDeal.buyerName),
      image: safeImage(isBuyer ? localDeal.sellerImage : localDeal.buyerImage),
    },
    deal: {
      id: localDeal.id,
      offeredPrice: Number(localDeal.offeredPrice || 0),
    },
    card: {
      id: localDeal.cardId,
      no: String(localDeal.cardNo || "001").padStart(3, "0"),
      name: safeName(localDeal.cardName || "Unknown Card"),
      image: safeImage(
        localDeal.cardImage,
        `/cards/${String(localDeal.cardNo || "001").padStart(3, "0")}.jpg`
      ),
      listedPrice: Number(localDeal.listedPrice || 0),
    },
  });
}
