import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { publishDealEvent } from "@/lib/deal-events";
import { deleteLocalDeal, getAllLocalDeals } from "@/lib/local-deal-store";
import {
  deleteLocalMarketListing,
  getLocalMarketListingById,
} from "@/lib/local-market-store";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const [dbListing, localListing, localDeals] = await Promise.all([
      prisma.marketListing.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          sellerId: true,
        },
      }),
      getLocalMarketListingById(id),
      getAllLocalDeals(),
    ]);

    if (dbListing && dbListing.sellerId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (localListing && localListing.sellerId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const relatedLocalDeals = localDeals.filter((deal) => deal.cardId === id);

    await Promise.all([
      deleteLocalMarketListing(id),
      ...(dbListing
        ? [
            prisma.dealRequest.deleteMany({
              where: {
                cardId: id,
              },
            }),
            prisma.marketListing.delete({
              where: {
                id,
              },
            }),
          ]
        : []),
      ...relatedLocalDeals.map(async (deal) => {
        if (deal.status === "accepted") {
          await cleanupDealChat(deal.id);
        }

        await deleteLocalDeal(deal.id);
      }),
    ]);

    for (const deal of relatedLocalDeals) {
      publishDealEvent({
        dealId: deal.id,
        action: "cancelled",
        changedAt: new Date().toISOString(),
      });
    }

    revalidatePath("/market");
    revalidatePath("/market/seller-center");
    revalidatePath("/market/deals");
    revalidatePath(`/market/card/${id}`);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE ERROR:", error);

    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
