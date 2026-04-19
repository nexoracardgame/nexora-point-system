import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const cardNo = String(body?.cardNo || "").trim();
    const listingId = String(body?.listingId || "").trim();
    const userId =
      String(session?.user?.id || "").trim() ||
      String(body?.userId || "").trim();

    if ((!cardNo && !listingId) || !userId) {
      return NextResponse.json(
        { error: "Missing wishlist payload" },
        { status: 400 }
      );
    }

    const listing = listingId
      ? await prisma.marketListing.findUnique({
          where: { id: listingId },
        })
      : await prisma.marketListing.findFirst({
          where: {
            cardNo,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.wishlist.findFirst({
      where: {
        userId,
        listingId: listing.id,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Already wishlisted",
      });
    }

    await prisma.wishlist.create({
      data: {
        userId,
        listingId: listing.id,
      },
    });

    await prisma.marketListing.update({
      where: {
        id: listing.id,
      },
      data: {
        likes: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Wishlist added",
    });
  } catch (error) {
    console.error("WISHLIST ERROR:", error);

    return NextResponse.json(
      { error: "Wishlist failed" },
      { status: 500 }
    );
  }
}
