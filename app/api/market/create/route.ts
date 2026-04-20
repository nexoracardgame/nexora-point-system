import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMarketListing } from "@/lib/market-listings";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentity } from "@/lib/user-identity";

type SessionUser = {
  id?: string;
  lineId?: string;
  name?: string | null;
  image?: string | null;
};

function getSessionUser(session: Awaited<ReturnType<typeof getServerSession>>) {
  return ((session || {}) as { user?: SessionUser }).user || ({} as SessionUser);
}

type RouteError = {
  message?: string;
  code?: string;
};

async function resolveSellerId(sessionUser: SessionUser, identity: { name: string; image: string; userId: string }) {
  const sessionUserId = String(sessionUser.id || "").trim();
  const sessionLineId = String(sessionUser.lineId || "").trim();

  if (sessionLineId) {
    const dbUser = await prisma.user.upsert({
      where: {
        lineId: sessionLineId,
      },
      update: {
        name: identity.name,
        image: identity.image,
      },
      create: {
        lineId: sessionLineId,
        name: identity.name,
        image: identity.image,
        role: "USER",
      },
      select: {
        id: true,
      },
    });

    return String(dbUser.id || "").trim();
  }

  if (!sessionUserId) {
    return String(identity.userId || "").trim();
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: sessionUserId }, { lineId: sessionUserId }],
    },
    select: {
      id: true,
    },
  });

  return String(dbUser?.id || sessionUserId).trim();
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = getSessionUser(session);
    const identity = await resolveUserIdentity(sessionUser);
    const sellerId = await resolveSellerId(sessionUser, identity);

    if (!sellerId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const { cardNo, serialNo, price, cardName, imageUrl, rarity } =
      await req.json();

    const numericPrice = Number(price);

    if (!String(cardNo || "").trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: "ข้อมูลลงขายไม่ครบ" }, { status: 400 });
    }

    const listing = await createMarketListing({
      cardNo: String(cardNo).trim(),
      serialNo: String(serialNo || "").trim() || null,
      price: numericPrice,
      sellerId,
      cardName: String(cardName || "").trim() || null,
      imageUrl: String(imageUrl || "").trim() || null,
      rarity: String(rarity || "").trim() || null,
      sellerName: identity.name,
      sellerImage: identity.image,
    });

    return NextResponse.json({
      success: true,
      listing,
    });
  } catch (error) {
    console.error("MARKET CREATE ERROR:", error);

    const routeError = error as RouteError;
    return NextResponse.json(
      {
        error:
          routeError?.message || routeError?.code || "ลงขายไม่สำเร็จ",
      },
      { status: 500 }
    );
  }
}
