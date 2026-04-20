import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMarketListing } from "@/lib/market-listings";
import { resolveUserIdentity } from "@/lib/user-identity";

type SessionUser = {
  id?: string;
  name?: string | null;
  image?: string | null;
};

function getSessionUser(session: Awaited<ReturnType<typeof getServerSession>>) {
  return ((session || {}) as { user?: SessionUser }).user || ({} as SessionUser);
}

type RouteError = {
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = getSessionUser(session);
    const identity = await resolveUserIdentity(sessionUser);
    const sellerId = identity.userId;

    if (!sellerId) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const { cardNo, serialNo, price, cardName, imageUrl, rarity } =
      await req.json();

    const listing = await createMarketListing({
      cardNo: String(cardNo),
      serialNo: String(serialNo || "").trim() || null,
      price: Number(price),
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
    const routeError = error as RouteError;
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "ลงขายไม่สำเร็จ"
            : routeError?.message || "ลงขายไม่สำเร็จ",
      },
      { status: 500 }
    );
  }
}
