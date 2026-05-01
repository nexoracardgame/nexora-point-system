import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { cleanupDealChat } from "@/lib/deal-chat-cleanup";
import { publishDealEvent } from "@/lib/deal-events";
import { deleteLocalDeal, getAllLocalDeals } from "@/lib/local-deal-store";
import { deleteMarketListing, getMarketListingById } from "@/lib/market-listings";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = String(session?.user?.id || "").trim();
    const currentRole = String(session?.user?.role || "").trim().toLowerCase();
    const isAdmin = currentRole === "admin";

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
          status: true,
        },
      }),
      getMarketListingById(id),
      getAllLocalDeals(),
    ]);

    const dbStatus = String(dbListing?.status || "").trim().toLowerCase();
    const localStatus = String(localListing?.status || "").trim().toLowerCase();
    const isSoldListing =
      dbStatus === "sold" ||
      dbStatus === "completed" ||
      localStatus === "sold" ||
      localStatus === "completed";

    if (dbListing && dbListing.sellerId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (localListing && localListing.sellerId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isSoldListing && !isAdmin) {
      return NextResponse.json(
        { error: "Only admins can delete completed sold cards" },
        { status: 403 }
      );
    }

    const dbDeals = await prisma.dealRequest.findMany({
      where: {
        cardId: id,
      },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        status: true,
      },
    });

    if (!dbListing && !localListing && dbDeals.length === 0) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (!dbListing && !localListing && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const relatedLocalDeals = localDeals.filter((deal) => deal.cardId === id);
    const relatedDealIds = Array.from(
      new Set(
        [
          ...dbDeals.map((deal) => deal.id),
          ...relatedLocalDeals.map((deal) => deal.id),
        ]
          .map((dealId) => String(dealId || "").trim())
          .filter(Boolean)
      )
    );

    await Promise.all([
      deleteMarketListing(id),
      ...(dbListing
        ? [
            prisma.dealRequest.deleteMany({
              where: {
                cardId: id,
              },
            }),
          ]
        : []),
      ...relatedLocalDeals.map(async (deal) => {
        await deleteLocalDeal(deal.id);
      }),
      ...relatedDealIds.map((dealId) => cleanupDealChat(dealId)),
    ]);

    for (const dealId of relatedDealIds) {
      publishDealEvent({
        dealId,
        action: "cancelled",
        changedAt: new Date().toISOString(),
      });
    }

    revalidatePath("/market");
    revalidatePath("/market/seller-center");
    revalidatePath("/market/deals");
    revalidatePath(`/market/card/${id}`);
    if (dbListing?.sellerId || localListing?.sellerId) {
      revalidatePath(`/profile/${dbListing?.sellerId || localListing?.sellerId}`);
    }
    for (const deal of dbDeals) {
      revalidatePath(`/profile/${deal.buyerId}`);
      revalidatePath(`/profile/${deal.sellerId}`);
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE ERROR:", error);

    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
