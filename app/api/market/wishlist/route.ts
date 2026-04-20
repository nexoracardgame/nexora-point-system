import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getLocalMarketListingById,
  getLocalMarketListings,
  incrementLocalMarketListingLikes,
} from "@/lib/local-market-store";
import { createLocalNotification } from "@/lib/local-notification-store";
import { resolveUserIdentity } from "@/lib/user-identity";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const identity = await resolveUserIdentity(session?.user);
    const body = await req.json();
    const cardNo = String(body?.cardNo || "").trim();
    const listingId = String(body?.listingId || "").trim();
    const userId = identity.userId || String(body?.userId || "").trim();

    if ((!cardNo && !listingId) || !userId) {
      return NextResponse.json(
        { error: "Missing wishlist payload" },
        { status: 400 }
      );
    }

    const listing = listingId
      ? await getLocalMarketListingById(listingId)
      : (await getLocalMarketListings())
          .filter((item) => String(item.cardNo || "") === cardNo)
          .sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          )[0] || null;

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    await incrementLocalMarketListingLikes(listing.id);

    if (listing.sellerId && listing.sellerId !== userId) {
      const likerName =
        identity.name || String(body?.userName || "").trim() || "มีคน";
      const likerImage =
        identity.image || String(body?.userImage || "").trim() || "/avatar.png";
      const cardNoLabel = String(listing.cardNo || "").padStart(3, "0");

      await createLocalNotification({
        userId: listing.sellerId,
        type: "wishlist",
        title: `${likerName} ถูกใจการ์ดของคุณ`,
        body: listing.cardName
          ? `${listing.cardName} #${cardNoLabel}`
          : `Card #${cardNoLabel}`,
        href: `/market/card/${listing.id}`,
        image: likerImage,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Wishlist added",
    });
  } catch {
    return NextResponse.json({ error: "Wishlist failed" }, { status: 500 });
  }
}
