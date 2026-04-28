import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sanitizeCardImageUrl } from "@/lib/card-image";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentity } from "@/lib/user-identity";

type SessionUser = {
  id?: string;
  lineId?: string;
  name?: string | null;
  image?: string | null;
};

type RouteError = {
  message?: string;
  code?: string;
};

function getSessionUser(session: Awaited<ReturnType<typeof getServerSession>>) {
  return ((session || {}) as { user?: SessionUser }).user || ({} as SessionUser);
}

function normalizeCardNo(value: unknown) {
  return String(value || "").trim().padStart(3, "0");
}

function normalizeSerialNo(value: unknown) {
  const serialNo = String(value || "").trim();
  return serialNo || null;
}

function toListingPayload(item: {
  id: string;
  cardNo: string;
  serialNo: string | null;
  price: number;
  sellerId: string;
  status: string;
  likes: number;
  views: number;
  createdAt: Date;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
  seller?: {
    displayName?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
}) {
  return {
    id: item.id,
    cardNo: String(item.cardNo || ""),
    serialNo: item.serialNo || null,
    price: Number(item.price || 0),
    sellerId: String(item.sellerId || ""),
    sellerName:
      String(item.seller?.displayName || item.seller?.name || "").trim() ||
      "Unknown Seller",
    sellerImage:
      String(item.seller?.image || "").trim() || "/default-avatar.png",
    status: String(item.status || "active"),
    likes: Number(item.likes || 0),
    views: Number(item.views || 0),
    createdAt: item.createdAt.toISOString(),
    cardName: item.cardName || null,
    imageUrl: item.imageUrl || null,
    rarity: item.rarity || null,
  };
}

async function resolveSellerId(
  sessionUser: SessionUser,
  identity: { name: string; image: string; userId: string }
) {
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

async function createOrReuseListing(input: {
  sellerId: string;
  cardNo: string;
  serialNo: string | null;
  price: number;
  cardName: string | null;
  imageUrl: string | null;
  rarity: string | null;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.marketListing.findFirst({
            where: {
              sellerId: input.sellerId,
              cardNo: input.cardNo,
              serialNo: input.serialNo,
              NOT: {
                status: {
                  equals: "sold",
                  mode: "insensitive",
                },
              },
            },
            include: {
              seller: {
                select: {
                  displayName: true,
                  name: true,
                  image: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          });

          if (existing) {
            return {
              deduped: true,
              listing: toListingPayload(existing),
            };
          }

          const created = await tx.marketListing.create({
            data: {
              sellerId: input.sellerId,
              cardNo: input.cardNo,
              serialNo: input.serialNo,
              price: input.price,
              cardName: input.cardName,
              imageUrl: input.imageUrl,
              rarity: input.rarity,
            },
            include: {
              seller: {
                select: {
                  displayName: true,
                  name: true,
                  image: true,
                },
              },
            },
          });

          return {
            deduped: false,
            listing: toListingPayload(created),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error) {
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (!isRetryable || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("create-market-listing-failed");
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

    const normalizedCardNo = normalizeCardNo(cardNo);
    const normalizedSerialNo = normalizeSerialNo(serialNo);
    const numericPrice = Number(price);

    if (
      !normalizedCardNo ||
      !normalizedSerialNo ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return NextResponse.json(
        { error: "ข้อมูลลงขายไม่ครบ" },
        { status: 400 }
      );
    }

    const result = await createOrReuseListing({
      sellerId,
      cardNo: normalizedCardNo,
      serialNo: normalizedSerialNo,
      price: numericPrice,
      cardName: String(cardName || "").trim() || null,
      imageUrl: sanitizeCardImageUrl(imageUrl),
      rarity: String(rarity || "").trim() || null,
    });

    return NextResponse.json({
      success: true,
      deduped: result.deduped,
      listing: result.listing,
    });
  } catch (error) {
    console.error("MARKET CREATE ERROR:", error);

    const routeError = error as RouteError;
    return NextResponse.json(
      {
        error: routeError?.message || routeError?.code || "ลงขายไม่สำเร็จ",
      },
      { status: 500 }
    );
  }
}
